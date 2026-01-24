# ✅ AGGRESSIVE PRINT INTERCEPTION - NO BROWSER EXTENSION NEEDED

## 🎯 What This Does

This is an **aggressive file download interception system** that catches ALL print operations from Guacamole WITHOUT requiring any browser extension.

## 🚀 How It Works

### 6 Layers of Interception:

**Layer 1: window.open Override**
- Intercepts any `window.open()` call with `.pdf` in URL
- Blocks default browser behavior
- Sends PDF to local Windows print agent

**Layer 2: URL Change Monitoring**
- Monitors `window.location.href` changes
- Detects when Guacamole navigates to a PDF
- Intercepts before browser starts download

**Layer 3: fetch() Override**
- Overrides global `window.fetch()`
- Detects PDF responses
- Reads blob data and sends to local agent
- Returns empty response to prevent browser download

**Layer 4: Anchor Click Interception**
- Listens for all click events
- Detects clicks on links with `.pdf` href
- Prevents default navigation
- Sends PDF to local agent

**Layer 5: DOM Mutation Observer**
- Watches for new elements added to page
- Detects dynamically created PDF links
- Intercepts clicks on these links

**Layer 6: Guacamole Client Override**
- Overrides `Guacamole.Client.prototype.sendBlob()`
- Catches Guacamole's internal print method
- Intercepts PDF blobs before they reach the browser

---

## 🔧 Configuration

### Windows Service (Local):
- **Port:** 8181
- **Protocol:** WebSocket (ws://)
- **Host:** 127.0.0.1 (localhost)
- **SSL:** Supported (wss://)

### Guacamole Web Interface:
- **URL:** http://localhost:8080/guacamole
- **JavaScript:** `/aggressive-intercept.js` (auto-injected)
- **WebSocket:** Attempts 4 different connection methods

---

## 🧪 Testing

### Step 1: Open Guacamole
```
http://localhost:8080/guacamole
```

### Step 2: Open Developer Console
Press **F12** to open browser Developer Tools
Click on **Console** tab

### Step 3: Look for Init Messages
You should see:
```
🚀 AGGRESSIVE PRINT AGENT INITIALIZING...
🔗 Attempting WebSocket: ws://localhost:8181/ws
✅ WebSocket CONNECTED: ws://localhost:8181/ws
✅ AGGRESSIVE PRINT INTERCEPTION INITIALIZED
📊 PRINT AGENT STATS:
  - WebSocket Connected: true
  - Intercepted Downloads: 0
```

### Step 4: Test Print
1. Connect to a Guacamole session
2. Click **Print** in Guacamole client
3. **Watch the Console** - you should see:
   ```
   📄 INTERCEPTING PDF: document_1737491234567.pdf
   ✅ PDF sent to local print agent
   ✅ PDF SENT
   ```

### Step 5: Check Result
- **Expected:** Windows service shows print dialog (Print/Download/Open)
- **NOT Expected:** Browser PDF save dialog

---

## 🔍 Troubleshooting

### Issue: "No WebSocket Connection"
**Symptoms:**
```
⚠️ Could not connect to local print agent
❌ DISCONNECTED
```

**Solutions:**
1. Check Windows service is running:
   ```powershell
   Get-Service GuacamolePrintAgent
   ```

2. Check port 8181:
   ```powershell
   netstat -an | Select-String ":8181"
   ```

3. Test WebSocket connection:
   Open: `test-local-print-service.html`
   Click: "Test WebSocket Connection"

### Issue: "PDF Still Downloads"
**Symptoms:**
- Print dialog doesn't appear
- Browser still shows PDF save dialog
- Console doesn't show interception

**Solutions:**

1. **Clear Browser Cache:**
   - Chrome: Ctrl+Shift+Delete
   - Edge: Ctrl+Shift+Delete
   - Reload Guacamole page

2. **Check Guacamole Version:**
   - JavaScript may need adjustment for different Guacamole versions
   - Check console for Guacamole object availability

3. **Test Direct PDF Link:**
   - If Guacamole has a direct PDF download link
   - Try clicking it - should be intercepted

### Issue: "No Console Messages"
**Symptoms:**
- Developer Console shows no initialization messages
- No "AGGRESSIVE PRINT AGENT" logs

**Solutions:**

1. **Hard Refresh:**
   - Press Ctrl+F5
   - Or Ctrl+Shift+R (cache bypass)

2. **Verify Script Injection:**
   ```bash
   curl http://localhost:8080/guacamole/ | grep "aggressive-intercept"
   ```
   Should show: `<script src="/aggressive-intercept.js"></script>`

3. **Check Browser Console for Errors:**
   - Look for JavaScript errors
   - Syntax errors would prevent script from running

---

## 📊 What Gets Intercepted

### Direct PDF Downloads:
- Guacamole print → PDF generation
- URL contains `.pdf`
- All file downloads from Guacamole interface

### Guacamole Client Print:
- Internal `sendBlob()` calls
- PDF blobs from Guacamole API
- Stream-based print operations

### Dynamic Links:
- AJAX-generated PDF links
- JavaScript-created download buttons
- Dynamically added elements

---

## 🎯 How to Verify It's Working

### 1. Console Shows Init Messages
```
✅ WebSocket CONNECTED: ws://localhost:8181/ws
✅ AGGRESSIVE PRINT INTERCEPTION INITIALIZED
```

### 2. Print Shows Interception
```
📄 INTERCEPTING PDF: document_1737491234567.pdf
✅ PDF sent to local print agent
```

### 3. Windows Service Receives PDF
Check Windows service logs:
```
📨 Received file: document_1737491234567.pdf
   - Size: 245678 bytes
   - Type: application/pdf
```

### 4. Print Dialog Appears
Windows service shows:
- 🖨️ Print to default printer
- 📥 Download to local computer
- 📂 Open with default application

---

## 🚀 Advanced Configuration

### Change WebSocket Port:
Edit `aggressive-intercept.js`:
```javascript
const AGENT_CONFIG = {
    wsUrl: 'ws://localhost:YOUR_PORT/ws',
    wssUrl: 'wss://localhost:YOUR_PORT/ws'
};
```

### Add More File Types:
Edit `interceptPDF()` function to check for other extensions:
```javascript
if (url && typeof url === 'string' &&
    (url.includes('.pdf') ||
     url.includes('.xlsx') ||
     url.includes('.docx'))) {
    // Intercept
}
```

### Enable Debug Logging:
The script already logs extensively to console.

---

## 📝 Status Indicators

### Green Status Indicator (Top-Left):
```
🖨️ CONNECTED = WebSocket connected to local agent
❌ DISCONNECTED = WebSocket not connected
```

### Console Stats:
```
📊 PRINT AGENT STATS:
  - WebSocket Connected: true/false
  - Intercepted Downloads: number
```

---

## ✅ Success Checklist

- [x] No browser extension required
- [x] All print operations intercepted
- [x] Windows service receives PDFs
- [x] Custom print dialog appears
- [x] No browser PDF save dialog

---

## 🆘 Support

If Still Not Working:

1. **Verify Windows Service:**
   ```powershell
   Get-Service GuacamolePrintAgent | Select-Object Status, StartType
   ```

2. **Check Firewall:**
   ```powershell
   Get-NetFirewallRule -DisplayName "Guacamole Print Agent*"
   ```

3. **Test WebSocket:**
   Open: `test-local-print-service.html`
   Run all connection tests

4. **Check Browser:**
   - Chrome/Edge: Version 88+
   - JavaScript enabled
   - No ad blockers interfering

5. **Review Logs:**
   - Windows service: `C:\GuacamolePrintAgent\logs\`
   - Browser console: F12 → Console tab

---

**🎉 This system intercepts Guacamole printing WITHOUT any browser extension!**
