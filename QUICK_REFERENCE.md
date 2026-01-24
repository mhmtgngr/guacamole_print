# Guacamole Print Extension - Quick Reference

## 🚀 Quick Start (3 Steps)

### 1. Start Agent
```cmd
cd guacamole-extension
node server/websocket-server.js
```

### 2. Install Extension
**Chrome/Edge:**
- Go to `chrome://extensions/` or `edge://extensions/`
- Enable "Developer mode"
- Click "Load unpacked"
- Select `guacamole-extension` folder

**Firefox:**
- Go to `about:debugging`
- Click "This Firefox"
- Click "Load Temporary Add-on"
- Select `manifest.json`

### 3. Test
- Open `https://localhost/guacamole/`
- Log in with `guacadmin` / `guacadmin`
- Look for **purple print button** (top-right)
- Download a file and click print button
- ✅ Print or Save dialog appears

---

## 🔧 Common Commands

### Start Agent
```cmd
cd guacamole-extension
node server/websocket-server.js
```

### Stop Agent
Press `Ctrl+C` in agent console window

### Install Dependencies
```cmd
cd guacamole-extension
npm install
```

### Regenerate Certificate
```cmd
cd guacamole-extension
npm run generate-cert
```

### Check Port
```cmd
netstat -an | findstr "8181"
```

### Add Firewall Rule
```cmd
netsh advfirewall firewall add rule name="Guacamole Print Agent" dir=in action=allow protocol=TCP localport=8181
```

---

## ⚙️ Browser URLs

### Chrome
- Extensions: `chrome://extensions/`
- Console: `chrome://extensions/` → Details → Inspect views

### Edge
- Extensions: `edge://extensions/`
- Console: `edge://extensions/` → Details → Inspect views

### Firefox
- Debug: `about:debugging`
- Console: `about:debugging` → Add-ons → Debug Add-on

---

## 🎯 Visual Indicators

### ✅ Extension Working
- **Purple print button** in top-right corner
- **Green "Connected"** in top-left
- No errors in browser console (F12)

### ❌ Extension Issues
- **Red "Disconnected"** in top-left
- No print button visible
- Errors in browser console (F12)

### ✅ Agent Working
- "WebSocket server listening on ws://localhost:8181"
- "Certificate generated" message
- No red error messages

### ❌ Agent Issues
- "Port 8181 already in use"
- "EADDRINUSE" errors
- "Certificate generation failed"

---

## 📊 Status Quick Check

Run these commands to verify everything:

```cmd
REM Check Node.js
node --version

REM Check npm
npm --version

REM Check port 8181
netstat -an | findstr "8181"

REM Check firewall
netsh advfirewall firewall show rule name="Guacamole Print Agent"
```

**Expected Results:**
- Node.js: `v18.x.x` or higher
- npm: `9.x.x` or higher
- Port 8181: `TCP 0.0.0.0:8181 LISTENING`
- Firewall: Rule exists and enabled

---

## 🔍 Troubleshooting Flow

### 1. Extension Not Loading?
```
Check browser version → Enable Developer Mode → Refresh page → Check console
```

### 2. Status Shows "Disconnected"?
```
Check agent running → Check port 8181 → Check firewall → Restart agent
```

### 3. Print Button Not Appearing?
```
Check extension enabled → Check Guacamole URL → Refresh page → Check console
```

### 4. Certificate Errors?
```
Regenerate cert → Install cert manually → Restart browser → Restart agent
```

### 5. Print Not Working?
```
Check printer installed → Check agent logs → Test different file → Check permissions
```

---

## 🎨 Feature Locations

### Print Button (Purple)
- **Location:** Top-right corner of Guacamole pages
- **Purpose:** Open print/save dialog

### Status Indicator (Top-Left)
- **Green:** Connected to agent
- **Red:** Disconnected from agent
- **Yellow:** Connecting to agent

### Settings Menu
1. Click purple print button
2. Select "Settings"
3. Configure:
   - Default printer
   - Save location
   - Auto-print options
   - History settings

### History Panel
1. Click purple print button
2. Select "View History"
3. Filter by:
   - Action (Print/Save)
   - Date range
   - File type

---

## 📁 File Locations

### Windows
- **Extension:** `guacamole-extension/`
- **Agent Logs:** Console window
- **Saved Files:** `~/Downloads/PrintJobs/`
- **Certificate:** `guacamole-extension/server/certificates/`
- **History:** `guacamole-extension/server/history/`

### Browser Storage
- **Extension Data:** `chrome://extensions/` → Details → Extension options
- **Local Storage:** Contains user preferences
- **Session Storage:** Current session data

---

## 🔄 Daily Usage

### Start of Day
```cmd
1. Open cmd/powershell
2. cd guacamole-extension
3. node server/websocket-server.js
4. Keep window open
5. Open browser and go to Guacamole
```

### During Use
1. Download file in Guacamole
2. Click purple print button
3. Choose Print or Save
4. Select options
5. Confirm

### End of Day
1. Click print button → View History
2. Review activity
3. Clear old history if needed
4. Close agent window (Ctrl+C)

---

## 🎯 Best Practices

### Security
- ✅ Keep Node.js updated
- ✅ Use strong Guacamole passwords
- ✅ Enable HTTPS on Guacamole server
- ✅ Review print history weekly
- ✅ Lock computer when away

### Performance
- ✅ Close unused browser tabs
- ✅ Clear history regularly
- ✅ Use default printer
- ✅ Restart agent daily
- ✅ Monitor system resources

### Troubleshooting
- ✅ Check console first (F12)
- ✅ Verify agent status
- ✅ Test with simple files
- ✅ Keep extension updated
- ✅ Document configuration

---

## 📞 Emergency Commands

### Kill All Node Processes
```cmd
taskkill /F /IM node.exe
```

### Stop All Browsers
```cmd
taskkill /F /IM chrome.exe
taskkill /F /IM msedge.exe
taskkill /F /IM firefox.exe
```

### Reset Firewall Rules
```cmd
netsh advfirewall firewall delete rule name="Guacamole Print Agent"
```

### Clear All History
```cmd
del /Q /S "%USERPROFILE%\Downloads\PrintJobs\*"
```

---

## 💡 Pro Tips

### 1. Auto-Start Agent
Create a shortcut:
```
Target: %CD%\START_AGENT.bat
Location: %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
```

### 2. Browser Auto-Start
Add extension to browser startup:
- Chrome: `chrome://settings/onStartup`
- Edge: `edge://settings/onStartup`

### 3. Keyboard Shortcut
Not available by default, but you can use browser extensions to add:
- Alt+P → Open print dialog

### 4. Multiple Browsers
Extension works with multiple browsers simultaneously.
Install in all browsers you use.

### 5. Backup Configuration
Copy these files:
```
guacamole-extension/server/certificates/
guacamole-extension/server/history/
guacamole-extension/server/config.json
```

---

## 📞 Support Links

### Documentation
- Main Guide: `WINDOWS_INSTALLATION_GUIDE.md`
- Extension: `guacamole-extension/README.md`
- Installation: `guacamole-extension/INSTALLATION_COMPLETE.md`

### Online Resources
- Guacamole: https://guacamole.apache.org/
- Node.js: https://nodejs.org/docs/
- Chrome Extensions: https://developer.chrome.com/docs/extensions/
- Edge Extensions: https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/

---

## ✅ Daily Checklist

- [ ] Agent started (no errors)
- [ ] Extension connected (green status)
- [ ] Print button visible
- [ ] Can print PDF files
- [ ] Can save files to Downloads
- [ ] History tracking working
- [ ] Port 8181 listening
- [ ] No console errors

---

**📱 Save this file for quick reference during daily use!**

For detailed instructions, see `WINDOWS_INSTALLATION_GUIDE.md`
