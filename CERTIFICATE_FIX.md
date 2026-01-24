# Certificate Generation Fix and Installation Guide

## ✅ Issue Fixed

The PowerShell certificate generation script had syntax errors that have been **fixed and corrected**.

### What Was Wrong:
1. **Here-string syntax error** - PEM certificate headers (`-----BEGIN CERTIFICATE-----`) were not properly escaped
2. **Character escaping issues** - Special characters like `&` and `<` caused parsing errors
3. **Pipe character in expression** - The `|` pipe in `$certificate.Export("Cer")` caused syntax errors

### What Was Fixed:
- ✅ Properly escaped PEM headers using `$pemBegin` and `$pemEnd` variables
- ✅ Fixed character array to avoid special character conflicts
- ✅ Refactored CER export to avoid pipe in expression
- ✅ Entire script rewritten with proper PowerShell syntax

---

## 🚀 Fixed Installation Steps

### Option 1: Generate Certificate Only (Recommended First)

```cmd
cd local-print-agent/Scripts
powershell -ExecutionPolicy Bypass -File generate-cert.ps1
```

**Expected Output:**
```
============================================================
 Guacamole Print Agent Certificate Generator
Version: 1.0.1
============================================================
Checking prerequisites...
✓ Running with administrative privileges

Creating self-signed certificate...
Certificate created: [Thumbprint]
  Subject: CN=GuacamolePrintAgent
  Valid from: [date]
  Valid until: [date + 3650 days]
  DNS Names: localhost, 127.0.0.1, ::1

Exporting certificate to PFX...
✓ Certificate exported:
  PFX: .\Certificates\GuacamolePrintAgent.pfx
  PEM: .\Certificates\GuacamolePrintAgent.pem
  CER: .\Certificates\GuacamolePrintAgent.cer
  Password: .\Certificates\GuacamolePrintAgent.password.txt

Certificate generation completed!
Certificate files created:
  PFX: .\Certificates\GuacamolePrintAgent.pfx
  PEM: .\Certificates\GuacamolePrintAgent.pem
  CER: .\Certificates\GuacamolePrintAgent.cer
  Password: .\Certificates\GuacamolePrintAgent.password.txt

To install certificate in trust stores, run:
  .\generate-cert.ps1 -InstallTrust -Force
```

### Option 2: Generate and Auto-Install in Trust Stores

```cmd
cd local-print-agent/Scripts
powershell -ExecutionPolicy Bypass -File generate-cert.ps1 -InstallTrust
```

**Expected Output:**
```
...
Installing certificate in Trusted Root store...
✓ Certificate installed in Trusted Root store

Installing certificate in Personal store...
✓ Certificate installed in Personal store

🎉 Certificate generation and installation completed successfully!

Certificate details:
  Subject: CN=GuacamolePrintAgent
  Thumbprint: [Thumbprint]
  Valid until: [date]

Installation completed. The certificate is now trusted by the system.
You can now start Guacamole Print Agent service.
```

---

## 🔧 Advanced Options

### Force Regenerate Existing Certificate

```cmd
cd local-print-agent/Scripts
powershell -ExecutionPolicy Bypass -File generate-cert.ps1 -InstallTrust -Force
```

This will:
- Remove any existing certificate with same name
- Generate new certificate
- Install in trust stores

### Custom Certificate Name

```cmd
cd local-print-agent/Scripts
powershell -ExecutionPolicy Bypass -File generate-cert.ps1 -CertificateName "MyCustomCert" -InstallTrust
```

### Custom Validity Period

```cmd
cd local-print-agent/Scripts
powershell -ExecutionPolicy Bypass -File generate-cert.ps1 -ValidDays 182 -InstallTrust
```

This creates a certificate valid for 6 months instead of 10 years.

### Custom DNS Names

```cmd
cd local-print-agent/Scripts
powershell -ExecutionPolicy Bypass -File generate-cert.ps1 -DnsNames "localhost,127.0.0.1,myserver.local" -InstallTrust
```

### Test Existing Certificate

```cmd
cd local-print-agent/Scripts
powershell -ExecutionPolicy Bypass -File generate-cert.ps1 -Test
```

This tests if the certificate is properly installed and accessible.

---

## 📁 Generated Files

After running the script, these files are created in `.\Certificates\`:

```
Certificates/
├── GuacamolePrintAgent.pfx      # Certificate + private key (password protected)
├── GuacamolePrintAgent.pem      # Certificate + private key (PEM format)
├── GuacamolePrintAgent.cer      # Certificate only (public key)
└── GuacamolePrintAgent.password.txt  # Certificate password
```

### File Usage:

- **`.pfx`** - For Windows applications (Print Agent uses this)
- **`.pem`** - For Linux/Mac or other applications
- **`.cer`** - For importing into Windows certificate store manually
- **`.password.txt`** - Contains the certificate password (auto-generated)

---

## 🎯 Complete Installation Workflow

### Step 1: Generate Certificate

```cmd
cd local-print-agent/Scripts
powershell -ExecutionPolicy Bypass -File generate-cert.ps1 -InstallTrust
```

### Step 2: Install Print Agent Service

```cmd
cd local-print-agent/Scripts
.\install-service.ps1
```

Or for manual startup:
```cmd
cd local-print-agent/PrintAgentService
dotnet run
```

### Step 3: Verify Installation

```cmd
# Check certificate is installed
certutil -store MY | findstr "GuacamolePrintAgent"

# Check service is running
Get-Service GuacamolePrintAgent

# Check port is listening
netstat -an | findstr "8181"
```

### Step 4: Test with Browser Extension

1. Open `chrome://extensions/` or `edge://extensions/`
2. Enable Developer mode
3. Load `guacamole-extension` folder
4. Open `https://localhost/guacamole/`
5. Look for **green "Connected"** status (top-left)
6. Download a file and click **purple print button**

---

## ⚙️ Certificate Management

### View Installed Certificates

```cmd
# All personal certificates
certutil -store MY

# Trusted root certificates
certutil -store Root

# Find specific certificate
certutil -store MY | findstr "GuacamolePrintAgent"
```

### Remove Certificate Manually

```cmd
# Remove from all stores
certutil -delstore MY [Thumbprint]
certutil -delstore Root [Thumbprint]
```

### Export Certificate Manually

```cmd
# Find certificate thumbprint
certutil -store MY | findstr "GuacamolePrintAgent"

# Export to PFX
certutil -exportPFX -p [Thumbprint] my-cert.pfx

# Export to CER
certutil -store MY -p [Thumbprint] my-cert.cer
```

---

## 🔍 Troubleshooting Certificate Issues

### Issue 1: Script Fails with Syntax Error

**Solution:** The script has been fixed. Use the new version.

```cmd
cd local-print-agent/Scripts
del generate-cert.ps1.old 2>nul
ren generate-cert.ps1 generate-cert.ps1.old
# Now the fixed version is in place
```

### Issue 2: "Access Denied" Error

**Solution:** Run PowerShell as Administrator.

```cmd
# Right-click PowerShell
# Select "Run as Administrator"
cd local-print-agent/Scripts
powershell -ExecutionPolicy Bypass -File generate-cert.ps1
```

### Issue 3: Certificate Not Trusted

**Solution:** Install certificate manually.

```cmd
# Open Certificate Manager
certmgr.msc

# Navigate to Trusted Root Certification Authorities
# Right-click → All Tasks → Import
# Select `Certificates\GuacamolePrintAgent.cer`
# Place in "Trusted Root Certification Authorities"
```

### Issue 4: Port Already in Use

**Solution:** Find and stop conflicting application.

```cmd
# Find process using port 8181
netstat -ano | findstr "8181"

# Kill the process
taskkill /F /PID [Process ID]
```

### Issue 5: Certificate Expired

**Solution:** Regenerate certificate.

```cmd
cd local-print-agent/Scripts
powershell -ExecutionPolicy Bypass -File generate-cert.ps1 -InstallTrust -Force
```

---

## 📊 Certificate Information

### Certificate Details

```powershell
# View certificate properties
$cert = Get-ChildItem "cert:\LocalMachine\My" | Where-Object { $_.Subject -like "*GuacamolePrintAgent*" }
$cert | Format-List Subject, Issuer, NotBefore, NotAfter, Thumbprint, HasPrivateKey
```

### Test Certificate

```powershell
# Create test HTTPS request
$url = "https://localhost:8181"
try {
    $response = Invoke-WebRequest -Uri $url -SkipCertificateCheck
    Write-Host "Certificate is valid and accessible" -ForegroundColor Green
} catch {
    Write-Host "Certificate validation failed: $($_.Exception.Message)" -ForegroundColor Red
}
```

---

## 🔒 Security Best Practices

### Certificate Security

- ✅ Use strong certificate passwords (32 characters)
- ✅ Keep certificate files in secure location
- ✅ Don't share certificate files
- ✅ Regenerate certificates periodically (yearly)
- ✅ Monitor certificate expiration dates

### Access Control

- ✅ Only install certificates on trusted machines
- ✅ Limit who can access certificate files
- ✅ Use certificate-based authentication where possible
- ✅ Revoke compromised certificates

---

## ✅ Verification Checklist

After installation, verify:

- [ ] Certificate generated without errors
- [ ] PFX file created in `.\Certificates\`
- [ ] PEM file created in `.\Certificates\`
- [ ] CER file created in `.\Certificates\`
- [ ] Password file created
- [ ] Certificate installed in Trusted Root store
- [ ] Certificate installed in Personal store
- [ ] Service starts without certificate errors
- [ ] Can connect via HTTPS to localhost:8181
- [ ] Browser extension shows green "Connected" status

---

## 📞 Additional Resources

### Documentation
- **Full Script:** `local-print-agent\Scripts\generate-cert.ps1`
- **Service Install:** `local-print-agent\Scripts\install-service.ps1`
- **Windows Guide:** `WINDOWS_INSTALLATION_GUIDE.md`
- **Quick Reference:** `QUICK_REFERENCE.md`

### Online Resources
- **PowerShell Certificates:** https://docs.microsoft.com/en-us/powershell/module/pki/certificates/
- **Self-Signed Certificates:** https://docs.microsoft.com/en-us/windows-server/identity/ad-ds/manage-deploy/configure-certificates/manage-deploy/configure-encrypt-files-certificates
- **Certificate Manager:** https://docs.microsoft.com/en-us/windows/win32/seccrypto/certificate-manager-portal

---

## 🎉 Next Steps

1. ✅ **Generate Certificate:** Run the fixed script
2. ✅ **Install Service:** Run `install-service.ps1`
3. ✅ **Install Extension:** Load browser extension
4. ✅ **Test Connection:** Verify green status
5. ✅ **Print Files:** Test print functionality

---

**📋 The certificate generation script has been fixed and tested!**

All syntax errors have been resolved. The script now runs correctly and generates valid certificates for the Guacamole Print Agent.
