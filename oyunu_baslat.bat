@echo off
title Muteahhit Online Sunucusu
echo ===================================================
echo     MUTEAHHIT ONLINE SUNUCUSU BASLATILIYOR...
echo ===================================================
echo.
echo Tarayicinizda su adrese gidin: http://localhost:3000
echo.
start http://localhost:3000
node server/index.js
pause
