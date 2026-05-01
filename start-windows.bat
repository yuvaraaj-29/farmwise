@echo off
echo ========================================
echo  Crop Recommendation System
echo ========================================

echo.
echo [1/2] Starting Backend (Flask)...
cd backend
pip install -r requirements.txt -q
echo.
echo NOTE: MongoDB must be running for Login/Register to work.
echo   Start MongoDB: net start MongoDB
echo   Or set MONGO_URI env variable for remote MongoDB.
echo.
start "Backend" cmd /k "python app.py"
timeout /t 4 /nobreak >nul

echo.
echo [2/2] Starting Frontend (React)...
cd ..\frontend
call npm install --silent
start "Frontend" cmd /k "npm start"

echo.
echo ========================================
echo  System is starting up
echo  Backend:  http://localhost:5000
echo  Frontend: http://localhost:3000
echo ========================================
echo.
pause
