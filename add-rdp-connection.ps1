# =====================================================
# Add RDP Connection with Drive Redirection + Printing
# Usage: .\add-rdp-connection.ps1
# =====================================================

param(
    [string]$GuacamoleUrl = "http://localhost:8080/guacamole",
    [string]$AdminUser = "guacadmin",
    [string]$AdminPass = "guacadmin",
    [string]$ConnectionName = "My RDP Server",
    [string]$RdpHost = "192.168.1.100",
    [string]$RdpPort = "3389",
    [string]$RdpUser = "",
    [string]$RdpPass = "",
    [string]$RdpDomain = ""
)

Write-Host "=== Guacamole RDP Connection Setup ===" -ForegroundColor Cyan

# Step 1: Get auth token
Write-Host "`n[1/3] Authenticating..." -ForegroundColor Yellow
$authBody = "username=$AdminUser&password=$AdminPass"
try {
    $authResponse = Invoke-RestMethod -Uri "$GuacamoleUrl/api/tokens" -Method POST -Body $authBody -ContentType "application/x-www-form-urlencoded"
    $token = $authResponse.authToken
    Write-Host "  Authenticated successfully" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Failed to authenticate. Is Guacamole running?" -ForegroundColor Red
    Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: Create connection with drive redirection + printing
Write-Host "[2/3] Creating RDP connection '$ConnectionName'..." -ForegroundColor Yellow

$connectionBody = @{
    parentIdentifier = "ROOT"
    name = $ConnectionName
    protocol = "rdp"
    parameters = @{
        # RDP Server
        hostname = $RdpHost
        port = $RdpPort
        username = $RdpUser
        password = $RdpPass
        domain = $RdpDomain
        security = "nla"
        "ignore-cert" = "true"

        # DRIVE REDIRECTION - Required for file download interception
        "enable-drive" = "true"
        "drive-name" = "GuacamoleDrive"
        "drive-path" = "/drive"
        "create-drive-path" = "true"

        # PRINTING - Virtual PDF printer in remote session
        "enable-printing" = "true"
        "printer-name" = "Guacamole-Printer"

        # Display
        "color-depth" = "32"
        width = "1920"
        height = "1080"
        dpi = "96"
        "resize-method" = "display-update"

        # Performance
        "enable-wallpaper" = "true"
        "enable-font-smoothing" = "true"
        "enable-theming" = "true"
    }
    attributes = @{
        "max-connections" = "5"
        "max-connections-per-user" = "2"
    }
} | ConvertTo-Json -Depth 3

try {
    $response = Invoke-RestMethod -Uri "$GuacamoleUrl/api/session/data/postgresql/connections?token=$token" -Method POST -Body $connectionBody -ContentType "application/json"
    Write-Host "  Connection created: ID=$($response.identifier)" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Failed to create connection" -ForegroundColor Red
    Write-Host "  $($_.Exception.Message)" -ForegroundColor Red

    # Try with mysql datasource as fallback
    try {
        $response = Invoke-RestMethod -Uri "$GuacamoleUrl/api/session/data/mysql/connections?token=$token" -Method POST -Body $connectionBody -ContentType "application/json"
        Write-Host "  Connection created (mysql): ID=$($response.identifier)" -ForegroundColor Green
    } catch {
        Write-Host "  Also failed with mysql datasource" -ForegroundColor Red
    }
}

# Step 3: Summary
Write-Host "`n[3/3] Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "=== Connection Details ===" -ForegroundColor Cyan
Write-Host "  Name:            $ConnectionName"
Write-Host "  RDP Host:        ${RdpHost}:${RdpPort}"
Write-Host "  Drive Redirect:  ENABLED (GuacamoleDrive -> /drive)"
Write-Host "  Virtual Printer: ENABLED (Guacamole-Printer)"
Write-Host ""
Write-Host "=== How File Transfer Works ===" -ForegroundColor Cyan
Write-Host "  1. Connect to RDP session via Guacamole"
Write-Host "  2. In remote desktop, open File Explorer"
Write-Host "  3. You'll see 'GuacamoleDrive' as a mapped drive"
Write-Host "  4. Copy/save any file to GuacamoleDrive"
Write-Host "  5. File is intercepted and sent to your local print agent"
Write-Host "  6. Dialog appears: Print / Save / Open / Cancel"
Write-Host ""
Write-Host "=== How Printing Works ===" -ForegroundColor Cyan
Write-Host "  1. In remote desktop, press Ctrl+P in any application"
Write-Host "  2. Select 'Guacamole-Printer' as the printer"
Write-Host "  3. Print job is captured as PDF"
Write-Host "  4. PDF is sent to your local print agent"
Write-Host "  5. Native Windows print dialog appears"
Write-Host ""
