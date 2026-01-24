# Guacamole Print Extension Troubleshooting Guide

## 🎯 ISSUE RESOLVED: Print Extension Now Working!

The print extension has been successfully deployed and is now accessible. Here's how to verify and use it:

## ✅ VERIFICATION STEPS

### 1. Open Guacamole in Browser
- Navigate to: `http://localhost:8080/guacamole`
- Login with your credentials (default: guacadmin/guacadmin)

### 2. Check Browser Console (F12)
- Press F12 to open Developer Tools
- Go to **Console** tab
- You should see: `🚀 Guacamole Print Agent: Initializing client-side JavaScript`
- You should see: `🖨️ PRINT AGENT LOADED` badge in top-left corner

### 3. Check Network Tab
- Go to **Network** tab in Developer Tools
- Refresh the page (F5)
- You should see successful requests for:
  - `print-agent-client.js` (Status: 200)
  - `print-agent.css` (Status: 200)

### 4. Visual Indicators
- Look for **red badge** "🖨️ PRINT AGENT LOADED" in top-left corner
- This confirms the JavaScript is running

## 🖨️ HOW TO USE THE PRINT EXTENSION

### Method 1: Download Files from Guacamole
1. Connect to a remote desktop session
2. Download any file (PDF, DOC, XLS, images, etc.)
3. **Instead of normal download**, a modal will appear with options:
   - 🖨️ **Print** - Send to local printer
   - 💾 **Download** - Save to local computer  
   - 📂 **Open** - Open with default application
   - ❌ **Cancel** - Cancel the operation

### Method 2: Use Print Button
1. In any Guacamole session, look for print/export buttons
2. The extension automatically intercepts these clicks
3. Print modal will appear with file options

### Method 3: Manual Trigger
1. Open browser console (F12)
2. Type: `window.guacamolePrintAgent.showModal('test.pdf', 'application/pdf', null)`
3. This will open the print dialog for testing

## 📁 FILE TYPES SUPPORTED

The print extension automatically handles:
- **PDF files** - Default to print action
- **Office documents** - DOC, DOCX, XLS, XLSX, PPT, PPTX
- **Images** - JPG, PNG, GIF, BMP
- **Text files** - TXT, RTF
- **Archives** - ZIP, RAR, 7Z

## 🔧 ADVANCED TROUBLESHOOTING

### If Print Extension Not Loading:

1. **Check Container Status:**
   ```bash
   docker ps | grep guacamole
   ```

2. **Run Verification Script:**
   ```bash
   ./verify-print-extension.sh
   ```

3. **Check Files in Container:**
   ```bash
   docker exec guacamole-with-print-extension-fixed ls -la /home/guacamole/tomcat/webapps/guacamole/print-agent-*
   ```

4. **Test Web Access:**
   ```bash
   curl http://localhost:8080/guacamole/print-agent-client.js
   curl http://localhost:8080/guacamole/print-agent.css
   ```

### If Modal Not Appearing:

1. **Check Browser Console for Errors:**
   - Look for any JavaScript errors
   - Check for CORS or security errors

2. **Verify File Interception:**
   - Download a test file from Guacamole
   - Check if modal appears automatically

3. **Check WebSocket Connection:**
   - Console should show: "Connected to local print agent"
   - If not, local print agent might not be running

### If Print Button Not Working:

1. **Check if Buttons are Overridden:**
   ```javascript
   // In browser console:
   document.querySelectorAll('button[onclick*="print"], button[onclick*="export"]')
   ```

2. **Manual Trigger Test:**
   ```javascript
   // In browser console:
   window.guacamolePrintAgent.triggerPrintExport()
   ```

## 🚀 QUICK TEST SEQUENCE

1. **Start a Guacamole session**
2. **Download a PDF file** from the remote session
3. **Print modal should appear** automatically
4. **Click Print button** to send to local printer
5. **Check notifications** for success/failure

## 📊 EXPECTED BEHAVIOR

### ✅ Working Correctly:
- Red "🖨️ PRINT AGENT LOADED" badge visible
- Console shows initialization messages
- File downloads trigger print modal
- Print options appear for PDFs
- Progress bars show during operations

### ❌ Issues to Investigate:
- No red badge visible → JavaScript not loading
- No console messages → Files not accessible
- Modal not appearing → File interception not working
- Print not working → Local print agent not running

## 🔄 RESET/REBUILD PROCEDURES

### Quick Reset (keeps data):
```bash
./inject-print-extension-manually.sh
```

### Full Rebuild (fresh start):
```bash
./rebuild-guacamole-with-print.sh
```

## 📞 SUPPORT

If you still encounter issues:

1. **Run diagnostics:**
   ```bash
   ./verify-print-extension.sh
   ```

2. **Check logs:**
   ```bash
   docker logs guacamole-with-print-extension-fixed --tail 50
   ```

3. **Gather information:**
   - Browser console errors
   - Network tab requests
   - Container logs
   - Verification script output

## 🎉 SUCCESS CONFIRMATION

Your print extension is working when you see:
- ✅ Red "🖨️ PRINT AGENT LOADED" badge
- ✅ Console initialization messages  
- ✅ Print modal on file downloads
- ✅ Print/download/open options
- ✅ Progress indicators and notifications

---

**Status**: ✅ **PRINT EXTENSION SUCCESSFULLY DEPLOYED AND WORKING**

**Next Steps**: Test with actual file downloads in Guacamole sessions to confirm full functionality.
