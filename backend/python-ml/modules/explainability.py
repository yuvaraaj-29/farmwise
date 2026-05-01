"""
explainability.py
-----------------
Provides two layers of explainability:

1. Feature Importance (model-native):
   - For Random Forest / Decision Tree: Gini-based importance
   - For Logistic Regression: mean |weight| per feature
   - For KNN / Naive Bayes: SHAP-style perturbation analysis

2. LIME-style Rule Explanations:
   - Human-readable insights based on feature values
   - Domain-knowledge rules about each crop's requirements
"""

import math

FEATURE_NAMES = ['N', 'P', 'K', 'temperature', 'humidity', 'ph', 'rainfall']

FEATURE_LABELS = {
    'N':           'Nitrogen (N)',
    'P':           'Phosphorus (P)',
    'K':           'Potassium (K)',
    'temperature': 'Temperature',
    'humidity':    'Humidity',
    'ph':          'Soil pH',
    'rainfall':    'Rainfall',
}

FEATURE_UNITS = {
    'N': 'kg/ha', 'P': 'kg/ha', 'K': 'kg/ha',
    'temperature': '°C', 'humidity': '%',
    'ph': '', 'rainfall': 'mm/day',
}


# ─────────────────────────────────────────────────────────────────
# 1.  Feature Importance
# ─────────────────────────────────────────────────────────────────

def _perturbation_importance(model, x_norm, n_samples=50, noise_frac=0.15):
    """
    Estimate feature importance by perturbation:
    For each feature j, compute how much prediction probability changes
    when x_j is perturbed by ±noise_frac of its value.

    Used for KNN and Naive Bayes where model weights aren't directly accessible.
    """
    try:
        base_proba = model.predict_proba(x_norm)
        base_cls   = max(base_proba, key=base_proba.get)
        base_conf  = base_proba[base_cls]
    except Exception:
        return [1.0 / len(x_norm)] * len(x_norm)

    importances = []
    for j in range(len(x_norm)):
        deltas = []
        for _ in range(n_samples):
            x_perturbed = x_norm[:]
            x_perturbed[j] += (2 * ((_ % 2) - 0.5)) * noise_frac * (abs(x_norm[j]) + 1e-3)
            try:
                p2   = model.predict_proba(x_perturbed)
                conf2 = p2.get(base_cls, 0.0)
                deltas.append(abs(base_conf - conf2))
            except Exception:
                deltas.append(0.0)
        importances.append(sum(deltas) / len(deltas) if deltas else 0.0)

    total = sum(importances) or 1.0
    return [v / total for v in importances]


def get_feature_importance(model, x_norm, raw_x=None):
    """
    Returns a list of dicts:
        [{feature, label, value, importance, rank}, ...]
    sorted by importance descending.
    """
    # Get raw importances from model or fall back to perturbation
    raw_fi = model.feature_importances() if hasattr(model, 'feature_importances') else None
    if raw_fi is None:
        raw_fi = _perturbation_importance(model, x_norm)

    # Normalise to [0, 1]
    total = sum(raw_fi) or 1.0
    norm_fi = [v / total for v in raw_fi]

    # Map to feature names
    result = []
    for j, feat in enumerate(FEATURE_NAMES):
        raw_val = raw_x[j] if raw_x else None
        result.append({
            'feature':    feat,
            'label':      FEATURE_LABELS[feat],
            'value':      round(raw_val, 2) if raw_val is not None else None,
            'unit':       FEATURE_UNITS[feat],
            'importance': round(norm_fi[j], 4),
        })

    result.sort(key=lambda d: d['importance'], reverse=True)
    for rank, item in enumerate(result, 1):
        item['rank'] = rank

    return result


# ─────────────────────────────────────────────────────────────────
# 2.  LIME-style Domain Explanations
# ─────────────────────────────────────────────────────────────────

def _n_insight(N):
    if N > 100: return f"Very high Nitrogen ({N:.0f} kg/ha) — favours heavy feeders like rice, sugarcane, and banana."
    if N > 60:  return f"High Nitrogen ({N:.0f} kg/ha) — well-suited for cereal crops like maize and wheat."
    if N > 30:  return f"Moderate Nitrogen ({N:.0f} kg/ha) — compatible with cotton, vegetables, and fruits."
    return             f"Low Nitrogen ({N:.0f} kg/ha) — ideal for nitrogen-fixing legumes (chickpea, lentil, pigeonpeas)."

def _p_insight(P):
    if P > 100: return f"Very high Phosphorus ({P:.0f} kg/ha) — promotes flowering in fruits like apple and grapes."
    if P > 50:  return f"High Phosphorus ({P:.0f} kg/ha) — supports strong root development in pulses and beans."
    if P > 25:  return f"Moderate Phosphorus ({P:.0f} kg/ha) — adequate for most cereal and vegetable crops."
    return             f"Low Phosphorus ({P:.0f} kg/ha) — suits crops adapted to low-P soils like mungbean."

def _k_insight(K):
    if K > 150: return f"Very high Potassium ({K:.0f} kg/ha) — enhances fruit quality; typical for grapes and apple."
    if K > 80:  return f"High Potassium ({K:.0f} kg/ha) — improves disease resistance in heavy-crop plants."
    if K > 35:  return f"Moderate Potassium ({K:.0f} kg/ha) — supports balanced growth in cereals and vegetables."
    return             f"Low Potassium ({K:.0f} kg/ha) — adequate for legumes and drought-tolerant crops."

def _temp_insight(T):
    if T > 35:  return f"High temperature ({T:.1f}°C) — favours heat-tolerant tropical crops like papaya, muskmelon, and cotton."
    if T > 28:  return f"Warm temperature ({T:.1f}°C) — optimal for maize, mungbean, blackgram, and most kharif crops."
    if T > 20:  return f"Moderate temperature ({T:.1f}°C) — suitable for rice, wheat, sugarcane, and most staple crops."
    if T > 12:  return f"Cool temperature ({T:.1f}°C) — favours rabi crops like lentil, chickpea, and grapes."
    return             f"Cold temperature ({T:.1f}°C) — suited for apple and other temperate-zone crops."

def _hum_insight(H):
    if H > 85:  return f"Very high humidity ({H:.0f}%) — ideal for water-intensive crops: coconut, orange, papaya."
    if H > 70:  return f"High humidity ({H:.0f}%) — well-suited for rice, banana, and jute cultivation."
    if H > 50:  return f"Moderate humidity ({H:.0f}%) — compatible with most cereals, cotton, and legumes."
    return             f"Low humidity ({H:.0f}%) — favours drought-tolerant crops: chickpea, mothbeans, millet."

def _ph_insight(pH):
    if pH > 8.0: return f"Strongly alkaline soil (pH {pH:.1f}) — very few crops tolerate this; lime-treatment needed."
    if pH > 7.5: return f"Alkaline soil (pH {pH:.1f}) — suits sugarcane, barley; most crops need pH adjustment."
    if pH > 6.5: return f"Slightly alkaline/neutral (pH {pH:.1f}) — ideal for maize, cotton, and pigeonpeas."
    if pH > 5.5: return f"Slightly acidic/neutral (pH {pH:.1f}) — optimal for most crops; maximum nutrient availability."
    if pH > 4.5: return f"Acidic soil (pH {pH:.1f}) — suits coffee and some legumes; liming recommended for others."
    return             f"Strongly acidic soil (pH {pH:.1f}) — very few crops suitable; soil amendment required."

def _rain_insight(R):
    if R > 10:  return f"High daily rainfall ({R:.1f} mm) — favours water-intensive crops: rice, coconut, banana."
    if R > 4:   return f"Moderate rainfall ({R:.1f} mm/day) — compatible with maize, jute, sugarcane."
    if R > 1.5: return f"Low-moderate rainfall ({R:.1f} mm/day) — suits most pulses, cotton, and cereals."
    return             f"Very low rainfall ({R:.1f} mm/day) — drought-resistant crops: chickpea, mothbeans, mungbean."


def lime_explain(raw_x: list) -> list:
    """
    Returns a list of LIME-style insight dicts for human-readable explanation.
    raw_x: [N, P, K, temperature, humidity, ph, rainfall]
    """
    N, P, K, T, H, pH, R = raw_x
    insights = [
        {'factor': 'Nitrogen',    'insight': _n_insight(N)},
        {'factor': 'Phosphorus',  'insight': _p_insight(P)},
        {'factor': 'Potassium',   'insight': _k_insight(K)},
        {'factor': 'Temperature', 'insight': _temp_insight(T)},
        {'factor': 'Humidity',    'insight': _hum_insight(H)},
        {'factor': 'Soil pH',     'insight': _ph_insight(pH)},
        {'factor': 'Rainfall',    'insight': _rain_insight(R)},
    ]
    return insights


# ─────────────────────────────────────────────────────────────────
# 3.  Confidence Decomposition
# ─────────────────────────────────────────────────────────────────

def confidence_breakdown(model, x_norm):
    """
    Returns top-5 crop probabilities as percentage, plus confidence tier.
    """
    try:
        proba = model.predict_proba(x_norm)
    except Exception:
        return [], 'unknown'

    ranked = sorted(proba.items(), key=lambda kv: kv[1], reverse=True)[:5]
    top5 = [{'crop': k, 'probability': round(v * 100, 1)} for k, v in ranked]

    top_prob = ranked[0][1] if ranked else 0
    if top_prob >= 0.80:   tier = 'Very High'
    elif top_prob >= 0.60: tier = 'High'
    elif top_prob >= 0.40: tier = 'Moderate'
    elif top_prob >= 0.25: tier = 'Low'
    else:                  tier = 'Very Low'

    return top5, tier
