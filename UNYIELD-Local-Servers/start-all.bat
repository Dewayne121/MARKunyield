@echo off
setlocal

title UNYIELD Local Servers
color 0E

echo ============================================
echo   UNYIELD LOCAL SERVERS
echo ============================================
echo.
echo This starts:
echo   1. unyieldserver (Node.js) on port 3000
echo   2. faceblurapi (Python) on port 8000
echo.

start "UNYIELD Server" cmd /k "%~dp0start-unyieldserver.bat"
timeout /t 2 /nobreak >nul
start "Face Blur API" cmd /k "%~dp0start-faceblurapi.bat"

echo.
echo Started both server windows.
echo   API:       http://localhost:3000
echo   FaceBlur:  http://localhost:8000
echo.
echo If either script asks for setup, complete that in its window.
echo.
endlocal