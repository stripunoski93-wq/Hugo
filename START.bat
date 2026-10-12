@echo off
setlocal enabledelayedexpansion

echo Checking Node version...
for /f "tokens=1 delims=." %%i in ('node -v') do (
  set NODE_VERSION=%%i
  set NODE_VERSION=!NODE_VERSION:v=!
)

if "%NODE_VERSION%" LSS "24" (
  echo Node 24+ is required
  exit /b 1
)

echo Installing dependencies...
call npm install

echo Starting HUGO Studio...
start http://127.0.0.1:3100
call npm start
