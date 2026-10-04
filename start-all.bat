@echo off
cd /d "%~dp0"
title Dubhe Platform - Start All

echo ============================================================
echo   Dubhe Low-Altitude Operation Platform - Start All
echo   Backend  : http://localhost:5180  (also listening on 0.0.0.0)
echo   Frontend : http://127.0.0.1:4200
echo   Mobile   : connect phone to the PC hotspot, then open the app
echo              (hotspot URL: http://192.168.137.1:5180)
echo ============================================================
echo.

where dotnet >nul 2>nul
if errorlevel 1 (
  echo [ERROR] .NET SDK 10 not found. Install: https://dotnet.microsoft.com/download
  pause
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js 22+ not found. Install: https://nodejs.org/
  pause
  exit /b 1
)

echo [1/3] Starting backend in a new window (0.0.0.0:5180) ...
start "Dubhe Backend (5180)" cmd /k "cd /d %~dp0backend && dotnet run --project src/Dubhe.Api --urls http://0.0.0.0:5180"

echo [2/3] Starting frontend in a new window ...
start "Dubhe Frontend (4200)" cmd /k "call %~dp0frontend\start.bat"

echo [3/3] Enabling Windows mobile hotspot (phone demo) ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\enable-mobile-hotspot.ps1"

echo.
echo Close the two windows to stop, or run stop-all.bat in this folder.
echo Mobile hotspot stays on; turn it off in Windows Settings if not needed.
echo Default admin: username "admin" (password: set Seed:AdminPassword via user-secrets/env, or read the first-startup log)
echo Test accounts: see TEST-ACCOUNTS doc.
ping -n 8 127.0.0.1 >nul
exit /b 0
