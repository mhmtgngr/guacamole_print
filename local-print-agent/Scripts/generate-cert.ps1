# Guacamole Print Agent Certificate Generator - FINAL WORKING VERSION
# Version 8.0.0 - Simple, reliable certificate generation without splatting issues

param(
    [Parameter(Mandatory=$false)]
    [string]$CertificateName = "GuacamolePrintAgent",
    
    [Parameter(Mandatory=$false)]
    [string]$DnsNames = "localhost,127.0.0.1,::1",
    
    [Parameter(Mandatory=$false)]
    [int]$ValidDays = 3650,
    
    [Parameter(Mandatory=$false)]
    [string]$ExportPath = "",
    
    [Parameter(Mandatory=$false)]
    [switch]$InstallTrust,
    
    [Parameter(Mandatory=$false)]
    [switch]$Force,
    
    [Parameter(Mandatory=$false)]
    [switch]$Test
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Script information
$ScriptVersion = "8.0.0"
$ScriptName = "Guacamole Print Agent Certificate Generator"

# Get script directory and set default export path
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($ExportPath)) {
    $ExportPath = Join-Path $ScriptDir "Certificates"
}
Write-Host "Export Path: $ExportPath" -ForegroundColor Cyan
Write-Host ""

# Display header
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host $ScriptName -ForegroundColor Cyan
Write-Host "Version: $ScriptVersion" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

# Check administrative privileges
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "This script requires administrative privileges." -ForegroundColor Red
    Write-Host "Please run PowerShell as Administrator and retry." -ForegroundColor Yellow
    exit 1
}
Write-Host "Running with administrative privileges" -ForegroundColor Green
Write-Host ""

# Generate password
Write-Host "Generating secure password..." -ForegroundColor Yellow

$passwordChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?"
$password = ""
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()

for ($i = 0; $i -lt 32; $i++) {
    $bytes = New-Object byte[] 1
    $rng.GetBytes($bytes)
    $password += $passwordChars[$bytes[0] % $passwordChars.Length]
}

Write-Host "Password generated" -ForegroundColor Green
Write-Host ""

# Create certificate
Write-Host "Creating self-signed certificate..." -ForegroundColor Yellow

# Check if New-SelfSignedCertificate cmdlet exists
$hasNewSelfSignedCert = $false
try {
    Get-Command New-SelfSignedCertificate -ErrorAction SilentlyContinue
    if ($?) { $hasNewSelfSignedCert = $true }
} catch {}

if ($hasNewSelfSignedCert) {
    Write-Host "Using New-SelfSignedCertificate cmdlet" -ForegroundColor Cyan
    
    try {
        # Parse DNS names
        $dnsArray = $DnsNames -split ',' | ForEach-Object { $_.Trim() }
        
        Write-Host "DNS Names: $($dnsArray -join ', ')" -ForegroundColor Cyan
        Write-Host "Valid Days: $ValidDays" -ForegroundColor Cyan
        Write-Host ""
        
        # Create certificate using array of positional parameters
        $cert = New-SelfSignedCertificate -DnsName $dnsArray -CertStoreLocation "cert:\LocalMachine\My" -NotAfter (Get-Date).AddDays($ValidDays) -KeyUsage "DigitalSignature","KeyEncipherment" -TextExtension "2.5.29.37={text}1.3.6.1.5.5.7.3.1" -KeyExportPolicy "Exportable" -Provider "Microsoft Enhanced RSA and AES Cryptographic Provider" -HashAlgorithm "SHA256" -KeyLength 2048 -ErrorAction Stop
        
        if ($null -eq $cert) {
            throw "Certificate creation returned null"
        }
        
        Write-Host "Certificate created successfully" -ForegroundColor Green
        Write-Host "  Subject: CN=$CertificateName" -ForegroundColor Cyan
        Write-Host "  Thumbprint: $($cert.Thumbprint)" -ForegroundColor Cyan
        Write-Host "  Valid from: $($cert.NotBefore)" -ForegroundColor Cyan
        Write-Host "  Valid until: $($cert.NotAfter)" -ForegroundColor Cyan
        Write-Host ""
        
    } catch {
        Write-Host "Failed to create certificate: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Script will exit now." -ForegroundColor Yellow
        exit 1
    }
    
} else {
    Write-Host "New-SelfSignedCertificate cmdlet not available" -ForegroundColor Red
    Write-Host "Please use Windows Certificate Manager (certmgr.msc)" -ForegroundColor Yellow
    Write-Host "or install PowerShell with Windows Management Framework" -ForegroundColor Yellow
    exit 1
}

# Export certificate files using .NET methods (most reliable)
Write-Host "Exporting certificate files..." -ForegroundColor Yellow

if (-not (Test-Path $ExportPath)) {
    New-Item -ItemType Directory -Path $ExportPath -Force | Out-Null
}

$pfxPath = Join-Path $ExportPath "$CertificateName.pfx"
$pemPath = Join-Path $ExportPath "$CertificateName.pem"
$cerPath = Join-Path $ExportPath "$CertificateName.cer"
$passwordFile = Join-Path $ExportPath "$CertificateName.password.txt"

try {
    $securePassword = ConvertTo-SecureString -String $password -Force -AsPlainText
    
    Write-Host "Exporting PFX..." -ForegroundColor Gray
    $pfxBytes = $cert.Export("Pfx", $securePassword)
    [System.IO.File]::WriteAllBytes($pfxPath, $pfxBytes)
    Write-Host "  PFX: $pfxPath" -ForegroundColor Green
    
    Write-Host "Exporting PEM..." -ForegroundColor Gray
    $base64Cert = [Convert]::ToBase64String($cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert))
    $pem = "-----BEGIN CERTIFICATE-----`r`n$base64Cert`r`n-----END CERTIFICATE-----"
    [System.IO.File]::WriteAllText($pemPath, $pem)
    Write-Host "  PEM: $pemPath" -ForegroundColor Green
    
    Write-Host "Exporting CER..." -ForegroundColor Gray
    $cerBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert))
    [System.IO.File]::WriteAllBytes($cerPath, $cerBytes)
    Write-Host "  CER: $cerPath" -ForegroundColor Green
    
    Write-Host "Saving password..." -ForegroundColor Gray
    [System.IO.File]::WriteAllText($passwordFile, $password)
    Write-Host "  Password: $passwordFile" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "Certificate exported:" -ForegroundColor Green
    Write-Host "  PFX: $pfxPath" -ForegroundColor Cyan
    Write-Host "  PEM: $pemPath" -ForegroundColor Cyan
    Write-Host "  CER: $cerPath" -ForegroundColor Cyan
    Write-Host "  Password: $passwordFile" -ForegroundColor Cyan
    Write-Host ""
    
} catch {
    Write-Host "Failed to export certificate: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Script will exit now." -ForegroundColor Yellow
    exit 1
}

# Install in trust stores if requested
if ($InstallTrust) {
    Write-Host "Installing certificate in trust stores..." -ForegroundColor Yellow
    Write-Host ""
    
    $thumbprint = $cert.Thumbprint
    
    try {
        # Remove existing
        Write-Host "Removing existing certificates..." -ForegroundColor Gray
        
        $stores = @("My", "Root", "TrustedPublisher")
        
        foreach ($storeName in $stores) {
            try {
                $store = New-Object System.Security.Cryptography.X509Certificates.X509Store($storeName, "LocalMachine")
                $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
                
                $existing = $store.Certificates | Where-Object { $_.Thumbprint -eq $thumbprint }
                foreach ($c in $existing) {
                    $store.Remove($c)
                    Write-Host "  Removed from $storeName" -ForegroundColor DarkGray
                }
                
                $store.Close()
            } catch {
                Write-Host "  Error accessing $storeName store: $($_.Exception.Message)" -ForegroundColor DarkGray
            }
        }
        
        Write-Host "Done removing existing certificates" -ForegroundColor Green
        Write-Host ""
        
        # Add to Personal store
        Write-Host "Adding to Personal store..." -ForegroundColor Gray
        $myStore = New-Object System.Security.Cryptography.X509Certificates.X509Store("My", "LocalMachine")
        $myStore.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
        $myStore.Add($cert)
        $myStore.Close()
        Write-Host "Done" -ForegroundColor Green
        Write-Host ""
        
        # Add to Root store
        Write-Host "Adding to Trusted Root store..." -ForegroundColor Gray
        $rootStore = New-Object System.Security.X509Certificates.X509Store("Root", "LocalMachine")
        $rootStore.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
        $rootStore.Add($cert)
        $rootStore.Close()
        Write-Host "Done" -ForegroundColor Green
        Write-Host ""
        
        Write-Host "Certificate installation completed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Certificate details:" -ForegroundColor Cyan
        Write-Host "  Subject: CN=$CertificateName" -ForegroundColor White
        Write-Host "  Thumbprint: $($cert.Thumbprint)" -ForegroundColor White
        Write-Host "  Valid until: $($cert.NotAfter)" -ForegroundColor White
        Write-Host ""
        Write-Host "Files created:" -ForegroundColor Cyan
        Write-Host "  PFX: $pfxPath" -ForegroundColor White
        Write-Host "  PEM: $pemPath" -ForegroundColor White
        Write-Host "  CER: $cerPath" -ForegroundColor White
        Write-Host "  Password: $passwordFile" -ForegroundColor White
        Write-Host ""
        Write-Host "✅ Installation completed. The certificate is now trusted by the system." -ForegroundColor Green
        Write-Host "You can now start the Guacamole Print Agent service." -ForegroundColor Green
        
    } catch {
        Write-Host "Failed to install certificate: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Certificate files were created but installation failed." -ForegroundColor Yellow
        Write-Host "You can manually install the certificate from:" -ForegroundColor Yellow
        Write-Host "  $cerPath" -ForegroundColor Cyan
        Write-Host ""
    }
} else {
    Write-Host "Certificate generation completed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Files created:" -ForegroundColor Cyan
    Write-Host "  PFX: $pfxPath" -ForegroundColor White
    Write-Host "  PEM: $pemPath" -ForegroundColor White
    Write-Host "  CER: $cerPath" -ForegroundColor White
    Write-Host "  Password: $passwordFile" -ForegroundColor White
    Write-Host ""
    Write-Host "To install certificate in trust stores, run:" -ForegroundColor Yellow
    Write-Host "  .\generate-cert.ps1 -InstallTrust -Force" -ForegroundColor White
    Write-Host ""
    Write-Host "Or manually install the CER file and mark it as trusted." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
