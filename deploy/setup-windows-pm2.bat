@echo off
REM ============================================================================
REM Photopodra Windows Service Setup Script using PM2
REM Run as Administrator
REM ============================================================================

echo [Photopodra] Starting Windows Service Setup...

REM 1. Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH! Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

REM 2. Install PM2 globally if not present
echo [Photopodra] Installing PM2 and Windows startup utility...
call npm install -g pm2 pm2-windows-startup

REM 3. Register PM2 startup handler
echo [Photopodra] Configuring PM2 to launch on Windows boot...
call pm2-startup install

REM 4. Change directory to Photopodra root
cd /d "%~dp0\.."

REM 5. Start Photopodra using ecosystem config
echo [Photopodra] Starting Photopodra via PM2...
call pm2 start ecosystem.config.cjs

REM 6. Save current PM2 process list to resurrect on reboot
echo [Photopodra] Saving process state for auto-resurrection on boot...
call pm2 save

echo ============================================================================
echo [SUCCESS] Photopodra is now registered as a permanent Windows background service!
echo - Web UI & API available at: http://localhost:3001
echo - Check status anytime with:  pm2 status
echo - View server logs with:      pm2 logs photopodra-server
echo - Restart service with:       pm2 restart photopodra-server
echo ============================================================================
pause
