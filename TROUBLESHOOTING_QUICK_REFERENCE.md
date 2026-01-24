# Guacamole Print Extension - Quick Troubleshooting Reference

## 🚀 5-MINUTE DIAGNOSTIC

### 1. Quick Health Check
```bash
# Run automated verification
./verify-print-extension.sh

# Check container
docker ps | grep guacamole

# Check Windows service
powershell -Command "Get-Service -Name 'GuacamolePrintAgent'"
```

### 2. Browser Check (2 minutes)
1. Open: `http://localhost:8080/guacamole`
2. Press F12 → Console
3. ✅ **Should see:** `🚀 Guacamole Print Agent: Initializing`
4. ✅ **Should see:** Red "🖨️ PRINT AGENT LOADED" badge
5. ❌ **If missing:** Files not loading → run injection script

### 3. Network Test (1 minute)
```bash
# Test URLs in browser
http://localhost:8080/guacamole/print-agent-client.js  # Should show code
http://localhost:8181/health                           # Should show JSON
```

### 4. Manual Test (1 minute)
In browser console (F12):
```javascript
window.guacamolePrintAgent.showModal('test.pdf', 'application/pdf', null);
```
✅ **Expected:** Print modal appears

### 5. End-to-End Test (1 minute)
1. Connect to remote desktop
2. Download any file
3. ✅ **Expected:** Print modal appears automatically

---

## ⚡ QUICK FIXES

### Issue: Extension Not Loading
```bash
./inject-print-extension-manually.sh
```

### Issue: Print Agent Not Running
```powershell
Start-Service -Name "GuacamolePrintAgent"
```

### Issue: Container Not Running
```bash
docker-compose -f docker-guacamole/docker-compose.stable.yml up -d
```

### Issue: WebSocket Connection Failed
1. Check port 8181: `netstat -an | findstr ":8181"`
2. Check Windows service status
3. Run: `.\diagnose-print-agent.ps1`

---

## 🎯 SUCCESS INDICATORS

✅ **Working:**
- Red "🖨️ PRINT AGENT LOADED" badge visible
- Console shows initialization messages  
- Extension files load (200 OK)
- Modal appears on file downloads
- Print functionality works

❌ **Not Working:**
- No debug badge
- No console messages
- 404 errors for files
- WebSocket connection failed
- Service not running

---

## 📱 ESSENTIAL URLS & COMMANDS

### Test URLs
- Guacamole: `http://localhost:8080/guacamole`
- Health Check: `http://localhost:8181/health`
- Extension JS: `http://localhost:8080/guacamole/print-agent-client.js`

### Debug Commands
```bash
# Verify files
./verify-print-extension.sh

# Check logs
docker logs guacamole-with-print-extension-fixed --tail 50

# Inject files
./inject-print-extension-manually.sh

# Rebuild everything
./rebuild-guacamole-with-print.sh
```

### Windows Commands
```powershell
# Service status
Get-Service -Name "GuacamolePrintAgent"

# Port check
netstat -an | findstr ":8181"

# Full diagnostics
.\diagnose-print-agent.ps1
```

### Browser Console Commands
```javascript
// Check extension loaded
console.log(window.guacamolePrintAgent);

// Test modal
window.guacamolePrintAgent.showModal('test.pdf', 'application/pdf', null);

// Test WebSocket
new WebSocket('ws://localhost:8181/ws');

// Enable debug
localStorage.setItem('guacamole-print-debug', 'true');
```

---

## 🆘 ESCALATION PATH

If quick fixes don't work:

1. **Run full diagnostics:**
   ```bash
   ./verify-print-extension.sh > diagnostics.txt 2>&1
   docker logs guacamole-with-print-extension-fixed --tail 100 >> diagnostics.txt
   ```

2. **Check comprehensive guide:** `COMPREHENSIVE_TROUBLESHOOTING_GUIDE.md`

3. **Collect info:**
   - Browser console screenshots
   - Network tab screenshots
   - Diagnostic file output
   - Browser/OS version

---

**For most users, the 5-minute diagnostic and quick fixes will resolve common issues. Use the comprehensive guide only if problems persist.**
