# PowerShell script to allow mobile access to development servers
# Run this script as Administrator

Write-Host "Configuring Windows Firewall for Mobile Access..." -ForegroundColor Cyan

# Allow Vite Dev Server (Port 8080)
$rule8080 = Get-NetFirewallRule -DisplayName "Xrozen Vite Dev Server" -ErrorAction SilentlyContinue
if ($null -ne $rule8080) {
    Write-Host "Vite Dev Server rule already exists (Port 8080)" -ForegroundColor Green
}
else {
    New-NetFirewallRule -DisplayName "Xrozen Vite Dev Server" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow | Out-Null
    Write-Host "Added Vite Dev Server rule (Port 8080)" -ForegroundColor Green
}

# Allow Backend API Server (Port 3001)
$rule3001 = Get-NetFirewallRule -DisplayName "Xrozen Backend API Server" -ErrorAction SilentlyContinue
if ($null -ne $rule3001) {
    Write-Host "Backend API Server rule already exists (Port 3001)" -ForegroundColor Green
}
else {
    New-NetFirewallRule -DisplayName "Xrozen Backend API Server" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow | Out-Null
    Write-Host "Added Backend API Server rule (Port 3001)" -ForegroundColor Green
}

Write-Host ""
Write-Host "Firewall configuration complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Mobile Access Information:" -ForegroundColor Yellow
Write-Host "   Frontend: http://192.168.1.8:8080" -ForegroundColor White
Write-Host "   Backend:  http://192.168.1.8:3001/api" -ForegroundColor White
Write-Host ""
Write-Host "Make sure both your computer and mobile are on the same WiFi network!" -ForegroundColor Yellow
