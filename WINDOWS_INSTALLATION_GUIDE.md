# Windows Installation Guide - Guacamole Print Solution

Complete step-by-step guide for installing Guacamole Print Extension on Windows client machines.

## 📋 Prerequisites

Before starting, ensure you have:

- ✅ **Windows 10/11** (or Windows Server 2019+)
- ✅ **Node.js 18+** (LTS version recommended)
- ✅ **Chrome 88+**, **Edge 88+**, or **Firefox 89+**
- ✅ **Administrator privileges** (for agent installation)
- ✅ **PowerShell 5.1+** (pre-installed on Windows 10/11)
- ✅ **Working Guacamole server** (Docker or other deployment)

---

## 🚀 Quick Installation (Automated)

### Option 1: Run Installer Script

```cmd
cd guacamole-extension
INSTALL.bat
```

This will:
1. Check Node.js installation
2. Install required dependencies
3. Start local print agent
4. Display browser extension installation instructions
5. Open folder for manual extension installation

### Option 2: Manual Installation (Step-by-Step)

---

## 📝 Step 1: Install Node.js

1. **Download Node.js:**
   - Visit: https://nodejs.org/
   - Download LTS version (recommended)
   - Run installer with Administrator privileges

2. **Verify Installation:**
   ```cmd
   node --version
   npm --version
   ```
   
   Expected output:
   ```
   v18.x.x or higher
   9.x.x or higher
   ```

---

## 📦 Step 2: Install Browser Extension

### For Chrome/Edge:

1. **Open Extensions Page:**
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`

2. **Enable Developer Mode:**
   - Toggle "Developer mode" switch in top-right corner

3. **Load Extension:**
   - Click "Load unpacked" button
   - Navigate to: `guacamole-extension` folder
   - Select folder and confirm

4. **Verify Installation:**
   - Extension should appear in list
   - Shows "Guacamole Print Agent" name
   - No errors displayed

### For Firefox:

1. **Open Debug Page:**
   - Visit: `about:debugging`

2. **Load Temporary Add-on:**
   - Click "This Firefox"
   - Click "Load Temporary Add-on"
   - Navigate to: `guacamole-extension/manifest.json`
   - Click "Open"

3. **Verify Installation:**
   - Extension appears in "Temporary Extensions" section
   - Shows "Guacamole Print Agent" name

---

## 🔧 Step 3: Start Local Print Agent

### Automatic Start (Recommended):

```cmd
cd guacamole-extension
npm run start:agent
```

### Manual Start with Node:

```cmd
cd guacamole-extension
node server/websocket-server.js
```

### Verify Agent is Running:

Look for these messages in console:
```
✅ WebSocket server listening on ws://localhost:8181
✅ SSL certificate generated
✅ Certificate installed to trusted store
✅ Agent ready to accept connections
```

### Check Port Availability:

```cmd
netstat -an | findstr "8181"
```

Should show:
```
TCP    0.0.0.0:8181           0.0.0.0:0              LISTENING
```

---

## 🔒 Step 4: Configure Security

### Allow Port Through Firewall:

1. **Open Windows Defender Firewall:**
   ```
   Control Panel → Windows Defender Firewall → Advanced Settings
   ```

2. **Add Inbound Rule:**
   - Click "Inbound Rules" → "New Rule"
   - Rule Type: Port
   - Protocol: TCP
   - Local Port: 8181
   - Action: Allow the connection
   - Profile: Domain, Private, Public (or adjust as needed)
   - Name: Guacamole Print Agent

3. **Verify Rule:**
   ```cmd
   netsh advfirewall firewall show rule name="Guacamole Print Agent"
   ```

### Antivirus Exclusion (if needed):

Add to antivirus exclusions:
- Directory: `guacamole-extension/`
- Process: `node.exe`
- Port: 8181

---

## 🌐 Step 5: Connect to Guacamole

1. **Open Browser:**
   - Navigate to your Guacamole server
   - Example: `https://localhost/guacamole/`

2. **Log In:**
   - Username: `guacadmin`
   - Password: `guacadmin`

3. **Verify Extension is Active:**
   - **Purple print button** appears in top-right corner
   - **Green "Connected" indicator** shows in top-left
   - No errors in browser console (F12)

---

## 🧪 Step 6: Test Functionality

### Test 1: Print PDF File

1. Download or open a PDF in Guacamole RDP session
2. Click the **purple print button**
3. Select **"Print"** from dialog
4. Choose printer and print
5. ✅ Verify print job completes

### Test 2: Save File Locally

1. Download any file in Guacamole
2. Click **purple print button**
3. Select **"Save"** from dialog
4. Check Downloads folder for saved file
5. ✅ File appears in `~/Downloads/PrintJobs/`

### Test 3: View History

1. Click **purple print button**
2. Select **"View History"**
3. Review recent print/save operations
4. ✅ Shows last 100 operations

---

## ⚙️ Configuration Options

### Access Extension Settings:

1. Click **purple print button** (top-right)
2. Select **"Settings"** from menu
3. Configure options:
   - **Default Printer:** Select default printer
   - **Save Location:** Set custom save path
   - **Auto-Print:** Toggle automatic printing
   - **Save Copies:** Enable/disable saving
   - **Print Quality:** Adjust quality settings

### Agent Configuration:

Edit `server/websocket-server.js` (advanced):
```javascript
const config = {
  port: 8181,
  enableSSL: true,
  autoGenerateCert: true,
  saveDirectory: path.join(os.homedir(), 'Downloads', 'PrintJobs'),
  historyDays: 7
};
```

---

## 🔍 Troubleshooting

### Issue 1: Extension Not Loading

**Symptoms:**
- Extension doesn't appear in list
- "Invalid manifest" error

**Solutions:**
1. Check browser version (Chrome 88+, Edge 88+, Firefox 89+)
2. Verify "Developer mode" is enabled
3. Refresh extensions page
4. Check browser console for errors (F12)
5. Try removing and reloading extension

### Issue 2: Agent Not Connecting

**Symptoms:**
- Status shows "Disconnected" (red)
- Print button doesn't work

**Solutions:**
1. Verify agent is running (check console)
2. Check port 8181 is not blocked:
   ```cmd
   netstat -an | findstr "8181"
   ```
3. Restart agent
4. Check Windows Firewall rules
5. Disable antivirus temporarily to test

### Issue 3: Certificate Errors

**Symptoms:**
- "Not secure" warnings
- Connection refused errors

**Solutions:**
1. Regenerate certificate:
   ```cmd
   cd guacamole-extension
   npm run generate-cert
   ```
2. Manually trust certificate:
   - Open `server/certificates/localhost.crt`
   - Install to "Trusted Root Certification Authorities"
3. Restart agent and browser

### Issue 4: Print/Save Not Working

**Symptoms:**
- No print dialog appears
- Files not saving

**Solutions:**
1. Check system has available printers
2. Verify write permissions to save directory:
   ```cmd
   icacls "%USERPROFILE%\Downloads\PrintJobs"
   ```
3. Check agent console logs for errors
4. Test with different file types (PDF, images, documents)

### Issue 5: Extension Interfering with Guacamole

**Symptoms:**
- Guacamole UI not loading
- Connection errors

**Solutions:**
1. Disable extension temporarily
2. Check Guacamole works without extension
3. Review browser console for conflicts
4. Contact support if issue persists

---

## 🔄 Updates and Maintenance

### Update Extension:

1. Stop agent (Ctrl+C in agent console)
2. Pull latest code
3. Reinstall extension:
   - Remove old extension
   - Load new extension
4. Restart agent

### Clear History:

1. Click **purple print button**
2. Select **"View History"**
3. Click **"Clear All History"**
4. Confirm deletion

### Clean Temporary Files:

```cmd
cd guacamole-extension
npm run clean
```

---

## 📊 System Requirements

### Minimum Requirements:
- **OS:** Windows 10 64-bit or Windows Server 2016+
- **RAM:** 4 GB
- **Disk:** 500 MB free space
- **Network:** Localhost access to Guacamole server

### Recommended Requirements:
- **OS:** Windows 11 64-bit or Windows Server 2022
- **RAM:** 8 GB
- **Disk:** 1 GB free space
- **Network:** 100 Mbps connection to Guacamole

---

## 🎯 Best Practices

### Security:
1. Keep Node.js and browser updated
2. Use strong Guacamole passwords
3. Enable HTTPS on Guacamole server
4. Regularly review print history
5. Restrict access to extension settings

### Performance:
1. Close unused browser tabs
2. Clear print history regularly
3. Use default printer for fastest results
4. Disable auto-print for multiple users
5. Monitor system resources

### Troubleshooting Tips:
1. Check console logs first (F12)
2. Verify agent status before reporting issues
3. Test with simple files first
4. Keep extension updated
5. Document configuration changes

---

## 📞 Support and Help

### Getting Help:
1. **Check Documentation:**
   - Extension: `guacamole-extension/README.md`
   - Agent: `guacamole-extension/INSTALLATION_COMPLETE.md`
   - Main: `README.md`

2. **Collect Debug Information:**
   - Browser console errors (F12 → Console tab)
   - Agent console logs
   - Screenshot of extension status
   - Guacamole connection details

3. **Common Solutions:**
   - Reinstall extension
   - Restart agent
   - Clear browser cache
   - Check firewall settings
   - Update browser

---

## ✅ Installation Checklist

Use this checklist to verify your installation:

- [ ] Node.js installed and verified
- [ ] Browser extension loaded successfully
- [ ] Extension shows "Connected" status
- [ ] Purple print button visible on Guacamole pages
- [ ] Agent started without errors
- [ ] Port 8181 listening (netstat verification)
- [ ] Firewall rule configured
- [ ] Can print PDF from Guacamole
- [ ] Can save files to Downloads folder
- [ ] History tracking working
- [ ] Settings accessible and configurable

---

## 🎉 Next Steps

After successful installation:

1. **Configure Preferences:**
   - Set default printer
   - Choose save location
   - Configure auto-print options

2. **Test with Real Files:**
   - Print PDFs from RDP sessions
   - Save Office documents
   - Download and print images

3. **Train Users:**
   - Share this guide
   - Demonstrate print button usage
   - Explain history features
   - Provide troubleshooting tips

---

## 📚 Additional Resources

- **Guacamole Documentation:** https://guacamole.apache.org/doc/1.5.5/gug/
- **Node.js Documentation:** https://nodejs.org/docs/
- **Chrome Extensions:** https://developer.chrome.com/docs/extensions/
- **Edge Extensions:** https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/

---

**🎉 Congratulations! Your Guacamole Print Solution is now installed on Windows!**

For issues or questions, refer to the troubleshooting section or check the console logs for detailed error information.
