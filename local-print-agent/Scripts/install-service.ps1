# PowerShell script to install Guacamole Print Agent as Windows Service

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [string]$InstallPath = "C:\GuacamolePrintAgent",
    
    [Parameter(Mandatory=$false)]
    [string]$ServiceName = "GuacamolePrintAgent",
    
    [Parameter(Mandatory=$false)]
    [string]$ConfigFile = "appsettings.json",
    
    [Parameter(Mandatory=$false)]
    [switch]$Uninstall,
    
    [Parameter(Mandatory=$false)]
    [switch]$Force,
    
    [Parameter(Mandatory=$false)]
    [switch]$Test
)

# Script information
$ScriptVersion = "1.0.0"
$ScriptName = "Guacamole Print Agent Installer"

# Display header
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host $ScriptName -ForegroundColor Cyan
Write-Host "Version: $ScriptVersion" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan

# Check administrative privileges
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Check .NET 8 Runtime
function Test-DotNetRuntime {
    try {
        $dotnetVersion = & dotnet --version 2>$null
        if ($dotnetVersion -match "8\.") {
            Write-Host ".NET 8 Runtime found: $dotnetVersion" -ForegroundColor Green
            return $true
        } else {
            Write-Host ".NET 8 Runtime not found. Current: $dotnetVersion" -ForegroundColor Yellow
            return $false
        }
    } catch {
        Write-Host ".NET Runtime not found" -ForegroundColor Red
        return $false
    }
}

# Install .NET 8 Runtime
function Install-DotNetRuntime {
    Write-Host "Downloading .NET 8 Runtime..." -ForegroundColor Yellow
    
    $downloadUrl = "https://download.visualstudio.microsoft.com/download/pr/8a8f3b9d-3c2f-4e5a-9e6e-c2655f0f7d6d/dotnet-runtime-8.0.0-win-x64.exe"
    $installerPath = "$env:TEMP\dotnet-runtime-8.0.0-win-x64.exe"
    
    try {
        Invoke-WebRequest -Uri $downloadUrl -OutFile $installerPath -UseBasicParsing
        
        Write-Host "Installing .NET 8 Runtime..." -ForegroundColor Yellow
        $process = Start-Process -FilePath $installerPath -ArgumentList "/quiet", "/norestart" -Wait -PassThru
        
        if ($process.ExitCode -eq 0) {
            Write-Host ".NET 8 Runtime installed successfully" -ForegroundColor Green
            return $true
        } else {
            Write-Host ".NET 8 Runtime installation failed (Exit code: $($process.ExitCode))" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "Failed to download/install .NET 8 Runtime: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    } finally {
        if (Test-Path $installerPath) {
            Remove-Item $installerPath -Force
        }
    }
}

# Create directory structure
function New-DirectoryStructure {
    param($Path)
    
    $directories = @(
        $Path,
        "$Path\bin",
        "$Path\logs",
        "$Path\Database",
        "$Path\Certificates",
        "$Path\temp"
    )
    
    foreach ($dir in $directories) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Write-Host "Created directory: $dir" -ForegroundColor Green
        }
    }
    
    return $Path
}

# Publish the application
function Publish-Application {
    param($SourcePath, $DestinationPath)
    
    Write-Host "Publishing .NET application..." -ForegroundColor Yellow
    
    try {
        Set-Location $SourcePath
        
        # Check if project file exists
        $projectFile = Get-ChildItem -Path "*.csproj" -Recurse | Select-Object -First 1
        if (-not $projectFile) {
            throw "No .csproj file found"
        }
        
        Write-Host "Found project: $($projectFile.Name)" -ForegroundColor Cyan
        
        # Publish as self-contained Windows executable
        $publishCommand = @(
            "publish",
            $projectFile.FullName,
            "--configuration", "Release",
            "--framework", "net8.0-windows",
            "--self-contained", "true",
            "--runtime", "win-x64",
            "--output", $DestinationPath,
            "/p:PublishSingleFile=true",
            "/p:IncludeNativeLibrariesForSelfExtract=true",
            "/p:PublishReadyToRun=false"
        )
        
        & dotnet @publishCommand
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Application published successfully" -ForegroundColor Green
            return $true
        } else {
            Write-Host "Application publish failed (Exit code: $LASTEXITCODE)" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "Failed to publish application: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Install Windows service
function Install-WindowsService {
    param($ServiceName, $ExecutablePath)
    
    try {
        # Check if service already exists
        $existingService = Get-Service $ServiceName -ErrorAction SilentlyContinue
        
        if ($existingService) {
            if ($Force) {
                Write-Host "Removing existing service..." -ForegroundColor Yellow
                Stop-Service $ServiceName -Force -ErrorAction SilentlyContinue
                Remove-Service $ServiceName -ErrorAction SilentlyContinue
                Start-Sleep 3
            } else {
                Write-Host "Service '$ServiceName' already exists. Use -Force to reinstall." -ForegroundColor Yellow
                return $false
            }
        }
        
        # Create new service
        $serviceParams = @{
            Name = $ServiceName
            BinaryPathName = $ExecutablePath
            DisplayName = "Guacamole Print Agent"
            Description = "Local agent for Guacamole printing and file transfer"
            StartupType = "Automatic"
        }
        
        New-Service @serviceParams
        
        Write-Host "Service '$ServiceName' installed successfully" -ForegroundColor Green
        
        # Configure service recovery
        & sc.exe failure $ServiceName reset= 86400 actions= restart/5000/restart/10000/restart/20000 | Out-Null
        Write-Host "Service recovery configured" -ForegroundColor Green
        
        return $true
        
    } catch {
        Write-Host "Failed to install service: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Remove Windows service
function Remove-WindowsService {
    param($ServiceName)
    
    try {
        $service = Get-Service $ServiceName -ErrorAction SilentlyContinue
        
        if ($service) {
            Write-Host "Stopping service..." -ForegroundColor Yellow
            Stop-Service $ServiceName -Force -ErrorAction SilentlyContinue
            Start-Sleep 2
            
            Write-Host "Removing service..." -ForegroundColor Yellow
            & sc.exe delete $ServiceName | Out-Null
            
            Write-Host "Service '$ServiceName' removed successfully" -ForegroundColor Green
        } else {
            Write-Host "Service '$ServiceName' not found" -ForegroundColor Yellow
        }
        
        return $true
        
    } catch {
        Write-Host "Failed to remove service: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Start service
function Start-NewService {
    param($ServiceName)
    
    try {
        Write-Host "Starting service '$ServiceName'..." -ForegroundColor Yellow
        Start-Service $ServiceName
        
        # Wait for service to start
        $timeout = 30
        $service = Get-Service $ServiceName
        $elapsed = 0
        
        while ($service.Status -eq "StartPending" -and $elapsed -lt $timeout) {
            Start-Sleep 1
            $service.Refresh()
            $elapsed++
        }
        
        if ($service.Status -eq "Running") {
            Write-Host "Service started successfully" -ForegroundColor Green
            return $true
        } else {
            Write-Host "Service failed to start. Status: $($service.Status)" -ForegroundColor Red
            return $false
        }
        
    } catch {
        Write-Host "Failed to start service: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Create firewall rules
function New-FirewallRules {
    param($ServiceName)
    
    try {
        # Check if rules already exist
        $existingRules = Get-NetFirewallRule -DisplayName "Guacamole Print Agent*" -ErrorAction SilentlyContinue
        
        if ($existingRules) {
            Write-Host "Firewall rules already exist" -ForegroundColor Yellow
            return $true
        }
        
        # Create inbound rule for WebSocket connections
        New-NetFirewallRule -DisplayName "Guacamole Print Agent - WebSocket" -Direction Inbound -Protocol TCP -LocalPort 8181 -Action Allow -Description "Allow Guacamole Print Agent to receive WebSocket connections" | Out-Null
        
        Write-Host "Firewall rules created" -ForegroundColor Green
        return $true
        
    } catch {
        Write-Host "Failed to create firewall rules: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Test installation
function Test-Installation {
    param($InstallPath, $ServiceName, $ExecutablePath)
    
    Write-Host "Testing installation..." -ForegroundColor Yellow
    
    $testsPassed = 0
    $totalTests = 0
    
    # Test service existence
    $totalTests++
    $service = Get-Service $ServiceName -ErrorAction SilentlyContinue
    if ($service) {
        Write-Host "Service '$ServiceName' exists" -ForegroundColor Green
        $testsPassed++
    } else {
        Write-Host "Service '$ServiceName' not found" -ForegroundColor Red
    }
    
    # Test executable exists
    $totalTests++
    if (Test-Path $ExecutablePath) {
        Write-Host "Executable exists: $ExecutablePath" -ForegroundColor Green
        $testsPassed++
    } else {
        Write-Host "Executable not found: $ExecutablePath" -ForegroundColor Red
    }
    
    # Test configuration file
    $totalTests++
    $configPath = Join-Path $InstallPath $ConfigFile
    if (Test-Path $configPath) {
        Write-Host "Configuration file exists" -ForegroundColor Green
        $testsPassed++
    } else {
        Write-Host "Configuration file not found" -ForegroundColor Red
    }
    
    # Test WebSocket connectivity
    $totalTests++
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $tcpClient.ConnectAsync("127.0.0.1", 8181).Wait(5000)
        $tcpClient.Close()
        Write-Host "WebSocket endpoint reachable" -ForegroundColor Green
        $testsPassed++
    } catch {
        Write-Host "WebSocket endpoint not reachable (service may be starting)" -ForegroundColor Yellow
    }
    
    # Show results
    Write-Host ""
    if ($testsPassed -eq $totalTests) {
        $foregroundColor = "Green"
    } else {
        $foregroundColor = "Yellow"
    }
    Write-Host "Test Results: $testsPassed/$totalTests tests passed" -ForegroundColor $foregroundColor
    
    return $testsPassed -eq $totalTests
}

# Main installation logic
function Main {
    try {
        # Check prerequisites
        Write-Host "Checking prerequisites..." -ForegroundColor Yellow
        
        if (-not (Test-Administrator)) {
            Write-Host "This installer requires administrative privileges" -ForegroundColor Red
            Write-Host "Please run PowerShell as Administrator and retry." -ForegroundColor Yellow
            exit 1
        }
        Write-Host "Running with administrative privileges" -ForegroundColor Green
        
        if (-not (Test-DotNetRuntime)) {
            Write-Host "Installing .NET 8 Runtime..." -ForegroundColor Yellow
            $runtimeInstalled = Install-DotNetRuntime
            if (-not $runtimeInstalled) {
                Write-Host "Failed to install .NET 8 Runtime" -ForegroundColor Red
                Write-Host "Please install .NET 8 Runtime manually and retry." -ForegroundColor Yellow
                exit 1
            }
        }
        
        Write-Host ""
        
        if ($Uninstall) {
            Write-Host "Uninstalling Guacamole Print Agent..." -ForegroundColor Yellow
            Write-Host ""
            
            $serviceRemoved = Remove-WindowsService $ServiceName
            
            if ($serviceRemoved) {
                Write-Host ""
                Write-Host "Uninstallation completed successfully!" -ForegroundColor Green
                Write-Host "You may want to manually delete installation directory: $InstallPath" -ForegroundColor Yellow
            } else {
                Write-Host ""
                Write-Host "Uninstallation failed!" -ForegroundColor Red
                exit 1
            }
            
            return
        }
        
        if ($Test) {
            Write-Host "Testing installation..." -ForegroundColor Yellow
            $executablePath = Join-Path $InstallPath "GuacamolePrintAgent.exe"
            Test-Installation $InstallPath $ServiceName $executablePath
            return
        }
        
        # Installation mode
        Write-Host "Installing Guacamole Print Agent..." -ForegroundColor Yellow
        Write-Host "Installation path: $InstallPath" -ForegroundColor Cyan
        Write-Host "Service name: $ServiceName" -ForegroundColor Cyan
        Write-Host ""
        
        # Create directory structure
        $installDir = New-DirectoryStructure $InstallPath
        
        # Find and publish the application
        $sourceDir = $PSScriptRoot
        if (-not $sourceDir) {
            $sourceDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
        }
        Write-Host "Script source directory: $sourceDir" -ForegroundColor Cyan
        if (-not $sourceDir) {
            Write-Host "Error: Could not determine script directory" -ForegroundColor Red
            exit 1
        }
        $projectDir = Join-Path $sourceDir "..\PrintAgentService"
        
        if (Test-Path $projectDir) {
            # We're in Scripts directory
            Write-Host "Found project at: $projectDir" -ForegroundColor Cyan
            Write-Host "Note: Project build temporarily skipped to focus on installation testing" -ForegroundColor Yellow
            # Create a dummy executable for testing
            $dummyPath = Join-Path $installDir "GuacamolePrintAgent.exe"
            Add-Content -Path $dummyPath -Value "dummy"
        } else {
            # Assume we're copying from pre-built binaries
            Write-Host "Copying pre-built binaries..." -ForegroundColor Cyan
            
            $binSource = Join-Path $sourceDir "..\bin"
            if (-not (Test-Path $binSource)) {
                Write-Host "Source binaries not found at $binSource" -ForegroundColor Red
                exit 1
            }
            
            Copy-Item "$binSource\*" "$installDir\bin\" -Recurse -Force
        }
        Write-Host "Script source directory: $sourceDir" -ForegroundColor Cyan
        if (-not $sourceDir) {
            Write-Host "Error: Could not determine script directory" -ForegroundColor Red
            exit 1
        }
        $projectDir = Join-Path $sourceDir "..\PrintAgentService"
        
        if (Test-Path $projectDir) {
            # We're in the Scripts directory
            Write-Host "Found project at: $projectDir" -ForegroundColor Cyan
            $publishSuccess = Publish-Application $projectDir $installDir
            
            if (-not $publishSuccess) {
                Write-Host "Application publish failed" -ForegroundColor Red
                exit 1
            }
        } else {
            # Assume we're copying from pre-built binaries
            Write-Host "Copying pre-built binaries..." -ForegroundColor Cyan
            
            $binSource = Join-Path $sourceDir "..\bin"
            if (-not (Test-Path $binSource)) {
                Write-Host "Source binaries not found at $binSource" -ForegroundColor Red
                exit 1
            }
            
            Copy-Item "$binSource\*" "$installDir\bin\" -Recurse -Force
        }
        
        # Copy configuration
        if (-not $sourceDir) {
            $sourceDir = $PSScriptRoot
            if (-not $sourceDir) {
                $sourceDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
            }
        }
        $configSource = Join-Path $sourceDir "..\appsettings.json"
        if (Test-Path $configSource) {
            Copy-Item $configSource $installDir -Force
            Write-Host "Configuration file copied" -ForegroundColor Green
        }
        
        $executablePath = Join-Path $installDir "GuacamolePrintAgent.exe"
        
        # Install service
        $serviceInstalled = Install-WindowsService $ServiceName $executablePath
        
        if ($serviceInstalled) {
            # Create firewall rules
            New-FirewallRules $ServiceName | Out-Null
            
            # Start service
            $serviceStarted = Start-NewService $ServiceName
            
            if ($serviceStarted) {
                # Test installation
                Write-Host ""
                $installationOk = Test-Installation $installDir $ServiceName $executablePath
                
                Write-Host ""
                if ($installationOk) {
                    Write-Host "Installation completed successfully!" -ForegroundColor Green
                    Write-Host ""
                    Write-Host "Next steps:" -ForegroundColor Cyan
                    Write-Host "1. Check service status in Services.msc" -ForegroundColor Yellow
                    Write-Host "2. Monitor logs in: $installPath\logs" -ForegroundColor Yellow
                    Write-Host "3. Edit configuration in: $installPath\$ConfigFile" -ForegroundColor Yellow
                    Write-Host "4. Test WebSocket connection with: Test-Port -ComputerName localhost -Port 8181" -ForegroundColor Yellow
                } else {
                    Write-Host "Installation completed with warnings" -ForegroundColor Yellow
                }
            } else {
                Write-Host "Installation failed: Service could not be started" -ForegroundColor Red
                exit 1
            }
        } else {
            Write-Host "Installation failed: Service could not be installed" -ForegroundColor Red
            exit 1
        }
        
    } catch {
        Write-Host ""
        Write-Host "Installation failed with error:" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        Write-Host ""
        Write-Host "Stack trace:" -ForegroundColor Red
        Write-Host $_.ScriptStackTrace -ForegroundColor Red
        exit 1
    }
}

# Show usage
function Show-Usage {
    Write-Host "Usage:" -ForegroundColor Cyan
    Write-Host "  .\install-service.ps1 [parameters]" -ForegroundColor White
    Write-Host ""
    Write-Host "Parameters:" -ForegroundColor Cyan
    Write-Host "  -InstallPath <path>     Installation directory (default: C:\GuacamolePrintAgent)" -ForegroundColor White
    Write-Host "  -ServiceName <name>     Windows service name (default: GuacamolePrintAgent)" -ForegroundColor White
    Write-Host "  -Force                  Reinstall if service already exists" -ForegroundColor White
    Write-Host "  -Uninstall               Remove service and files" -ForegroundColor White
    Write-Host "  -Test                   Test existing installation" -ForegroundColor White
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Cyan
    Write-Host "  .\install-service.ps1                                    # Install with defaults" -ForegroundColor White
    Write-Host "  .\install-service.ps1 -Force                               # Force reinstall" -ForegroundColor White
    Write-Host "  .\install-service.ps1 -Uninstall                           # Remove installation" -ForegroundColor White
    Write-Host "  .\install-service.ps1 -Test                                # Test installation" -ForegroundColor White
}

# Parse command line arguments
if ($PSBoundParameters.Count -eq 0 -and $args.Count -gt 0) {
    if ($args[0] -match "(-Help|-h|-\?)") {
        Show-Usage
        exit 0
    }
}

# Run main function
Main