@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0.."

if "%HOST%"=="" set "HOST=127.0.0.1"
if "%PORT%"=="" set "PORT=4173"
set "PID_FILE=.dev-server.win.pid"
set "LOG_FILE=.dev-server.win.log"

if exist "%PID_FILE%" (
  set /p PID=<"%PID_FILE%"
  tasklist /FI "PID eq !PID!" 2>NUL | findstr /R /C:" !PID! " >NUL
  if not errorlevel 1 (
    echo Dev server already running ^(pid !PID!^).
    echo URL: http://%HOST%:%PORT%/
    exit /b 0
  )
  del /q "%PID_FILE%" >NUL 2>&1
)

set "PORT_BUSY="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  set "PORT_BUSY=1"
)
if defined PORT_BUSY (
  echo Port %PORT% is already in use. Run scripts\stop-windows.cmd first or set PORT=other.
  exit /b 1
)

for /f %%I in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = Start-Process -FilePath 'npm.cmd' -ArgumentList @('run','dev','--','--host','%HOST%','--port','%PORT%') -RedirectStandardOutput '%LOG_FILE%' -RedirectStandardError '%LOG_FILE%' -PassThru; $p.Id"') do (
  set "PID=%%I"
)

if "%PID%"=="" (
  echo Failed to start dev server.
  exit /b 1
)

echo %PID%>"%PID_FILE%"
echo Started dev server ^(pid %PID%^)
echo URL: http://%HOST%:%PORT%/
echo Logs: %LOG_FILE%
exit /b 0
