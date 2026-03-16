@echo off
setlocal
title Hireflow Starter
cd /d %~dp0

set "AUTO=0"
if /I "%~1"=="--auto" set "AUTO=1"

set "LOG=%~dp0start-windows.log"
echo === Hireflow Starter Log === > "%LOG%"
echo Started: %DATE% %TIME%>> "%LOG%"
echo Folder: %CD%>> "%LOG%"

echo.
echo If this window flashes and closes:
echo 1) Open VS Code Terminal
echo 2) Run:  cd /d "%~dp0"
echo 3) Run:  cmd /k start-windows.bat
echo.
if "%AUTO%"=="0" (
  echo Press any key to start...
  pause >nul
) else (
  echo AUTO mode: starting immediately...
)

echo === Hireflow (Windows) Starter ===
echo.

echo [INFO] Writing progress to start-windows.log
echo [INFO] Step 1: env setup>> "%LOG%"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed.
  echo Install Node.js LTS 18 or 20 from https://nodejs.org then reopen VS Code.
  echo [ERROR] Node.js is not installed.>> "%LOG%"
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm not found. Reinstall Node.js.
  pause
  exit /b 1
)

echo [1/4] Creating backend .env if missing...
if not exist "backend\.env" (
  (
    echo PORT=4000
    echo CORS_ORIGIN="http://localhost:5173"
    echo SUPABASE_URL=""
    echo SUPABASE_SERVICE_ROLE_KEY=""
    echo EMAIL_MODE="log"
    echo EMAIL_FROM="no-reply@hireflow.local"
    echo ADMIN_EMAILS="admin@hireflow.local"
  ) > "backend\.env"
  echo   Created backend\.env
  echo Created backend\.env>> "%LOG%"
) else (
  echo   backend\.env already exists
  echo backend\.env already exists>> "%LOG%"
)

echo.
echo [2/4] Installing backend deps...
echo [INFO] Step 2: backend install>> "%LOG%"
pushd "backend" >nul
call npm install
if errorlevel 1 goto :fail
popd >nul

echo.
echo [3/4] Installing frontend deps...
echo [INFO] Step 3: frontend install>> "%LOG%"
pushd "frontend" >nul
call npm install
if errorlevel 1 goto :fail
popd >nul

echo.
echo [4/4] Starting backend + frontend in two windows...
echo [INFO] Step 4: starting dev servers>> "%LOG%"
start "Hireflow Backend" cmd /k "cd /d %~dp0backend && npm run dev"
start "Hireflow Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Done. Open the frontend URL printed (usually http://localhost:5173)
echo.
echo If you don't see two new windows, use Alt+Tab.
echo Look for: "Hireflow Backend" and "Hireflow Frontend".

if "%AUTO%"=="0" (
  echo.
  echo Press any key to close THIS starter window.
  pause >nul
)
exit /b 0

:fail
echo.
echo [ERROR] A command failed. Scroll up for the error message.
echo [ERROR] A command failed. See start-windows.log for details.>> "%LOG%"
echo.
echo ===== start-windows.log (last 80 lines) =====
type "%LOG%" | more
echo ============================================
if "%AUTO%"=="0" pause
exit /b 1
