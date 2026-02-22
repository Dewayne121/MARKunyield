@echo off
setlocal

title Sync MongoDB Data to Local PostgreSQL
color 0C

echo ============================================
echo   Sync MongoDB to Local PostgreSQL

echo ============================================
echo.
echo This runs unyieldserver/scripts/migrate-to-postgres.js

echo Make sure unyieldserver/.env has:
echo   - MONGODB_URI
echo   - DATABASE_URL=postgresql://.../unyielding?schema=public
echo.

set "SCRIPT_DIR=%~dp0"
set "CONFIG_FILE=%SCRIPT_DIR%server-config.bat"
if exist "%CONFIG_FILE%" call "%CONFIG_FILE%"

if not defined UNYIELD_ROOT (
  if exist "%SCRIPT_DIR%..\unyield\unyieldserver\scripts\migrate-to-postgres.js" (
    set "UNYIELD_ROOT=%SCRIPT_DIR%..\unyield"
  )
)

if not defined UNYIELD_ROOT (
  echo [ERROR] UNYIELD_ROOT is not set.
  echo Create server-config.bat from server-config.example.bat first.
  pause
  exit /b 1
)

for %%I in ("%UNYIELD_ROOT%") do set "UNYIELD_ROOT=%%~fI"
set "SERVER_DIR=%UNYIELD_ROOT%\unyieldserver"

if not exist "%SERVER_DIR%\scripts\migrate-to-postgres.js" (
  echo [ERROR] Migration script not found at:
  echo         %SERVER_DIR%\scripts\migrate-to-postgres.js
  pause
  exit /b 1
)

cd /d "%SERVER_DIR%"

if not exist "node_modules" (
  echo [INFO] Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo.
echo [INFO] Starting migration...
call node scripts\migrate-to-postgres.js
if errorlevel 1 (
  echo.
  echo [ERROR] Migration failed.
  pause
  exit /b 1
)

echo.
echo [SUCCESS] Migration complete.
pause
endlocal