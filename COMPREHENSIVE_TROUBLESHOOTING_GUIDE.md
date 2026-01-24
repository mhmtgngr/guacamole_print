# Comprehensive Guacamole Print Extension Troubleshooting Guide

## 🔧 TABLE OF CONTENTS

1. [Extension Loading Verification](#1-extension-loading-verification)
2. [Container Status Checks](#2-container-status-checks)
3. [Network Configuration](#3-network-configuration)
4. [Console Debugging](#4-console-debugging)
5. [Manual Testing](#5-manual-testing)
6. [Common Issues & Solutions](#6-common-issues--solutions)
7. [Quick Reference Cheat Sheet](#7-quick-reference-cheat-sheet)

---

## 1. EXTENSION LOADING VERIFICATION

### Step 1.1: Check Browser Console for JavaScript Loading

**Open Developer Tools:**
1. Navigate to `http://localhost:8080/guacamole`
2. Press `F12` or right-click → "Inspect"
3. Go to **Console** tab
4. Clear the console (🗑️ icon)
5. Refresh the page with `Ctrl+F5` (hard refresh)

**Expected Console Messages:**
```
🚀 Guacamole Print Agent: Initializing client-side JavaScript
🎨 Setting up UI first...
🔗 Setting up WebSocket connection...
📡 Setting up file transfer interception...
🖨️ Setting up print interception...
✅ Guacamole Print Agent initialization complete
```

**If You See NO Messages:**
- The JavaScript file is not loading
- Continue to Step 1.2

### Step 1.2: Check Network Tab for File Loading

**Check Network Requests:**
1. In Developer Tools, go to **Network** tab
2. Filter by "JS" and "CSS"
3. Refresh page with `Ctrl+F5`
4. Look for these files:
   - `print-agent-client.js` (Status: **200 OK**)
   - `print-agent.css` (Status: **200 OK**)

**If Files Are Missing (Status 404):**
```bash
# Run verification script to check files
./verify-print-extension.sh
```

**If Files Show 200 But Still No Console Messages:**
1. Click on `print-agent-client.js` in Network tab
2. Check if content loads correctly
3. Look for JavaScript syntax errors in Console tab

### Step 1.3: Visual Indicator Check

**Look for Red Debug Badge:**
- Top-left corner should show: **🖨️ PRINT AGENT LOADED**
- If you see this badge, JavaScript is running
- If no badge, JavaScript failed to initialize

### Step 1.4: Manual JavaScript Injection Test

**Test If Browser Can Load the Files:**
1. Open new browser tab
2. Navigate to: `http://localhost:8080/guacamole/print-agent-client.js`
3. You should see the JavaScript code (not 404 error)
4. Navigate to: `http://localhost:8080/guacamole/print-agent.css`
5. You should see CSS code (not 404 error)

**If 404 Errors:**
- Files are not in the correct location in container
- Run the injection script: `./inject-print-extension-manually.sh`

---

## 2. CONTAINER STATUS CHECKS

### Step 2.1: Verify Guacamole Container is Running

**Check Container Status:**
```bash
docker ps | grep guacamole
```

**Expected Output:**
```
CONTAINER ID   IMAGE                           PORTS                              NAMES
xxxxxxxxxxxx   guacamole-with-print-extension  0.0.0.0:8080->8080/tcp           guacamole-with-print-extension-fixed
```

**If No Container Running:**
```bash
# Start the container
docker-compose -f docker-guacamole/docker-compose.stable.yml up -d
```

### Step 2.2: Check Container Health

**Check Container Logs:**
```bash
docker logs guacamole-with-print-extension-fixed --tail 50
```

**Look for These Messages:**
- Tomcat startup completed
- No port binding errors
- No file permission errors

**Common Issues in Logs:**
- `Address already in use` → Port 8080 conflict
- `Permission denied` → File permission issues
- `404 errors` → Missing files

### Step 2.3: Verify Files Inside Container

**Check if Extension Files Exist:**
```bash
docker exec guacamole-with-print-extension-fixed ls -la /home/guacamole/tomcat/webapps/guacamole/print-agent-*
```

**Expected Output:**
```
-rw-r--r-- 1 root root 12345 Jan 1 12:00 print-agent-client.js
-rw-r--r-- 1 root root 2345 Jan 1 12:00 print-agent.css
```

**If Files Missing:**
```bash
# Manually inject files
./inject-print-extension-manually.sh
```

### Step 2.4: Check Index.html Integration

**Verify Index.html Includes Extension:**
```bash
docker exec guacamole-with-print-extension-fixed grep -n "print-agent" /home/guacamole/tomcat/webapps/guacamole/index.html
```

**Expected Output (should show 2 lines):**
```
123:<link rel="stylesheet" type="text/css" href="print-agent.css">
124:<script src="print-agent-client.js"></script>
```

**If Missing:**
- Run index.html update script
- Or manually edit the file

---

## 3. NETWORK CONFIGURATION

### Step 3.1: Test Basic Guacamole Access

**Check Web Interface Access:**
1. Open browser: `http://localhost:8080/guacamole`
2. Should see login page
3. Try logging in (default: guacadmin/guacadmin)

**If Can't Access:**
- Check if port 8080 is available
- Check firewall settings
- Verify container is running

### Step 3.2: Check Local Print Agent Connectivity

**Test Local Print Agent:**
1. Open browser: `http://localhost:8181/health`
2. Should see JSON response like:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

**If Health Check Fails:**
- Print agent is not running
- Check Windows service or run manually
- Check port 8181 availability

### Step 3.3: Test WebSocket Connection

**WebSocket Connection Test:**
1. In Guacamole browser console (F12), run:
```javascript
// Test WebSocket connection
const testWs = new WebSocket('ws://localhost:8181/ws');
testWs.onopen = () => console.log('✅ WebSocket connected');
testWs.onerror = (e) => console.error('❌ WebSocket failed:', e);
```

**Expected Output:**
```
✅ WebSocket connected
```

**If WebSocket Fails:**
- Local print agent not running
- Port 8181 blocked by firewall
- SSL certificate issues (if using WSS)

### Step 3.4: Port Availability Check

**Check Ports with PowerShell (Windows):**
```powershell
# Check port 8080 (Guacamole)
netstat -an | findstr ":8080"

# Check port 8181 (Print Agent)
netstat -an | findstr ":8181"
```

**Expected Output:**
```
TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING
TCP    0.0.0.0:8181           0.0.0.0:0              LISTENING
```

---

## 4. CONSOLE DEBUGGING

### Step 4.1: Enable Debug Logging

**Turn on Verbose Logging:**
1. In browser console (F12), run:
```javascript
// Enable debug mode
localStorage.setItem('guacamole-print-debug', 'true');
console.log('🐛 Debug mode enabled - refresh page');
```
2. Refresh the page with `Ctrl+F5`
3. Look for detailed debug messages

### Step 4.2: Check for JavaScript Errors

**Look for Red Error Messages:**
- Syntax errors in JavaScript
- Network request failures
- Permission denied errors
- CORS (Cross-Origin) errors

**Common Error Patterns:**
```
Failed to load resource: the server responded with status 404 (Not Found)
WebSocket connection failed: Error in connection establishment
TypeError: Cannot read property 'addEventListener' of null
```

### Step 4.3: Check Print Agent Global Object

**Verify Extension Object Exists:**
1. In console, type:
```javascript
console.log(window.guacamolePrintAgent);
```

**Expected Output:**
```
{connection: null, config: {...}, activeTransfers: Map(0), init: ƒ, ...}
```

**If Undefined:**
- JavaScript file not loaded
- Syntax error preventing execution
- Check Network tab for 404 errors

### Step 4.4: Manually Trigger Extension Functions

**Test Extension Functions:**
```javascript
// Check if functions exist
console.log('showModal exists:', typeof window.guacamolePrintAgent.showModal);
console.log('connect exists:', typeof window.guacamolePrintAgent.connect);

// Manually show modal
window.guacamolePrintAgent.showModal('test.pdf', 'application/pdf', null);

// Check connection status
console.log('Connection status:', window.guacamolePrintAgent.connection);
```

---

## 5. MANUAL TESTING

### Step 5.1: Test Modal Display

**Manual Modal Test:**
1. Log into Guacamole
2. Open browser console (F12)
3. Run:
```javascript
window.guacamolePrintAgent.showModal('test.pdf', 'application/pdf', null);
```

**Expected Result:**
- Print modal should appear
- Should see Print, Download, Open, Cancel options
- No console errors

### Step 5.2: Test File Download Interception

**Download Test File:**
1. Connect to a remote desktop in Guacamole
2. D

---

## 🚀 QUICK-START TROUBLESHOOTING SCRIPT

For users who want to run all checks at once, here's a quick diagnostic sequence:

### Step 1: Run All Automated Checks
```bash
# Run the built-in verification script
./verify-print-extension.sh

# Run Windows print agent diagnostics (if on Windows)
powershell -ExecutionPolicy Bypass -File diagnose-print-agent.ps1
```

### Step 2: Check Browser Loading
1. Open `http://localhost:8080/guacamole`
2. Press F12 → Console
3. Look for: `🚀 Guacamole Print Agent: Initializing client-side JavaScript`
4. Look for: `🖨️ PRINT AGENT LOADED` badge

### Step 3: Test Manual Function
```javascript
// In browser console
window.guacamolePrintAgent.showModal('test.pdf', 'application/pdf', null);
```

### Step 4: Test End-to-End
1. Connect to remote desktop in Guacamole
2. Download any file
3. Print modal should appear automatically

### If Any Step Fails:
- **Step 1 Failed:** Container/service issues
- **Step 2 Failed:** JavaScript not loading → check files
- **Step 3 Failed:** JavaScript loaded but broken → check syntax
- **Step 4 Failed:** Network/communication issues → check WebSocket

---

## 📞 GETTING HELP

If you've tried all the steps above and still have issues:

1. **Collect Diagnostic Information:**
   ```bash
   # Container status and logs
   docker ps | grep guacamole > container-status.txt
   docker logs guacamole-with-print-extension-fixed --tail 100 > container-logs.txt
   
   # Extension verification
   ./verify-print-extension.sh > extension-check.txt 2>&1
   
   # Windows diagnostics
   powershell -ExecutionPolicy Bypass -File diagnose-print-agent.ps1 > windows-diagnostics.txt
   ```

2. **Browser Information:**
   - Take screenshots of Console tab (errors)
   - Take screenshots of Network tab (failed requests)
   - Note browser version and OS

3. **Common Questions to Answer:**
   - What browser and version are you using?
   - Are you accessing Guacamole from localhost or a remote machine?
   - Is the Windows print agent service running?
   - Do you see any error messages in the browser console?
   - Do you see the red "🖨️ PRINT AGENT LOADED" badge?

4. **Submit Issues with:**
   - All diagnostic files from Step 1
   - Browser screenshots from Step 2
   - Answers to questions from Step 3
   - Description of exactly what you tried and what happened

---

**This comprehensive troubleshooting guide should help identify and resolve 95% of common Guacamole print extension issues. The step-by-step approach ensures you can systematically check each component and isolate the problem.**
