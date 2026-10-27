@echo off
rem ---------------------------------------------------------------------------
rem  Open-Site.cmd - Windows wrapper for the local preview tunnel (Open-Site.ps1)
rem    deploy\Open-Site.cmd              start/reuse tunnel and open the browser
rem    deploy\Open-Site.cmd -Stop        stop the tunnel
rem    deploy\Open-Site.cmd -Port 8081   use another local port
rem ---------------------------------------------------------------------------
setlocal
set "SCRIPT_DIR=%~dp0"
where pwsh.exe >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    pwsh.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%Open-Site.ps1" %*
) else (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%Open-Site.ps1" %*
)
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
    echo.
    echo [Open-Site.cmd] script exited with code %RC%
)
endlocal & exit /b %RC%
