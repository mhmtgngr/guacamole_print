# =====================================================
# Uninstall Guacamole File Watcher
# Run as Administrator on the remote server
# =====================================================

param(
    [string]$InstallPath = "C:\GuacamoleFileWatcher"
)

Write-Host "=== Uninstalling Guacamole File Watcher ===" -ForegroundColor Cyan

# Step 1: Remove scheduled tasks (both old and new names)
Write-Host "[1/3] Removing scheduled tasks..." -ForegroundColor Yellow
foreach ($taskName in @("GuacamoleUserFileWatcher", "GuacamoleFileWatcher")) {
    $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($task) {
        Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        Write-Host "  Task '$taskName' removed" -ForegroundColor Green
    }
}

# Step 2: Kill running watcher processes
Write-Host "[2/3] Stopping running watchers..." -ForegroundColor Yellow
Get-Process powershell -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*FileWatcher*"
} | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "  Done" -ForegroundColor Green

# Step 3: Remove install directory
Write-Host "[3/3] Removing files..." -ForegroundColor Yellow
if (Test-Path $InstallPath) {
    Remove-Item -Path $InstallPath -Recurse -Force
    Write-Host "  Removed: $InstallPath" -ForegroundColor Green
} else {
    Write-Host "  Directory not found (already removed)" -ForegroundColor Gray
}

Write-Host "`n=== Uninstall Complete ===" -ForegroundColor Green
