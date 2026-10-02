@echo off
setlocal
cd /d "%~dp0"
title SoilBot Native App

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Start-SoilBot.ps1"
if errorlevel 1 (
  echo.
  echo SoilBot could not start. Review the message above.
  pause
)
