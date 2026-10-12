@echo off
taskkill /F /IM node.exe 2>nul
if errorlevel 1 (
  echo No Node process running
) else (
  echo Stopped HUGO Studio
)
