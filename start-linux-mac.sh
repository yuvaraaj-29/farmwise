#!/bin/bash
# Crop Recommendation System — Start Script (Linux / Mac)

echo "========================================"
echo " Crop Recommendation System"
echo "========================================"

# ── Backend ────────────────────────────────────────────────────
echo ""
echo "[1/2] Starting Backend (Flask)..."

cd backend
pip install -r requirements.txt -q

echo ""
echo "NOTE: MongoDB must be running for Login/Register to work."
echo "  Start MongoDB: mongod --dbpath /data/db"
echo "  Or set MONGO_URI env variable for remote MongoDB."
echo ""

python app.py &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to start
sleep 4

# ── Frontend ───────────────────────────────────────────────────
echo ""
echo "[2/2] Starting Frontend (React)..."
cd ../frontend
npm install --silent
npm start &
FRONTEND_PID=$!

echo ""
echo "========================================"
echo " System is starting up"
echo " Backend:  http://localhost:5000"
echo " Frontend: http://localhost:3000"
echo "========================================"
echo ""
echo "Press Ctrl+C to stop both servers."

wait
