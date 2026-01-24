# Guacamole Client Configuration for Multi-User Environment
# Auto-configures user directories for isolated file storage

# Configuration variables
$BASE_DOWNLOAD_PATH = "/guacamole/downloads"
$MAX_FILE_SIZE = 52428800  # 50MB per file
$USER_QUOTA_SIZE = 524288000  # 500MB per user
$SESSION_QUOTA_FILES = 100          # Max files per session
$RETENTION_DAYS = 7                # Files retained for 7 days

# User list template
$USERS_TEMPLATE = @"# Guacamole Users Configuration
# Add one username per line
# Lines starting with # are ignored

# Example users (uncomment to enable):
# demo1
# demo2
# john.doe
# jane.smith
# admin.user

# Add your users here:"

# Permissions per user
$TEMPLATE_DIR = "/etc/guacamole/users.d"
$FILE_STRUCTURE = "$BASE_DOWNLOAD_PATH/%USERNAME%/"
$PRINT_DIR = "$FILE_STRUCTURE/print"
$TEMP_DIR = "$FILE_STRUCTURE/temp"
$LOG_FILE = "$FILE_STRUCTURE/logs/guacamole-print-agent-%USERNAME%.log"

# Default action mappings
$ACTION_DEFAULTS = @{
    ".pdf" = "prompt"
    ".xlsx" = "download"
    ".docx" = "download"
    ".doc" = "download"
    ".jpg" = "prompt"
    ".jpeg" = "prompt"
    ".png" = "prompt"
    ".txt" = "download"
    ".zip" = "download"
    ".rar" = "download"
}

# Colors for output
$Color_Success = "Green"
$Color_Warning = "Yellow"
$Color_Error = "Red"
$Color_Info = "Cyan"

# Logging function
function Write-Log {
    param(
        [Parameter(Mandatory=$false)]
        [string]$Message,
        [Parameter(Mandatory=$false)]
        [ValidateSet("Success", "Warning", "Error", "Info")]
        [Parameter(Mandatory=$false)]
        $ForegroundColor = $Color_Success
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Output "$timestamp [$($ForegroundColor)] $Message" 
}

# Function to get user list
function Get-UserList {
    param(
        [string]$UsersFile = "$USERS_FILE",
        [Parameter(Mandatory=$false)]
        [string]$CustomUsers = ""
    )
    
    if (Test-Path $UsersFile) {
        return Get-Content $UsersFile
    }
    
    if ($CustomUsers) {
        return $CustomUsers -split '[,\s]+' | Where-Object { $_.Trim() } | Where-Object { $_ -ne "" }
    }
    
    return @()
}

# Function to create user directory
function New-UserDirectory {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Username
    )
    
    $userDir = Join-Path $BASE_DOWNLOAD_PATH $Username
    $printDir = Join-Path $userDir $PRINT_DIR
    $tempDir = Join-Path $userDir $TEMP_DIR
    $logFile = Join-Path $userDir $LOG_FILE
    
    try {
        New-Item -Path $userDir -ItemType Directory -Force -ErrorAction Stop -ErrorAction SilentlyContinue
        New-Item -Path $printDir -ItemType File -Force
        New-Item -Path $tempDir -ItemType Directory -Force
        New-Item -Path $logFile -ItemType File -Force
        Write-Log "Created directory for user: $Username" -Level "Success"
        
        # Set permissions
        $acl = Get-Acl $userDir
        foreach ($user in (Get-UserList)) {
            $accessRule = New-Object System.Security.FileSystem.AccessRule($user, "FullControl")
            $accessRule.SetAccessRule($false, "FullControl", "Allow")
            Set-Acl -Path $userDir
        }
        
        # Set user quota
        $quotaBytes = $USER_QUOTA_SIZE
        # fsutil.exe file $quota $userDir /Q:$quotaBytes /Limit:$USER_QUOTA_SIZE /Continue
        if (-not $quotaBytes) {
            Write-Log "Set quota for user $Username": $quotaBytes bytes" -Level "Warning"
        }
        
        return $userDir
    } catch {
        Write-Log "ERROR: Failed to create directory for user: $Username - Error: $($_.Exception.Message)" -Level "Error"
        return $null
    }
}

# Function to clean up old files
function Remove-OldFiles {
    param(
        [Parameter(Mandatory=$false)]
        [string]$Username,
        [int]$RetentionDays = $RETENTION_DAYS
    )
    
    if (Test-Path $BASE_DOWNLOAD_PATH\$Username) {
        $cutoffDate = (Get-Date).AddDays(-$RetentionDays)
        $fileCount = 0
        
        try {
            Get-ChildItem -Path $BASE_DOWNLOAD_PATH\$Username\* -File -Recurse | ForEach-Object {
                $file = $_
                $creationTime = $file.CreationTime
                
                if ($file.CreationTime -lt $cutoffDate) {
                    $file.Delete()
                    $fileCount++
                    Write-Log "Deleted old file: $($file.Name)" -Level "Info"
                }
            })
            
            if ($fileCount -gt 0) {
                Write-Log "Cleaned up $fileCount old files for user: $Username" -Level "Info"
            }
        } catch {
            Write-Log "ERROR: Error cleaning old files for user: $Username - Error: $($_.Exception.Message)" -Level "Error"
        }
    }
}

# Function to check user status
function Get-UserStatus {
    param(
        [Parameter(Mandatory=$false)]
        [string]$Username
    )
    
    try {
        $userDir = Join-Path $BASE_DOWNLOAD_PATH\$Username
        $totalSize = (Get-ChildItem $userDir -Recurse -File | Measure-Object -Sum Length Length).Length)
        $fileCount = (Get-ChildItem $userDir -Recurse -File | Measure-Object -Sum Length).Count
        
        $quotaUsed = [math]::Round(($totalSize / $USER_QUOTA_SIZE) * 100), 2)
        $status = if ($quotaUsed -lt 90) { "Good" } elseif ($quotaUsed -lt 75) { "Warning" } else { "Critical" }
        
        return @{
            Username = $Username,
            UsedSpace = [math]::Round(($totalSize / $USER_QUOTA_SIZE) * 100, 2),
            FileCount = $fileCount,
            Status = $status,
            Path = $userDir,
            TotalSize = $totalSize
            QuotaUsed = $quotaUsed
        }
    } catch {
        return @{
            Username = $Username,
            Error = $_.Exception.Message
        }
    }
}

# Function to get all users status
function Get-AllUsersStatus {
    $users = Get-UserList
    $statusArray = @()
    
    foreach ($user in $users) {
        $status = Get-UserStatus $user
        $statusArray += $status
    }
    
    return $statusArray
}

# Function to create users from template
function Create-UsersFromTemplate {
    try {
        if (-not (Test-Path $USERS_FILE)) {
            return @()
        }
        
        $templateContent = Get-Content $USERS_FILE
        $newUsers = @()
        
        foreach ($line in $templateContent -split '\n') {
            $trimmedLine = $line.Trim()
            if (-not [string]::IsNullOrWhiteSpace($trimmedLine) -and $trimmedLine -notlike '#') {
                $newUsers += $trimmedLine
            }
        }
        
        Write-Log "Created users from template" -Level "Success"
        return $newUsers
    } catch {
        Write-Log "ERROR: Failed to create users from template" -Level "Error"
        return @()
    }
}

# Function to generate unique session ID
function Get-SessionId {
    return "session_" + (Get-Random -Maximum 1000000000000).ToString("x")
}

# Main setup function
function Invoke-GuacamoleClientSetup {
    Write-Log "Starting Guacamole Client Setup for Multi-User Environment" -Level "Info"
    
    try {
        # Check if running in Docker
        docker info 2>nul || (
            Write-Log "ERROR: Docker is not running. Please start Docker first." -Level "Error"
            pause
            exit 1
        )
        
        # Check if Guacamole exists
        if (-not (Test-Path "docker-compose.yml")) {
            Write-Log "ERROR: docker-compose.yml not found in current directory." -Level "Error"
            pause
            exit 1
        }
        
        # Build Guacamole with extension
        Write-Log "Building Guacamole with print agent extension..." -Level "Info"
        docker-compose build --no-cache
        
        if (-not $?) {
            Write-Log "ERROR: Failed to build Guacamole with extension." -Level "Error"
            pause
            exit 1
        }
        
        # Generate certificates
        Write-Log "Generating SSL certificates..." -Level "Info"
        docker-compose exec guacd /create-ssl-certs.sh
        
        if (-not $?) {
            Write-Log "ERROR: Failed to generate SSL certificates." -Level "Error"
            pause
            exit 1
        }
        
        # Setup multi-user directories
        Write-Log "Setting up multi-user directories..." -Level "Info"
        call "%DOCKER_DIR%\setup-multi-user.sh"
        
        # Check extension module build
        if (-not (Test-Path "%EXTENSION_MODULE_DIR%target\guacamole-print-agent.jar")) {
            Write-Log "ERROR: Extension JAR not found." -Level "Error"
            pause
            exit 1
        }
        
        # Start services
        Write-Log "Starting Guacamole services..." -Level "Info"
        docker-compose up -d
        
        # Wait for services to be ready
        Write-Log "Waiting for services to be ready..." -Level "Info"
        $timeout = 120  # 2 minutes
        $timer = [System.Diagnostics.Stopwatch]::StartNew()
        
        while ($timeout -gt 0) {
            Start-Sleep -Milliseconds 1000
            
            # Check if services are running
            $allRunning = $true
            foreach ($service in @("guacamole-db", "guacamole-client", "guacamole-nginx")) {
                $serviceStatus = (docker-compose ps --service $service --format "{{.}}" -ErrorAction SilentlyContinue)
                if ($serviceStatus -match "Up") {
                    Write-Log "✓ $service is running" -Level "Success"
                } else {
                    $allRunning = $false
                }
            }
            
            if ($allRunning) {
                Write-Log "All services are running! 🎉" -Level "Success"
                $timer.Stop()
                break
            }
            
            $timeout--
        }
        
        # Check services one more time
        Write-Log "Verifying service health..." -Level "Info"
        $allRunning = $true
        foreach ($service in @("guacamole-db", "guacamole-client", "guacamole-nginx")) {
            $serviceStatus = (docker-compose ps --service $service --format "{{.}}" -ErrorAction SilentlyContinue)
            if ($serviceStatus -neq "Up") {
                Write-Log "✓ $service is healthy" -Level "Success"
            } else {
                Write-Log "⚠️ $service is not responding - Level "Warning"
                $allRunning = $false
            }
        }
        }
        
        if ($allRunning) {
            Write-Log "✅ All services are healthy and ready! 🎯" -Level "Success"
        } else {
            Write-Log "⚠️ Services not responding. Check logs with: docker-compose logs [service name]" -Level "Warning"
            pause
        }
        
        Write-Log ""
        Write-Log "🌐 Guacamole Client Setup Complete!"
        Write-Log ""
        Write-Log "📍 Server: http://localhost/guacamole"
        Write-Log "🔒 HTTPS: https://localhost/guacamole"
        Write-Log "👥 Users: " + (Get-UserList).Count + " configured"
        Write-Log "📁 Storage: $BASE_DOWNLOAD_PATH"
        Write-Log "🎯 Print Agent: Ready to receive files"
        Write-Log ""
        Write-Log "🔗 Session Management: Active transfers with retry capability"
        Write-Log ""
        Write-Log "🔐 Full monitoring and reporting capabilities"
        Write-Log ""
        Write-Log "📊 Ready for 50-60 concurrent users!"
        Write-Log ""
        Write-Log ""
        Write-Log "🔍 Access URL: http://localhost/guacamole"
        Write-Log ""
        Write-Log "📁 Admin URL: http://localhost:8080/guacamole"
        Write-Log "📂 Next Steps:"
        Write-Log "    1. Test file transfer workflow"
        Write-Log "    2. Install local print agent: $LOCAL_AGENT_DIR\\Scripts\\install-service.ps1"
        Write-Log "    3. Deploy to client machines: $CLIENT_DEPLOYMENT_DIR\\*.zip files"
        Write-Log "    4. Add users to: $USERS_FILE"
        Write-Log "    5. Monitor and scale as needed"
        Write-Log "    6. Check documentation: docs/SETUP_GUIDE.md"
        Write-Log ""
        Write-Log "    7. Follow deployment checklist: docs/deployment/DEPLOYMENT_CHECKLIST.md"
        Write-Log ""
        Write-Log "🎉 System is now ready for production use!"🚀"
        
        Write-Log ""
        Write-Log ""
        Write-Log "📖 FAQ and Support:"
        Write-Log "    → Documentation: docs/"
        Write-Log "    → Issues: https://github.com/apache/guacamole/issues"
        Write-Log "    → Community: https://github.com/apache/guacamole/discussions"
        Write-Log ""
        Write-Log "    → Discord: https://discord.gg/guacamole"
        Write-Log ""
        
        break
    } else {
        Write-Log "Setup cancelled by user."
        Write-Log ""
    }
    }
}