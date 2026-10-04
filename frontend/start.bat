@echo off
setlocal
cd /d "%~dp0"
title Dubhe Frontend - Dev Server (4200)

echo ============================================================
echo   Dubhe Low-Altitude Operation Platform - PC Web (Angular)
echo   Directory: %CD%
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install Node.js 22 LTS or newer: https://nodejs.org/
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do set NODE_VER=%%v
echo [1/4] Node %NODE_VER%
echo.

if exist "node_modules\@angular\core" (
  echo [2/4] Dependencies found, skip npm install
) else (
  echo [2/4] Installing dependencies, this may take a few minutes ...
  echo       If the network is restricted, run first:  set HTTPS_PROXY=http://127.0.0.1:PORT
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] npm install failed. Check network and retry.
    pause
    exit /b 1
  )
)
echo.

echo [3/4] Checking backend API at http://localhost:5180/health ...
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:5180/health' -UseBasicParsing -TimeoutSec 3 -NoProxy; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
if errorlevel 1 (
  echo       [WARN] Backend is not reachable.
  echo              Run start-all.bat in the repo root, or:
  echo              cd ..\backend ^&^& dotnet run --project src/Dubhe.Api
  echo              The frontend will still start, but API calls will fail.
) else (
  echo       Backend OK (HTTP 200)
)
echo.

echo [4/4] Starting Angular dev server: http://127.0.0.1:4200
echo       /api /hubs /health are proxied to http://localhost:5180
echo       Press Ctrl+C in this window to stop.
echo.
start "" /b cmd /c "ping -n 13 127.0.0.1 >nul & start "" http://127.0.0.1:4200"
call npm start -- %*
set EXITCODE=%errorlevel%
echo.
echo Dev server exited (code=%EXITCODE%).
pause
exit /b %EXITCODE%

