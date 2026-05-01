# Crop Recommendation System

XAI-based crop recommendation using 6 ML models from the paper with MongoDB authentication.

## Models Implemented (Paper)
| Model | Paper Section |
|---|---|
| Logistic Regression (LR) | Eq. 12–15 |
| Decision Tree (DTC) | Eq. 16–19 |
| K-Nearest Neighbour (KNN) | Eq. 23–25 |
| Support Vector Machine (SVM) | Eq. 26–30 |
| Random Forest (RFC) | Eq. 20–22 |
| Gradient Boosting (GB) | Eq. 31–34 |

Best model selected by grid search hyperparameter optimization. XAI via LIME + feature importance.

## Metrics Computed (Paper Formulas)
- Accuracy (Eq. 35), Precision (Eq. 36), Recall (Eq. 37), F1 (Eq. 38)
- RMSE (Eq. 39), MAE (Eq. 40), R² (Eq. 41)

## Requirements
- Python 3.9+
- Node.js 16+
- MongoDB (for user auth)

## Setup

### 1. MongoDB
Install and run MongoDB locally:
```
mongod --dbpath /data/db         # Linux/Mac
net start MongoDB                 # Windows
```
Or set `MONGO_URI` env variable to use a remote database (e.g. MongoDB Atlas).

### 2. Backend
```bash
cd backend
pip install -r requirements.txt
python app.py
```
Backend runs on http://localhost:5000

### 3. Frontend
```bash
cd frontend
npm install
npm start
```
Frontend runs on http://localhost:3000

### Quick Start
```bash
# Linux/Mac
chmod +x start-linux-mac.sh
./start-linux-mac.sh

# Windows
start-windows.bat
```

## Dataset
Place `Crop_recommendation.csv` (from Kaggle) in `backend/data/`.  
If not present, a built-in fallback dataset is used automatically.

## API Endpoints
| Endpoint | Method | Description |
|---|---|---|
| /auth/register | POST | Register new user |
| /auth/login | POST | Login, returns token |
| /auth/verify | GET | Verify auth token |
| /predict | POST | Crop prediction + XAI |
| /models | GET | Model comparison table |
| /health | GET | System health check |

## Features
- Login / Register with MongoDB storage (passwords SHA-256 hashed)
- Location auto-detection (browser geolocation → Open-Meteo API for live weather)
- 6 ML models all implemented from scratch (no sklearn)
- Grid search hyperparameter optimization across all models
- XAI explanations: LIME insights + feature importance
- All paper metrics: Accuracy, Precision, Recall, F1, RMSE, MAE, R²
- Fertilizer recommendations removed
