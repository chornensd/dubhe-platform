@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Dubhe Platform - Stop Services

echo ============================================================
echo   Stop Dubhe services (by port 4200 / 5180)
echo ============================================================
echo.

for %%P in (4200 5180) do (
  set "KILLED="
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr "LISTENING" ^| findstr ":%%P "') do (
    echo [KILL] port %%P  PID %%A
    taskkill /f /pid %%A >nul 2>nul
    set "KILLED=1"
  )
  if not defined KILLED echo [SKIP] port %%P  no listener
)

echo.
echo Done.
ping -n 6 127.0.0.1 >nul
exit /b 0

