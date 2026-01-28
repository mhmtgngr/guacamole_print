# =====================================================
# Install Guacamole User File Watcher on Remote RDP Server
# Run this script ONCE as Administrator on the remote server
# =====================================================

param(
    [string]$InstallPath = "C:\GuacamoleFileWatcher",
    [string]$WatchUser = ""
)

Write-Host "=== Installing Guacamole User File Watcher ===" -ForegroundColor Cyan

# Step 1: Create install directory
Write-Host "`n[1/4] Creating install directory..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
Write-Host "  Created: $InstallPath" -ForegroundColor Green

# Step 2: Copy watcher script
Write-Host "[2/4] Copying watcher script..." -ForegroundColor Yellow
$scriptSource = Join-Path $PSScriptRoot "UserFileWatcher.ps1"
$scriptDest = Join-Path $InstallPath "UserFileWatcher.ps1"

if (Test-Path $scriptSource) {
    Copy-Item $scriptSource $scriptDest -Force
} else {
    Write-Host "  ERROR: UserFileWatcher.ps1 not found in script directory" -ForegroundColor Red
    Write-Host "  Expected: $scriptSource" -ForegroundColor Red
    exit 1
}
Write-Host "  Installed: $scriptDest" -ForegroundColor Green

# Step 3: Create VBS launcher (runs hidden, no console window)
Write-Host "[3/4] Creating silent launcher..." -ForegroundColor Yellow
$vbsPath = Join-Path $InstallPath "StartUserWatcher.vbs"
$vbsContent = @"
Set objShell = CreateObject("WScript.Shell")
objShell.Run "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File ""$scriptDest""", 0, False
"@
Set-Content -Path $vbsPath -Value $vbsContent
Write-Host "  Created: $vbsPath" -ForegroundColor Green

# Step 4: Create scheduled task for all users at logon AND session reconnect
Write-Host "[4/4] Creating scheduled task..." -ForegroundColor Yellow

$taskName = "GuacamoleUserFileWatcher"

# Remove existing task if present
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbsPath`""

# Trigger on logon (new session)
$triggerLogon = New-ScheduledTaskTrigger -AtLogOn

# Trigger on session connect/reconnect (RDP reconnect)
$triggerClass = Get-CimClass -ClassName MSFT_TaskSessionStateChangeTrigger -Namespace Root/Microsoft/Windows/TaskScheduler
$triggerReconnect = New-CimInstance -CimClass $triggerClass -ClientOnly
$triggerReconnect.StateChange = 8  # Session reconnect (TASK_SESSION_STATE_CHANGE_TYPE: 8 = remote connect)

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Days 365) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -GroupId "BUILTIN\Users" -RunLevel Limited

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($triggerLogon, $triggerReconnect) -Settings $settings -Principal $principal -Description "Watches user profile folders and copies new files to GuacamoleDrive for transfer" | Out-Null

Write-Host "  Task '$taskName' created (runs at logon + RDP reconnect for all users)" -ForegroundColor Green

# Summary
Write-Host "`n=== Installation Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "How it works:" -ForegroundColor Cyan
Write-Host "  1. User logs in via Guacamole RDP"
Write-Host "  2. UserFileWatcher starts automatically"
Write-Host "  3. Monitors entire user profile for new/modified files"
Write-Host "  4. Skips system folders (AppData, .cache, etc.)"
Write-Host "  5. Waits for file to finish writing (stability check)"
Write-Host "  6. Copies complete file to \\tsclient\GuacamoleDrive\Download"
Write-Host "  7. Guacamole transfers it to client -> Print Agent shows dialog"
Write-Host ""
Write-Host "Monitored locations include:" -ForegroundColor Cyan
Write-Host "  - Desktop, Documents, Downloads"
Write-Host "  - Any subfolder under user profile"
Write-Host "  - Excludes: AppData, .cache, node_modules, Temp, etc."
Write-Host ""
Write-Host "To test now: Start-ScheduledTask -TaskName '$taskName'" -ForegroundColor Yellow
Write-Host "To uninstall: .\Uninstall-FileWatcher.ps1" -ForegroundColor Yellow
Write-Host ""
