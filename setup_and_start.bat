@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo   Parcel Sorting & Dispatch Simulator - System Setup
echo ========================================================

cd /d "%~dp0"

:: 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH. Please install Node.js.
    pause
    exit /b 1
)

:: 2. Setup Backend .env if not exists
if not exist "backend\.env" (
    echo [INFO] Creating backend\.env from template...
    copy "backend\.env.example" "backend\.env" >nul
)

:: 3. Install Backend Dependencies
echo [INFO] Installing backend dependencies...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed for backend.
    pause
    exit /b 1
)

:: 4. Initialize Database
echo [INFO] Initializing MySQL Database (make sure MySQL service is running)...
call npm run init-db
if %errorlevel% neq 0 (
    echo [WARNING] Database init script encountered an issue. Check your MySQL connection in backend\.env.
)

:: 5. Install Frontend Dependencies (if frontend directory exists)
cd ..
if exist "frontend\package.json" (
    echo [INFO] Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
)

:: 6. Launch Backend Server
echo.
echo ========================================================
echo   Starting Backend Server...
echo ========================================================
cd backend
start "Parcel Simulator - Backend" npm run dev

echo [SUCCESS] Backend server launched in separate window!
echo You can test health at: http://localhost:5000/api/health
pause

