@echo off 
title JSWS Web Sequencer Launcher 

:: Change directory to the folder containing this batch script 
cd /d "%\~dp0" 

:: Verify miniserve.exe exists 
if not exist "miniserve.exe" ( 
    echo [ERROR] miniserve.exe not found in "%\~dp0" 
    echo Please place miniserve.exe in the same directory as this script. 
    pause 
    exit /b 
    ) 
    
:: Start miniserve minimized in the background on port 8080 
start "JSWS Miniserve" /min miniserve.exe . --index index.html -p 8080 
:: Wait 1 second for the local server to initialize 
timeout /t 1 /nobreak &gt;nul 
:: Open your default web browser 
start http://localhost:8080

