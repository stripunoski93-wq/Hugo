@echo off
setlocal enabledelayedexpansion

where node >nul 2>nul
if errorlevel 1 (
  echo Node 24+ is required.
  exit /b 1
)

for /f "tokens=1 delims=." %%i in ('node -p "process.versions.node"') do set NODE_MAJOR=%%i
if "%NODE_MAJOR%" LSS "24" (
  echo Node 24 or newer is required.
  exit /b 1
)

call npm install
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
  start "HUGO Studio" "C:\Program Files\Google\Chrome\Application\chrome.exe" "http://127.0.0.1:3100"
) else (
  start "HUGO Studio" http://127.0.0.1:3100
)

call npm start
