# =====================================================
# Guacamole User File Watcher
# Monitors all folders under a user profile for new files
# and copies them to GuacamoleDrive for client transfer
# =====================================================

param(
    [string]$WatchFolder = "$env:USERPROFILE",
    [string]$TargetDrive = "\\tsclient\GuacamoleDrive\Download",
    [int]$PollIntervalSeconds = 2,
    [int]$StabilityCheckMs = 500,
    [int]$MaxFileAgeSec = 60,
    [string[]]$IgnoreExtensions = @('.crdownload', '.tmp', '.partial', '.part', '.downloading', '.lock', '.log', '.etl'),
    [string[]]$IgnoreFolders = @('AppData', '.cache', '.vscode', 'node_modules', '__pycache__', '.git', 'Temp'),
    [int64]$MinFileSizeBytes = 100,
    [int64]$MaxFileSizeMB = 500,
    [switch]$Debug
)

# Debug logging helper
function Write-Debug-Log {
    param([string]$Message, [string]$Stage = "INFO")
    if ($Debug) {
        $color = switch ($Stage) {
            "SCAN"     { "DarkCyan" }
            "FILTER"   { "DarkGray" }
            "SKIP"     { "DarkYellow" }
            "CHECK"    { "Magenta" }
            "COPY"     { "Cyan" }
            "ERROR"    { "Red" }
            default    { "Gray" }
        }
        Write-Host "[$(Get-Date -Format 'HH:mm:ss.fff')] [$Stage] $Message" -ForegroundColor $color
    }
}

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
Write-Host "Debug    : $($Debug.IsPresent)" -ForegroundColor Gray
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
        Write-Debug-Log "--- Poll cycle start (tracked: $($processedFiles.Count) files) ---" "SCAN"

        # Stage 1: Check target drive
        if (-not (Test-Path $TargetDrive)) {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Target drive lost, waiting..." -ForegroundColor Yellow
            Write-Debug-Log "STAGE 1 FAILED: Target drive not accessible" "ERROR"
            Start-Sleep -Seconds 5
            continue
        }
        Write-Debug-Log "STAGE 1 OK: Target drive accessible" "SCAN"

        # Stage 2: Scan for files recursively
        Write-Debug-Log "STAGE 2: Scanning $WatchFolder recursively..." "SCAN"
        $allFiles = Get-ChildItem -Path $WatchFolder -File -Recurse -ErrorAction SilentlyContinue
        Write-Debug-Log "STAGE 2: Found $($allFiles.Count) total files" "SCAN"

        # Stage 3: Apply filters
        $files = $allFiles | Where-Object {
                $dominated = $false
                $reason = ""

                if ($_.Extension.ToLower() -in $IgnoreExtensions) {
                    $reason = "ignored extension: $($_.Extension)"
                    $dominated = $true
                }
                elseif ($_.Length -lt $MinFileSizeBytes) {
                    $reason = "too small: $($_.Length) bytes"
                    $dominated = $true
                }
                elseif ($_.Length -gt $maxSizeBytes) {
                    $reason = "too large: $([math]::Round($_.Length/1MB, 1)) MB"
                    $dominated = $true
                }
                elseif (Test-IgnoredPath $_.FullName) {
                    $reason = "ignored folder path"
                    $dominated = $true
                }

                if ($dominated) {
                    Write-Debug-Log "STAGE 3 FILTER: $($_.Name) -> $reason" "FILTER"
                }
                -not $dominated
            }

        Write-Debug-Log "STAGE 3: $($files.Count) files passed filters" "SCAN"

        foreach ($file in $files) {
            $path = $file.FullName
            $key = "$($file.FullName)|$($file.Length)|$($file.LastWriteTime.Ticks)"

            # Stage 4: Check if already processed
            if ($processedFiles.ContainsKey($key)) {
                Write-Debug-Log "STAGE 4 SKIP: $($file.Name) -> already processed" "SKIP"
                continue
            }

            # Stage 5: Check file age
            $age = (Get-Date) - $file.LastWriteTime
            if ($age.TotalSeconds -gt $MaxFileAgeSec) {
                Write-Debug-Log "STAGE 5 SKIP: $($file.Name) -> too old ($([math]::Round($age.TotalSeconds))s > ${MaxFileAgeSec}s)" "SKIP"
                $processedFiles[$key] = $true
                continue
            }
            Write-Debug-Log "STAGE 5 OK: $($file.Name) -> age $([math]::Round($age.TotalSeconds))s" "CHECK"

            # Stage 6: Check if file is locked
            if (Test-FileLocked -Path $path) {
                Write-Debug-Log "STAGE 6 WAIT: $($file.Name) -> file is locked (still being written)" "CHECK"
                continue
            }
            Write-Debug-Log "STAGE 6 OK: $($file.Name) -> not locked" "CHECK"

            # Stage 7: Check size stability
            $size1 = $file.Length
            Start-Sleep -Milliseconds $StabilityCheckMs
            $file.Refresh()
            $size2 = $file.Length

            if ($size1 -ne $size2) {
                Write-Debug-Log "STAGE 7 WAIT: $($file.Name) -> size changing ($size1 -> $size2)" "CHECK"
                continue
            }
            Write-Debug-Log "STAGE 7 OK: $($file.Name) -> size stable ($size2 bytes)" "CHECK"

            # Stage 8: Prepare copy
            $relativePath = $file.DirectoryName.Replace($WatchFolder, '').TrimStart('\')
            $displayName = if ($relativePath) { "$relativePath\$($file.Name)" } else { $file.Name }

            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] NEW: $displayName ($($file.Length) bytes)" -ForegroundColor White
            Write-Debug-Log "STAGE 8: Preparing copy for $displayName" "COPY"

            # Create subdirectory on target if needed
            $destDir = $TargetDrive
            if ($relativePath) {
                $destDir = Join-Path $TargetDrive $relativePath
                if (-not (Test-Path $destDir)) {
                    Write-Debug-Log "STAGE 8: Creating directory $destDir" "COPY"
                    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
                }
            }

            $destPath = Join-Path $destDir $file.Name

            # Stage 9: Copy file
            try {
                Write-Debug-Log "STAGE 9: Copying $path -> $destPath" "COPY"
                Copy-Item -Path $path -Destination $destPath -Force
                Write-Host "  -> COPIED to $destPath" -ForegroundColor Green
                Write-Debug-Log "STAGE 9 OK: Copy successful ($($file.Length) bytes)" "COPY"
                $processedFiles[$key] = $true
            } catch {
                Write-Host "  -> ERROR: $($_.Exception.Message)" -ForegroundColor Red
                Write-Debug-Log "STAGE 9 FAILED: $($_.Exception.Message)" "ERROR"
            }
        }

        # Cleanup old entries from processedFiles to prevent memory growth
        if ($processedFiles.Count -gt 10000) {
            $processedFiles.Clear()
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Cleared file tracking cache" -ForegroundColor Gray
        }

    } catch {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Error: $($_.Exception.Message)" -ForegroundColor Red
        Write-Debug-Log "LOOP ERROR: $($_.Exception.Message)`n$($_.ScriptStackTrace)" "ERROR"
    }

    Start-Sleep -Seconds $PollIntervalSeconds
}
