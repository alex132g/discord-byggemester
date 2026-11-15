@echo off
rem Keeps the bot running: restarts it 15 s after any crash. Started hidden at login by byggemester.vbs.
cd /d "%~dp0"
:loop
node bot.js >> bot.log 2>&1
timeout /t 15 /nobreak >nul
goto loop
