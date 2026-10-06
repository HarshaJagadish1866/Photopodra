<#
.SYNOPSIS
    Photopodra Windows Auto-start setup script via PM2 (PowerShell)
.DESCRIPTION
    Installs PM2, configures automatic Windows startup on boot, starts Photopodra, and saves the process state.
#>

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Photopodra Windows Service Setup (PM2)   " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js was not found in PATH! Please install Node.js from https://nodejs.org"
    Exit 1
}

Write-Host "`n[1/4] Installing PM2 and Windows startup helper globally..." -ForegroundColor Yellow
npm install -g pm2 pm2-windows-startup

Write-Host "`n[2/4] Registering PM2 Windows boot handler..." -ForegroundColor Yellow
pm2-startup install

Write-Host "`n[3/4] Starting Photopodra with PM2 ecosystem..." -ForegroundColor Yellow
$rootDir = Resolve-Path "$PSScriptRoot\.."
Set-Location $rootDir
pm2 start ecosystem.config.cjs

Write-Host "`n[4/4] Saving PM2 state for automatic resurrection on boot..." -ForegroundColor Yellow
pm2 save

Write-Host "`n[SUCCESS] Photopodra is configured to start on boot!" -ForegroundColor Green
Write-Host " - URL: http://localhost:3001"
Write-Host " - Status: pm2 status"
Write-Host " - Logs:   pm2 logs photopodra-server"
Write-Host " - Stop:   pm2 stop photopodra-server"
