@echo off
cd /d "%~dp0"
title Nestaro Homes Server
set NODE_ENV=production
echo ============================================
echo   Nestaro Homes is starting...
echo.
echo   Open your browser at: http://localhost:3000
echo   Admin dashboard at:   http://localhost:3000/admin
echo.
echo   Keep this window open while using the site.
echo   Press Ctrl+C here to stop the server.
echo ============================================
echo.
node dist/boot.js
pause
