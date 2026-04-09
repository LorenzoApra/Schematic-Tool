@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0.."

if "%PORT%"=="" set "PORT=4173"
set "PID_FILE=.dev-server.win.pid"

if exist "%PID_FILE%" (
  set /p PID=<"%PID_FILE%"
  taskkill /PID !PID! >NUL 2>&1
  timeout /t 1 /nobreak >NUL
  tasklist /FI "PID eq !PID!" 2>NUL | findstr /R /C:" !PID! " >NUL
  if not errorlevel 1 (
    taskkill /F /PID !PID! >NUL 2>&1
  )
  echo Stopped dev server pid !PID!
  del /q "%PID_FILE%" >NUL 2>&1
)

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  taskkill /PID %%P >NUL 2>&1
  timeout /t 1 /nobreak >NUL
  taskkill /F /PID %%P >NUL 2>&1
)

echo Stop complete.
exit /b 0
