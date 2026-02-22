@echo off
setlocal

title UNYIELD Server (Node.js)
color 0A

echo ============================================
echo   UNYIELD SERVER - Starting...
echo ============================================
echo.

set "SCRIPT_DIR=%~dp0"
set "CONFIG_FILE=%SCRIPT_DIR%server-config.bat"

if exist "%CONFIG_FILE%" (
  call "%CONFIG_FILE%"
)

if not defined UNYIELD_ROOT (
  if exist "%SCRIPT_DIR%..\unyield\unyieldserver\server.js" (
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
set "SERVER_DIR=%UNYIELD_ROOT%\unyieldserver"

if not exist "%SERVER_DIR%\server.js" (
  echo [ERROR] Could not find unyieldserver at:
  echo         %SERVER_DIR%
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm not found. Install Node.js 20+ and reopen terminal.
  pause
  exit /b 1
)

cd /d "%SERVER_DIR%"

if not exist ".env" (
  if exist ".env.example" (
    echo [INFO] Creating .env from .env.example...
    copy .env.example .env >nul
    echo [WARNING] Edit .env before first real use.
  ) else (
    echo [ERROR] .env and .env.example not found.
    pause
    exit /b 1
  )
)

if not exist "node_modules" (
  echo [INFO] Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

if not exist "node_modules\.prisma\client\index.js" (
  echo [INFO] Generating Prisma client...
  call npx.cmd prisma generate
  if errorlevel 1 (
    echo [ERROR] Prisma generate failed.
    pause
    exit /b 1
  )
)

echo [INFO] Starting server on port 3000...
echo [INFO] API URL: http://localhost:3000
echo [INFO] Health:  http://localhost:3000/api/health
echo.
echo Press Ctrl+C to stop.
echo.

call npm run dev
endlocal