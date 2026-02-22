@echo off
setlocal

title Face Blur API (Python)
color 0B

echo ============================================
echo   FACE BLUR API - Starting...
echo ============================================
echo.

set "SCRIPT_DIR=%~dp0"
set "CONFIG_FILE=%SCRIPT_DIR%server-config.bat"

if exist "%CONFIG_FILE%" (
  call "%CONFIG_FILE%"
)

if not defined UNYIELD_ROOT (
  if exist "%SCRIPT_DIR%..\unyield\faceblurapi\app\main.py" (
    set "UNYIELD_ROOT=%SCRIPT_DIR%..\unyield"
  )
)

if not defined UNYIELD_ROOT (
  echo [ERROR] UNYIELD_ROOT is not set.
  echo.
  echo Create "%SCRIPT_DIR%server-config.bat" from server-config.example.bat
  echo and set UNYIELD_ROOT to your UNYIELD repo path.
  pause
  exit /b 1
)

for %%I in ("%UNYIELD_ROOT%") do set "UNYIELD_ROOT=%%~fI"
set "FACEBLUR_DIR=%UNYIELD_ROOT%\faceblurapi"

if not exist "%FACEBLUR_DIR%\app\main.py" (
  echo [ERROR] Could not find faceblurapi at:
  echo         %FACEBLUR_DIR%
  pause
  exit /b 1
)

where python >nul 2>&1
if errorlevel 1 (
  echo [ERROR] python not found. Install Python 3.10+ and reopen terminal.
  pause
  exit /b 1
)

cd /d "%FACEBLUR_DIR%"

if not exist ".env" (
  if exist ".env.example" (
    echo [INFO] Creating .env from .env.example...
    copy .env.example .env >nul
    echo [WARNING] Edit .env before first real use.
  )
)

if not exist "venv\Scripts\python.exe" (
  echo [INFO] Creating Python virtual environment...
  python -m venv venv
  if errorlevel 1 (
    echo [ERROR] Failed to create virtual environment.
    pause
    exit /b 1
  )
)

call venv\Scripts\activate.bat

pip show fastapi >nul 2>&1
if errorlevel 1 (
  echo [INFO] Installing Python dependencies...
  pip install -r requirements.txt
  if errorlevel 1 (
    echo [ERROR] pip install failed.
    pause
    exit /b 1
  )
)

echo [INFO] Starting server on port 8000...
echo [INFO] API URL: http://localhost:8000
echo [INFO] Health:  http://localhost:8000/health
echo [INFO] Docs:    http://localhost:8000/docs
echo.
echo Press Ctrl+C to stop.
echo.

python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
endlocal