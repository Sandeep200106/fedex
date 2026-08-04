@echo off
setlocal

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js is not installed or not on PATH.
    echo Please install it from https://nodejs.org/ and re-run this script.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Installing dependencies, this only happens once...
    call npm install
    if errorlevel 1 (
        echo npm install failed. See the error above.
        pause
        exit /b 1
    )
)

echo Starting Pipeline Builder UI...
start "" http://localhost:5173/
call npm run dev

pause
