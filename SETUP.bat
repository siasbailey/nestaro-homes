@echo off
setlocal
cd /d "%~dp0"
title Nestaro Homes Setup

echo ============================================
echo   Nestaro Homes - One-Time Setup
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found.
  echo Install the LTS version from https://nodejs.org then run this file again.
  pause
  exit /b 1
)

if not exist .env (
  if exist .env.example copy .env.example .env >nul
  echo A .env file has been created and will open in Notepad.
  echo.
  echo In Notepad, fill in these two lines, then save and close:
  echo   1. DATABASE_URL    - your MySQL password after root: and your database name at the end
  echo   2. ADMIN_PASSWORD  - a password you choose for the /admin page
  echo.
  echo Then double-click this setup file again.
  echo.
  notepad .env
  pause
  exit /b 0
)

echo [1/4] Installing dependencies - first time can take 5-10 minutes...
call npm install --legacy-peer-deps
if errorlevel 1 goto fail

echo.
echo [2/4] Creating database tables...
call npm run db:migrate
if errorlevel 1 goto fail

echo.
echo [3/4] Loading the luxury property catalog...
call npx tsx db/seed.ts
if errorlevel 1 goto fail

echo.
echo [4/4] Building the app...
call npm run build
if errorlevel 1 goto fail

echo.
echo ============================================
echo   Setup finished! Starting the server now.
echo   From next time, just double-click START.bat
echo ============================================
echo.
set NODE_ENV=production
node dist/boot.js
pause
exit /b 0

:fail
echo.
echo [ERROR] Setup stopped at the step shown above.
echo Copy the error text and send it over.
pause
exit /b 1
