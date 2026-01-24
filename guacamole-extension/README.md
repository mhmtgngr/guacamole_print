# Guacamole Print Agent - Browser Extension Installation

## 🚀 Quick Start

### Step 1: Install Local Agent
```bash
cd guacamole-extension
npm install
npm run start:agent
```

### Step 2: Install Browser Extension
**For Chrome/Edge:**
1. Open `chrome://extensions/` or `edge://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select this folder containing `manifest.json`
5. Enable the extension

**For Firefox:**
1. Open `about:debugging`
2. Click "This Firefox"
3. Click "Load Temporary Add-on"
4. Select the `manifest.json` file

### Step 3: Test Installation
1. Visit your Guacamole web interface
2. Look for the **purple print button** in the top-right corner
3. The green status indicator (top-left) should show "Connected"
4. Try downloading a file - you should see the print/save dialog

## ✅ Verification

### Extension Working:
- [x] Purple print button appears on Guacamole pages
- [x] Green "Connected" status indicator
- [x] Print/save dialog when downloading files

### Local Agent Working:
- [x] Console shows "WebSocket server listening on ws://localhost:8181"
- [x] Extension status shows "Connected"
- [x] Test files print/save successfully

## 🛠️ Troubleshooting

### Extension Not Loading:
- Ensure you're using Chrome 88+, Edge 88+, or Firefox 89+
- Check that "Developer mode" is enabled
- Try refreshing the extensions page
- Check browser console for errors

### Agent Not Connecting:
- Verify the agent is running: `npm run start:agent`
- Check port 8181 is not blocked by firewall
- Try restarting the agent

### Print/Save Not Working:
- Check system has available printers
- Verify write permissions to save directory
- Check agent console logs for errors

## 📋 Features Included

✅ **File Download Interception** - Catches all Guacamole downloads  
✅ **WebSocket Communication** - Real-time agent connection  
✅ **Print to Local Printers** - Direct printer integration  
✅ **Save Local Copies** - Automatic file storage  
✅ **7-Day History** - Activity tracking and review  
✅ **Responsive UI** - Works on desktop and mobile  
✅ **Cross-Platform** - Windows, macOS, Linux support  
✅ **Multi-File Types** - PDF, Office docs, images, etc.  
✅ **Status Indicators** - Visual connection feedback  
✅ **Settings Panel** - Customizable options  

## 🎯 Usage Guide

### Printing Files:
1. Download any file in Guacamole
2. Choose "Print" in the dialog
3. Select printer and options
4. Confirm print job

### Saving Files:
1. Download any file in Guacamole
2. Choose "Save" in the dialog
3. File saved to `~/Downloads/PrintJobs/`
4. Access from history panel

### Viewing History:
1. Click the print button
2. Select "View History"
3. Filter by action (Print/Save/Failed)
4. Clear history as needed

## 🔧 Configuration

### Default Settings:
- **Save Location:** `~/Downloads/PrintJobs/`
- **Auto-Print:** Disabled (user choice)
- **Save Copies:** Enabled
- **Print Quality:** Default printer settings

### Customization:
- Access settings via print button menu
- Configure default printer
- Set custom save location
- Toggle auto-print behavior

## 🆘 Support

### Getting Help:
1. Check browser console (F12) for errors
2. Review agent console logs
3. Verify network connection to localhost:8181
4. Test with different file types
5. Check system permissions

### Common Issues:
- **Firewall blocking** - Allow localhost:8181
- **Antivirus blocking** - Add agent to exclusions  
- **Permission denied** - Check write permissions
- **Printer not found** - Verify printer installation

### Performance Tips:
- Large files may take time to process
- Multiple simultaneous jobs queue automatically
- History limited to last 100 entries for performance
- Temporary files cleaned up automatically

---

**🎉 Ready to use! Your Guacamole Print Agent is now installed and configured.**