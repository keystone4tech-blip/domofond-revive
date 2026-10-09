@echo off
chcp 65001 > nul
title Шлюз обмена ДомофонДар <-> 1С
echo ========================================================
echo   Запуск шлюза интеграции «ДомофонДар» <-> 1С:Предприятие
echo ========================================================
echo.

cd /d "%~dp0"

set POWERSHELL_PATH=%SystemRoot%\SysWOW64\WindowsPowerShell\v1.0\powershell.exe
if not exist "%POWERSHELL_PATH%" (
    set POWERSHELL_PATH=powershell.exe
)

"%POWERSHELL_PATH%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0bridge.ps1" -Mode continuous

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ОШИБКА] Шлюз завершил работу с кодом %ERRORLEVEL%.
    pause
)
