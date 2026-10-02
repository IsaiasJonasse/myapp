@echo off
setlocal
cd /d "%~dp0"
title SoilBot Desktop App

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Start-SoilBot.ps1" -Web
if errorlevel 1 (
  echo.
  echo SoilBot desktop could not start. Review the message above.
  pause
)
