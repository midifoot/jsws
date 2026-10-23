@echo off
title JSWS Web Sequencer Launcher

:: Change directory to the jsws app root folder (parent of boot_scripts)
cd /d "%~dp0.."

:: Start miniserve.exe if available, otherwise fallback to Python http.server
if exist "miniserve.exe" (
    start "JSWS Miniserve" /min miniserve.exe . --index index.html -p 8080
) else if exist "boot_scripts\miniserve.exe" (
    start "JSWS Miniserve" /min boot_scripts\miniserve.exe . --index index.html -p 8080
) else (
    where python >nul 2>nul
    if %errorlevel% equ 0 (
        start "JSWS Python Server" /min python -m http.server 8080
    ) else (
        echo [ERROR] Neither miniserve.exe nor python was found.
        echo Please place miniserve.exe in "%cd%" or install Python.
        pause
        exit /b
    )
)

:: Wait 1 second for the local server to initialize
timeout /t 1 /nobreak >nul
:: Open your default web browser
start http://localhost:8080
