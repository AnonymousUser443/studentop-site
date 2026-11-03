@echo off
setlocal
cd /d "%~dp0"
node scripts\start-studio.mjs
if errorlevel 1 pause
