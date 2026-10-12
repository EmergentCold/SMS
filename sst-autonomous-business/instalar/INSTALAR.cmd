@echo off
rem Instalador do SST Agent: duplo clique. Cada etapa pede confirmacao.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar_windows.ps1" %*
echo.
pause
