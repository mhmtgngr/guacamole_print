# Quick Start - Guacamole Print Solution (Windows)

**Fixed Certificate Script + Complete Installation Guide**

---

## 🚀 5-Minute Quick Start

### Step 1: Generate Certificate (1 minute)

Open PowerShell as Administrator and run:

```cmd
cd C:\Users\Mehmet\guacamole-print-solution\local-print-agent\Scripts
powershell -ExecutionPolicy Bypass -File generate-cert.ps1 -InstallTrust
```

**✅ Expected:**
- Certificate created in `.\Certificates\` folder
- Certificate installed in Windows trust stores
- "Installation completed" message

### Step 2: Start Print Agent (30 seconds)

```cmd
cd C:\Users\Mehmet\guacamole-print-solution\guacamole-extension
node server/websocket-server.js
```

**✅ Expected:**
- "WebSocket server listening on ws://localhost:8181"
- "SSL certificate generated" message
- No error messages

### Step 3: Install Browser Extension (1 minute)

**For Chrome/Edge:**
1. Open `chrome://extensions/` or `edge://extensions/`
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked"
4. Select: `C:\Users\Mehmet\guacamole-print-solution\guacamole-extension`
5. Enable the extension

**✅ Expected:**
- Extension appears in list
- Shows "Guacamole Print Agent" name
- No errors displayed

### Step 4: Connect to Guacamole (30 seconds)

1. Open browser: `https://localhost/guacamole/`
2. Login with: `guacadmin` / `guacadmin`
3. ✅ Look for **purple print button** (top-right)
4. ✅ Check **green "Connected"** status (top-left)

### Step 5: Test Printing (30 seconds)

1. Download any file from Guacamole
2. Click **purple print button**
3. Choose **"Print"** from dialog
4. Select printer and confirm
5. ✅ Verify print job completes

**Total Time:** ~3 minutes

---

## ✅ Success Indicators

**Certificate Working:**
```
✓ Certificate created: [thumbprint]
✓ Certificate exported:
  PFX: .\Certificates\GuacamolePrintAgent.pfx
  PEM: .\Certificates\GuacamolePrintAgent.pem
  CER: .\Certificates\GuacamolePrintAgent.cer
```

**Agent Working:**
```
✓ WebSocket server listening on ws://localhost:8181
✓ SSL certificate generated
✓ Agent ready to accept connections
```

**Extension Working:**
```
✅ Purple print button visible (top-right)
✅ Green "Connected" status (top-left)
✅ No errors in browser console (F12)
```

**Full System:**
```
✅ Can print PDF from Guacamole
✅ Can save files to Downloads
✅ History tracking working
✅ Port 8181 listening
```

---

## ⚠️ Common Errors and Solutions

### Error 1: "Access Denied"

**Solution:** Run as Administrator

```cmd
# Right-click PowerShell
# Select "Run as administrator"
```

### Error 2: "Port 8181 already in use"

**Solution:** Stop existing process

```cmd
netstat -ano | findstr "8181"
taskkill /F /PID [Process ID]
```

### Error 3: Extension not loading

**Solution:** Enable Developer Mode

1. Go to `chrome://extensions/`
2. Toggle "Developer mode" to ON
3. Refresh page
4. Try loading again

### Error 4: Status shows "Disconnected" (red)

**Solution:** Check agent is running

```cmd
# Check if node.js process is running
tasklist | findstr "node.exe"

# Restart agent
# Press Ctrl+C in agent window
node server/websocket-server.js
```

### Error 5: Certificate trust errors

**Solution:** Manually trust certificate

```cmd
certmgr.msc

# Navigate to: Trusted Root Certification Authorities
# Right-click → Import
# Select: Certificates\GuacamolePrintAgent.cer
# Place in store
```

---

## 🔄 Restart Procedures

### Restart Agent Only

```cmd
# Stop: Ctrl+C in agent window
# Start: node server/websocket-server.js
```

### Regenerate Certificate

```cmd
cd C:\Users\Mehmet\guacamole-print-solution\local-print-agent\Scripts
powershell -ExecutionPolicy Bypass -File generate-cert.ps1 -InstallTrust -Force
```

### Reload Extension

1. Go to `chrome://extensions/`
2. Click "reload" icon on extension
3. Refresh Guacamole page

---

## 📁 Important File Locations

```
C:\Users\Mehmet\guacamole-print-solution\
├── local-print-agent\
│   ├── Scripts\
│   │   └── generate-cert.ps1          ✅ Fixed!
│   ├── Certificates\                         Generated here
│   └── PrintAgentService\
│       └── appsettings.json               Agent config
├── guacamole-extension\
│   ├── manifest.json                         Extension manifest
│   ├── server\
│   │   ├── websocket-server.js              Agent server
│   │   └── certificates\                   Auto-generated certs
│   ├── popup.html                            Print button UI
│   └── popup.js                              Extension logic
├── WINDOWS_INSTALLATION_GUIDE.md        Detailed guide
├── QUICK_REFERENCE.md                    Daily reference
└── CERTIFICATE_FIX.md                  Fix details
```

---

## 🎯 What's Fixed?

### Before:
- ❌ PowerShell syntax errors
- ❌ Certificate generation failed
- ❌ PEM header parsing issues
- ❌ Character escaping problems

### After:
- ✅ All syntax errors fixed
- ✅ Certificate generates successfully
- ✅ PEM export works correctly
- ✅ No special character issues
- ✅ Proper error handling

---

## 📋 Daily Usage Workflow

### Morning Start:

```cmd
1. Open PowerShell as Administrator
2. cd C:\Users\Mehmet\guacamole-print-solution\guacamole-extension
3. node server/websocket-server.js
4. Keep window minimized
```

### During Day:

- Open Guacamole: `https://localhost/guacamole/`
- Download files as needed
- Click purple print button
- Choose Print/Save option

### Evening Check:

```cmd
# Check agent console for errors
# Review browser console (F12)
# Verify green "Connected" status
# View print history
```

### Day End:

- Click print button → View History
- Review recent operations
- Clear old history if needed
- Close agent window (Ctrl+C)

---

## 🆘 Getting Help

### Quick Troubleshooting:

1. **Check Console Logs**
   - Agent: Check PowerShell window for errors
   - Extension: Press F12 in browser, check Console tab

2. **Verify All Services**
   ```cmd
   tasklist | findstr "node.exe"           # Agent running?
   certutil -store MY | findstr "Guacamole" # Certificate installed?
   netstat -an | findstr "8181"         # Port listening?
   ```

3. **Restart Everything**
   ```cmd
   # 1. Stop agent (Ctrl+C)
   # 2. Close browser
   # 3. Start agent again
   # 4. Open browser and Guacamole
   ```

4. **Documentation**
   - **Quick Guide:** This file
   - **Full Guide:** `WINDOWS_INSTALLATION_GUIDE.md`
   - **Reference:** `QUICK_REFERENCE.md`
   - **Fix Details:** `CERTIFICATE_FIX.md`

---

## 🎉 You're Ready!

If you've completed Steps 1-5 above, your Guacamole Print Solution is fully operational!

**What you can do now:**
- ✅ Print PDF files from Guacamole to local printer
- ✅ Save files from Guacamole to Downloads folder
- ✅ View print/save history
- ✅ Configure default printer
- ✅ Manage extension settings
- ✅ View connection status

**Access Points:**
- Guacamole: `https://localhost/guacamole/`
- Extension Settings: Click purple print button → Settings
- History: Click purple print button → View History

---

**For detailed information, refer to:**
- `WINDOWS_INSTALLATION_GUIDE.md` - Complete installation guide
- `QUICK_REFERENCE.md` - Daily reference
- `CERTIFICATE_FIX.md` - Certificate fix details

---

**📱 Quick Start Guide - Fixed and Ready!**

The certificate generation script has been completely rewritten and all syntax errors fixed. You can now generate and install certificates successfully!
