import os
import sys
import json
import pickle
import urllib.request
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
sys.path.insert(0, os.path.dirname(__file__))
import manual_models
from manual_models import (
    ManualLogisticRegression, ManualDecisionTree, ManualRandomForest,
    ManualKNN, ManualSVM, ManualGradientBoosting, ManualDecisionTreeForest,
)
from modules.weather import get_weather
from modules.explainability import lime_explain, get_feature_importance
from modules.fertilizer import get_fertilizer_recommendation

def _reverse_geocode(lat: float, lon: float) -> str:
    """Return city name from Open-Meteo geocoding (no API key needed)."""
    try:
        url = (
            f"https://nominatim.openstreetmap.org/reverse"
            f"?lat={lat}&lon={lon}&format=json&zoom=10"
        )
        req = urllib.request.Request(
            url, headers={'User-Agent': 'FarmWise/2.0 (crop-recommendation)'}
        )
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        addr = data.get('address', {})
        city = (
            addr.get('city') or addr.get('town') or
            addr.get('village') or addr.get('county') or
            addr.get('state_district') or addr.get('state') or ''
        )
        return city
    except Exception:
        return ''
class PickleRedirectUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        if module == '__main__':
            module = 'manual_models'
        return super().find_class(module, name)
app = FastAPI(title="FarmWise ML Service", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
FEATURE_NAMES = ['N', 'P', 'K', 'temperature', 'humidity', 'ph', 'rainfall']
BASE = os.path.dirname(__file__)
def _load_model(filename):
    path = os.path.join(BASE, 'models', filename)
    with open(path, 'rb') as fh:
        return PickleRedirectUnpickler(fh).load()
model  = _load_model('best_model.pkl')
le     = _load_model('label_encoder.pkl')
scaler = _load_model('scaler.pkl')
model_name = type(model).__name__
print(f"[FarmWise ML] Model loaded: {model_name}")
print(f"[FarmWise ML] Crops supported: {list(le.classes_)}")
class PredictRequest(BaseModel):
    N: float
    P: float
    K: float
    ph: float
    lat: Optional[float] = None
    lon: Optional[float] = None
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    rainfall: Optional[float] = None
class FertilizerRequest(BaseModel):
    crop: str
    N: float = 0.0
    P: float = 0.0
    K: float = 0.0
class WeatherRequest(BaseModel):
    lat: float
    lon: float
def _predict_proba(mdl, X_scaled: np.ndarray) -> dict:
    crops = list(le.classes_)

    if isinstance(mdl, ManualRandomForest):
        all_preds = np.array([tree.predict(X_scaled) for tree in mdl.trees])
        votes = all_preds[:, 0]
        vote_map = {}
        for v in votes:
            vote_map[v] = vote_map.get(v, 0) + 1
        total = len(votes)
        return {crop: round(vote_map.get(enc, 0) / total, 4)
                for enc, crop in enumerate(crops)}
    if isinstance(mdl, ManualLogisticRegression):
        Z = X_scaled @ mdl.W + mdl.b
        Z_shift = Z - np.max(Z, axis=1, keepdims=True)
        exp_Z = np.exp(Z_shift)
        P = exp_Z / np.sum(exp_Z, axis=1, keepdims=True)
        return {le.inverse_transform([cls])[0]: round(float(P[0, i]), 4)
                for i, cls in enumerate(mdl.classes_)}
    if isinstance(mdl, ManualKNN):
        dists = np.sqrt(np.sum((mdl.X_train - X_scaled[0]) ** 2, axis=1))
        k_idx = np.argsort(dists)[:mdl.k]
        k_labels = mdl.y_train[k_idx]
        vote_map = {}
        for v in k_labels:
            vote_map[v] = vote_map.get(v, 0) + 1
        return {crop: round(vote_map.get(enc, 0) / mdl.k, 4)
                for enc, crop in enumerate(crops)}
    if isinstance(mdl, ManualSVM):
        scores_list = []
        for cls in mdl.classes_:
            clf = mdl.classifiers[cls]
            K = mdl._rbf_kernel(X_scaled, clf['sv'], mdl.gamma)
            scores_list.append((K @ (clf['alpha'] * clf['y_bin']) + clf['bias']).item())
        scores = np.array(scores_list)
        exp_s = np.exp(scores - np.max(scores))
        softmax = exp_s / exp_s.sum()
        return {le.inverse_transform([cls])[0]: round(float(softmax[i]), 4)
                for i, cls in enumerate(mdl.classes_)}

    if isinstance(mdl, ManualGradientBoosting):
        n_samples = X_scaled.shape[0]
        F = np.tile(mdl.init_scores, (n_samples, 1))
        for trees_k in mdl.estimators:
            for k, tree in enumerate(trees_k):
                preds = tree.predict(X_scaled)
                F[:, k] += mdl.learning_rate * (2 * preds - 1) * 0.5
        F_shift = F - np.max(F, axis=1, keepdims=True)
        exp_F = np.exp(F_shift)
        P = exp_F / np.sum(exp_F, axis=1, keepdims=True)
        return {le.inverse_transform([cls])[0]: round(float(P[0, i]), 4)
                for i, cls in enumerate(mdl.classes_)}

    pred_encoded = int(mdl.predict(X_scaled)[0])
    crop = le.inverse_transform([pred_encoded])[0]
    return {c: (1.0 if c == crop else 0.0) for c in crops}

def _permutation_importance(mdl, X_scaled: np.ndarray) -> list:
    raw_pred = np.atleast_1d(np.array(mdl.predict(X_scaled)).flatten())
    base_pred = le.inverse_transform(raw_pred)[0]
    proba = _predict_proba(mdl, X_scaled)
    base_conf = proba.get(base_pred, 1.0)
    importances = []
    for j in range(X_scaled.shape[1]):
        deltas = []
        for sign in [-1, 1]:
            X_p = X_scaled.copy()
            X_p[0, j] += sign * 0.5
            p2 = _predict_proba(mdl, X_p)
            deltas.append(abs(base_conf - p2.get(base_pred, 0.0)))
        importances.append(max(deltas))

    total = sum(importances) or 1.0
    return [v / total for v in importances]

def _feature_importance_list(mdl, X_scaled: np.ndarray, raw_x: list) -> list:
    LABELS = {
        'N': 'Nitrogen (N)', 'P': 'Phosphorus (P)', 'K': 'Potassium (K)',
        'temperature': 'Temperature', 'humidity': 'Humidity',
        'ph': 'Soil pH', 'rainfall': 'Rainfall',
    }
    UNITS = {
        'N': 'kg/ha', 'P': 'kg/ha', 'K': 'kg/ha',
        'temperature': '°C', 'humidity': '%', 'ph': '', 'rainfall': 'mm/day',
    }

    if isinstance(mdl, ManualRandomForest):
        fi = list(mdl.feature_importances_)
        total = sum(fi) or 1.0
        raw_imp = [v / total for v in fi]
    else:
        raw_imp = _permutation_importance(mdl, X_scaled)

    result = []
    for j, feat in enumerate(FEATURE_NAMES):
        result.append({
            'feature':    feat,
            'label':      LABELS[feat],
            'value':      round(raw_x[j], 2) if raw_x[j] is not None else None,
            'unit':       UNITS[feat],
            'importance': round(raw_imp[j], 4),
        })

    result.sort(key=lambda d: d['importance'], reverse=True)
    for rank, item in enumerate(result, 1):
        item['rank'] = rank
    return result
@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": model_name,
        "crops": list(le.classes_),
    }

@app.post("/predict")
def predict(body: PredictRequest):
    try:
        lat = body.lat if body.lat is not None else 20.59
        lon = body.lon if body.lon is not None else 78.96

        weather_raw = get_weather(lat, lon)

        # Reverse-geocode to get city name (best-effort, empty string on failure)
        city = _reverse_geocode(lat, lon)

        raw_values = [
            float(body.N),
            float(body.P),
            float(body.K),
            float(body.temperature) if body.temperature is not None else weather_raw['temperature'],
            float(body.humidity)    if body.humidity    is not None else weather_raw['humidity'],
            float(body.ph),
            float(body.rainfall)    if body.rainfall    is not None else weather_raw['rainfall'],
        ]

        X_scaled = scaler.transform([raw_values])
        pred_encoded = np.atleast_1d(np.array(model.predict(X_scaled)).flatten())
        crop = le.inverse_transform(pred_encoded)[0]

        proba = _predict_proba(model, X_scaled)
        ranked = sorted(proba.items(), key=lambda kv: kv[1], reverse=True)
        top_crops = [{'crop': k, 'probability': round(v * 100, 1)} for k, v in ranked[:5]]
        top_prob  = ranked[0][1] if ranked else 0

        if top_prob >= 0.80:   tier = 'Very High'
        elif top_prob >= 0.60: tier = 'High'
        elif top_prob >= 0.40: tier = 'Moderate'
        elif top_prob >= 0.25: tier = 'Low'
        else:                  tier = 'Very Low'

        feat_importance = _feature_importance_list(model, X_scaled, raw_values)
        lime_insights   = lime_explain(raw_values)

        soil_npk = {'N': raw_values[0], 'P': raw_values[1], 'K': raw_values[2]}
        fertilizer = get_fertilizer_recommendation(crop, soil_npk)

        return {
            'crop':            crop,
            'confidence':      round(top_prob * 100, 1),
            'confidence_tier': tier,
            'top_crops':       top_crops,
            'location': {
                'lat':  round(lat, 4),
                'lon':  round(lon, 4),
                'city': city,
            },
            'weather': {
                'temperature': weather_raw['temperature'],
                'humidity':    weather_raw['humidity'],
                'rainfall':    weather_raw['rainfall'],
                'source':      weather_raw['source'],
                'lat':         lat,
                'lon':         lon,
            },
            'model':       model_name,
            'explanation': {
                'feature_importance': feat_importance,
                'lime':              lime_insights,
            },
            'input_features': dict(zip(FEATURE_NAMES, raw_values)),
            'fertilizer':     fertilizer,
            'warnings':       [],
        }

    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@app.post("/fertilizer")
def fertilizer_endpoint(body: FertilizerRequest):
    try:
        crop = body.crop.strip()
        if not crop:
            raise HTTPException(status_code=400, detail="crop field is required")
        soil_npk = {'N': body.N, 'P': body.P, 'K': body.K}
        return get_fertilizer_recommendation(crop, soil_npk)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fertilizer recommendation failed: {str(e)}")


@app.post("/weather")
def weather_endpoint(body: WeatherRequest):
    try:
        return get_weather(body.lat, body.lon)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Weather fetch failed: {str(e)}")


@app.get("/models")
def get_models():
    return {
        'models': [{
            'model': model_name, 'accuracy': None, 'precision': None,
            'recall': None, 'f1': None, 'is_best': True,
        }],
        'best': model_name,
    }


if __name__ == '__main__':
    import uvicorn
    port = int(os.environ.get('ML_PORT', 8000))
    print(f"\n[FarmWise ML] Service running on http://localhost:{port}")
    uvicorn.run(app, host='0.0.0.0', port=port)