# =====================================================
# Guacamole User File Watcher
# Monitors all folders under a user profile for new files
# and copies them to GuacamoleDrive for client transfer
# =====================================================

param(
    [string]$WatchFolder = "$env:USERPROFILE",
    [string]$TargetDrive = "\\tsclient\GuacamoleDrive",
    [int]$PollIntervalSeconds = 2,
    [int]$StabilityCheckMs = 500,
    [int]$MaxFileAgeSec = 60,
    [string[]]$IgnoreExtensions = @('.crdownload', '.tmp', '.partial', '.part', '.downloading', '.lock', '.log', '.etl'),
    [string[]]$IgnoreFolders = @('AppData', '.cache', '.vscode', 'node_modules', '__pycache__', '.git', 'Temp'),
    [int64]$MinFileSizeBytes = 100,
    [int64]$MaxFileSizeMB = 500
)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Guacamole User File Watcher" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Watching : $WatchFolder (recursive)" -ForegroundColor Green
Write-Host "Target   : $TargetDrive" -ForegroundColor Green
Write-Host "Poll     : ${PollIntervalSeconds}s" -ForegroundColor Green
Write-Host "Max Age  : ${MaxFileAgeSec}s" -ForegroundColor Green
Write-Host "Min Size : $MinFileSizeBytes bytes" -ForegroundColor Green
Write-Host "Max Size : ${MaxFileSizeMB} MB" -ForegroundColor Green
Write-Host "Ignored  : $($IgnoreFolders -join ', ')" -ForegroundColor Gray
Write-Host "============================================" -ForegroundColor Cyan

# Verify target drive is accessible
if (-not (Test-Path $TargetDrive)) {
    Write-Host "ERROR: Cannot access $TargetDrive" -ForegroundColor Red
    Write-Host "Make sure drive redirection is enabled in Guacamole connection." -ForegroundColor Red
    Write-Host "Retrying every 10 seconds..." -ForegroundColor Yellow
    while (-not (Test-Path $TargetDrive)) {
        Start-Sleep -Seconds 10
    }
    Write-Host "Target drive now accessible!" -ForegroundColor Green
}
Write-Host "Target drive accessible: OK" -ForegroundColor Green

# Verify watch folder exists
if (-not (Test-Path $WatchFolder)) {
    Write-Host "ERROR: Watch folder not found: $WatchFolder" -ForegroundColor Red
    exit 1
}
Write-Host "Watch folder exists: OK" -ForegroundColor Green
Write-Host ""
Write-Host "Waiting for new files... (Ctrl+C to stop)" -ForegroundColor Yellow
Write-Host ""

$maxSizeBytes = $MaxFileSizeMB * 1024 * 1024

function Test-FileLocked {
    param([string]$Path)
    try {
        $stream = [System.IO.File]::Open($Path, 'Open', 'Read', 'None')
        $stream.Close()
        return $false
    } catch {
        return $true
    }
}

function Test-IgnoredPath {
    param([string]$FullPath)
    foreach ($folder in $IgnoreFolders) {
        if ($FullPath -match [regex]::Escape("\$folder\")) {
            return $true
        }
    }
    return $false
}

# Track files we've already processed (name|size|lastwrite)
$processedFiles = @{}

# Main polling loop
while ($true) {
    try {
        # Check target drive is still accessible
        if (-not (Test-Path $TargetDrive)) {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Target drive lost, waiting..." -ForegroundColor Yellow
            Start-Sleep -Seconds 5
            continue
        }

        # Scan for files recursively
        $files = Get-ChildItem -Path $WatchFolder -File -Recurse -ErrorAction SilentlyContinue |
            Where-Object {
                # Skip ignored extensions
                $_.Extension.ToLower() -notin $IgnoreExtensions -and
                # Skip too small files
                $_.Length -ge $MinFileSizeBytes -and
                # Skip too large files
                $_.Length -le $maxSizeBytes -and
                # Skip ignored folder paths
                -not (Test-IgnoredPath $_.FullName)
            }

        foreach ($file in $files) {
            $path = $file.FullName
            $key = "$($file.FullName)|$($file.Length)|$($file.LastWriteTime.Ticks)"

            # Skip if already processed
            if ($processedFiles.ContainsKey($key)) { continue }

            # Skip files older than MaxFileAgeSec
            $age = (Get-Date) - $file.LastWriteTime
            if ($age.TotalSeconds -gt $MaxFileAgeSec) {
                $processedFiles[$key] = $true
                continue
            }

            # Check if file is still being written
            if (Test-FileLocked -Path $path) {
                continue
            }

            # Check size stability
            $size1 = $file.Length
            Start-Sleep -Milliseconds $StabilityCheckMs
            $file.Refresh()
            $size2 = $file.Length

            if ($size1 -ne $size2) {
                continue
            }

            # File is stable and unlocked - copy it
            $relativePath = $file.DirectoryName.Replace($WatchFolder, '').TrimStart('\')
            $displayName = if ($relativePath) { "$relativePath\$($file.Name)" } else { $file.Name }

            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] NEW: $displayName ($($file.Length) bytes)" -ForegroundColor White

            # Create subdirectory on target if needed
            $destDir = $TargetDrive
            if ($relativePath) {
                $destDir = Join-Path $TargetDrive $relativePath
                if (-not (Test-Path $destDir)) {
                    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
                }
            }

            $destPath = Join-Path $destDir $file.Name

            try {
                Copy-Item -Path $path -Destination $destPath -Force
                Write-Host "  -> COPIED to $destPath" -ForegroundColor Green
                $processedFiles[$key] = $true
            } catch {
                Write-Host "  -> ERROR: $($_.Exception.Message)" -ForegroundColor Red
            }
        }

        # Cleanup old entries from processedFiles to prevent memory growth
        if ($processedFiles.Count -gt 10000) {
            $processedFiles.Clear()
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Cleared file tracking cache" -ForegroundColor Gray
        }

    } catch {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Error: $($_.Exception.Message)" -ForegroundColor Red
    }

    Start-Sleep -Seconds $PollIntervalSeconds
}
