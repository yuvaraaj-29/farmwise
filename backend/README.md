# FarmWise v2 — Full Stack

## Architecture

```
React Frontend  →  Express Backend (Node.js :3001)  →  ML Service (Python :8000)
                          ↓
                     MongoDB :27017
```

- **Express backend** handles auth (JWT + MongoDB), request validation, and rate limiting
- **Python ML service** (FastAPI) handles prediction, explainability, fertilizer, and weather
- **Frontend** calls only the Express backend (`/api/*`)

## Quick Start

### 1. Python ML Service

```bash
cd python-ml
pip install -r requirements.txt
uvicorn ml_service:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Express Backend

```bash
cd express-backend
cp .env.example .env        # edit as needed
npm install
npm run dev                 # or: npm start
```

### 3. Frontend

Update `src/config.js` (or wherever your API base URL is set):
```js
const API_BASE = 'http://localhost:3001/api';
```

---

## API Reference (Express)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET  | `/api/health` | — | System health |
| POST | `/api/predict` | — | Crop prediction + XAI |
| POST | `/api/fertilizer` | — | Fertilizer recommendation |
| GET  | `/api/weather?lat=X&lon=Y` | — | Weather for location |
| GET  | `/api/models` | — | Model info |
| POST | `/api/auth/register` | — | Register user |
| POST | `/api/auth/login` | — | Login |
| GET  | `/api/auth/verify` | Bearer | Verify token |

### POST /api/predict

```json
{
  "N": 90, "P": 42, "K": 43, "ph": 6.5,
  "lat": 9.4533,   // Sivakasi lat — REQUIRED for correct weather
  "lon": 77.8024   // Sivakasi lon — REQUIRED for correct weather
}
```

> **Location fix:** Always pass `lat`/`lon` matching the user's actual location.
> Without these, weather defaults to India's center (20.59°N, 78.96°E), which
> gives wrong temperature/humidity/rainfall and can flip the prediction.

---

## Why Predictions Were Wrong

The original project defaulted `lat=20.59, lon=78.96` (central India) when no
coordinates were provided. This meant weather was always fetched for Nagpur
regardless of the user's actual location. Temperature, humidity, and rainfall
are major prediction features — a user in coastal Tamil Nadu (high humidity,
high rainfall) would get inland weather values, pushing the model toward the
wrong crop.

**Fix applied:** The ML service now clearly separates "no lat/lon given" from
"lat/lon = 0". The Express route only forwards lat/lon if they are explicitly
present in the request body, and the frontend should always collect the user's
location before calling `/api/predict`.

---

## Docker Compose (optional)

```yaml
version: '3.8'
services:
  ml:
    build: ./python-ml
    ports: ["8000:8000"]
  
  express:
    build: ./express-backend
    ports: ["3001:3001"]
    environment:
      ML_SERVICE_URL: http://ml:8000
      MONGO_URI: mongodb://mongo:27017/farmwise
    depends_on: [ml, mongo]
  
  mongo:
    image: mongo:7
    ports: ["27017:27017"]
    volumes: ["mongo_data:/data/db"]

volumes:
  mongo_data:
```
