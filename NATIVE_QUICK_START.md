# Native Guacamole Print Integration - Quick Start

**Integrating Print Controls Directly into Guacamole (No Browser Extension Needed)**

---

## 🎯 What This Does

This approach **injects print controls directly into Guacamole's web pages** via Nginx, eliminating the need for users to install a browser extension.

### Comparison:
| Feature | Browser Extension | Native Integration |
|---------|------------------|-------------------|
| Installation Required | Yes - per user | **No** - server-side |
| Browser Support | Chrome/Edge/Firefox only | **All browsers** |
| Updates | Manual per user | **Automatic** with server |
| Enterprise Deployment | Complex | **Simple** |
| User Experience | Good | **Seamless** |

---

## 🚀 Quick Setup (5 Steps)

### Step 1: Create Integration Files ✅ (Already Done)

Files are ready in `guacamole-print-web/`:
```
guacamole-print-web/
├── css/
│   └── guacamole-print.css       # Styling
├── js/
│   └── integrate.js              # Main integration script
└── inject.html                  # HTML injection template
```

### Step 2: Update Nginx Configuration (2 minutes)

Replace your Nginx configuration:

```cmd
cd docker-guacamole/nginx
copy nginx.conf nginx.conf.backup
copy nginx-native.conf nginx.conf
```

**OR** update existing `nginx.conf` to include injection:
```nginx
# Add this to the server { } block:
sub_filter_types text/html;
sub_filter_once '</head>' '
    <link rel="stylesheet" href="/guacamole-print/css/guacamole-print.css">
    <script src="/guacamole-print/js/integrate.js"></script>
</head>';
```

### Step 3: Update Docker Compose (1 minute)

Use the native integration compose file:

```cmd
cd docker-guacamole
docker-compose down
docker-compose -f docker-compose-native.yml up -d
```

**OR** update existing `docker-compose.yml`:
```yaml
# Add to guacamole-client service volumes:
volumes:
  # ... existing volumes ...
  - ./guacamole-print-web:/usr/local/tomcat/webapps/guacamole-print:ro
```

### Step 4: Restart Services (2 minutes)

```cmd
cd docker-guacamole
docker-compose down
docker-compose up -d
```

### Step 5: Start Print Agent (30 seconds)

```cmd
cd C:\Users\Mehmet\guacamole-print-solution\guacamole-extension
node server/websocket-server.js
```

---

## ✅ Verification

### Check Integration is Active:

1. **Open Guacamole:**
   ```
   https://localhost/guacamole/
   ```

2. **Look for Visual Indicators:**
   - ✅ **Purple Print Button** in header/navigation bar
   - ✅ **Green Status Dot** in top-left corner (connected)

3. **Press F12 → Console:**
   - Look for: `[Guacamole Print INFO] CSS injected`
   - Look for: `[Guacamole Print INFO] Print button added to header`

4. **Test Print Functionality:**
   - Download any file in Guacamole
   - Click **Purple Print Button**
   - See print dialog with file list
   - Click **Print** to send to local printer

---

## 📁 File Structure After Setup

```
C:\Users\Mehmet\guacamole-print-solution\
├── guacamole-print-web/                  # ✅ NEW - Native integration
│   ├── css/
│   │   └── guacamole-print.css       # ✅ Created
│   ├── js/
│   │   └── integrate.js              # ✅ Created
│   └── inject.html                  # ✅ Created
├── docker-guacamole/
│   ├── nginx/
│   │   ├── nginx.conf                 # Update this
│   │   ├── nginx-native.conf           # ✅ NEW - Ready to use
│   │   └── ssl/
│   ├── docker-compose.yml             # Update this
│   ├── docker-compose-native.yml      # ✅ NEW - Ready to use
│   └── ... (other files)
├── guacamole-extension/                 # Print agent (still needed)
│   └── server/websocket-server.js
└── NATIVE_INTEGRATION_GUIDE.md          # ✅ NEW - Detailed guide
```

---

## 🎯 How It Works

### Architecture:

```
1. User opens Guacamole
   ↓
2. Nginx serves Guacamole page
   ↓
3. Nginx injects print CSS/JS into page
   ↓
4. Browser loads print controls
   ↓
5. Print script connects to local agent (localhost:8181)
   ↓
6. User clicks print button
   ↓
7. File sent to agent via WebSocket
   ↓
8. Agent prints to local printer
```

### Nginx Injection Magic:

Nginx `sub_filter` automatically adds this to every Guacamole page:

```html
<head>
    <!-- Guacamole's original content -->
    
    <!-- INJECTED: Print integration CSS -->
    <link rel="stylesheet" href="/guacamole-print/css/guacamole-print.css">
    
    <!-- INJECTED: Print integration JS -->
    <script src="/guacamole-print/js/integrate.js"></script>
</head>
```

---

## 🔧 Configuration Options

### Change WebSocket Port:

Edit `guacamole-print-web/js/integrate.js`:

```javascript
const config = {
    wsUrl: 'ws://localhost:9999',  // Change port
    wssUrl: 'wss://localhost:9999',
    // ...
};
```

### Change Print Button Color:

Edit `guacamole-print-web/css/guacamole-print.css`:

```css
.guacamole-print-button {
    background-color: #your-color;  /* Change purple */
}
```

### Change Status Position:

Edit `guacamole-print-web/css/guacamole-print.css`:

```css
.guacamole-print-status {
    top: 10px;
    left: 10px;
    /* Or use right: 10px for top-right */
}
```

---

## ⚠️ Troubleshooting

### Issue 1: Print button not appearing

**Diagnose:**
```cmd
# Check if Nginx is injecting the script
docker exec guacamole-nginx grep -r "integrate.js" /var/log/nginx/
```

**Fix:**
1. Ensure Nginx configuration includes `sub_filter`
2. Restart Nginx: `docker-compose restart nginx`
3. Check browser console (F12) for errors

### Issue 2: Status shows "Disconnected"

**Fix:**
1. Verify print agent is running:
   ```cmd
   tasklist | findstr "node.exe"
   ```

2. Check port 8181 is accessible:
   ```cmd
   netstat -an | findstr "8181"
   ```

3. Restart agent:
   ```cmd
   # Press Ctrl+C in agent window
   node server/websocket-server.js
   ```

### Issue 3: Files not appearing in dialog

**Fix:**
1. Download a file in Guacamole first
2. Wait 2-3 seconds
3. Click print button again
4. Check browser console for file detection logs

### Issue 4: Nginx sub_filter not working

**Fix:**
Nginx Alpine may need additional headers. Check Nginx version:

```cmd
docker exec guacamole-nginx nginx -v
```

If version < 1.19.0, add to Dockerfile:
```dockerfile
RUN apk add --no-cache nginx-mod-http-sub-filter
```

---

## 📚 Documentation

**Complete Guide:** `NATIVE_INTEGRATION_GUIDE.md`
- Detailed implementation options
- Custom build instructions
- Enterprise deployment guide

**This File:** `NATIVE_QUICK_START.md`
- 5-minute quick setup
- Verification steps
- Troubleshooting

**Integration Files:**
- **CSS:** `guacamole-print-web/css/guacamole-print.css`
- **JS:** `guacamole-print-web/js/integrate.js`
- **Nginx:** `docker-guacamole/nginx/nginx-native.conf`

---

## 🎉 Benefits Summary

### For Administrators:
- ✅ **No user training needed** - print controls are automatic
- ✅ **Centralized updates** - update server, all users get new features
- ✅ **Enterprise-friendly** - no per-user extension management
- ✅ **Cross-browser support** - works on Chrome, Firefox, Safari, Edge

### For Users:
- ✅ **Nothing to install** - just open Guacamole
- ✅ **Always available** - print controls appear on every page
- ✅ **Consistent experience** - same UI across all browsers
- ✅ **No maintenance** - no extension updates to worry about

---

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] Integration files created (`guacamole-print-web/`)
- [ ] Nginx configuration updated with sub_filter
- [ ] Docker Compose updated with volume mounts
- [ ] Print agent tested and working
- [ ] SSL certificates valid
- [ ] Print button appears in Guacamole
- [ ] Status indicator shows green (connected)
- [ ] Test print with sample file
- [ ] Verify download to local works
- [ ] Test on multiple browsers
- [ ] Document for users (optional - none needed!)

---

## 🎯 Next Steps

### Immediate (Today):
1. ✅ Review integration files
2. ✅ Update Nginx configuration
3. ✅ Restart Docker services
4. ✅ Test print functionality

### Optional (Future):
1. 📊 Add print analytics/tracking
2. 🔐 Add authentication for print agent
3. 🖨️ Add printer selection dialog
4. 📱 Optimize for mobile browsers
5. 🎨 Customize UI to match your theme

---

## 📞 Support

### If Issues Occur:

1. **Check Documentation:**
   - `NATIVE_INTEGRATION_GUIDE.md` - Full implementation guide
   - `QUICK_REFERENCE.md` - General troubleshooting

2. **Check Logs:**
   - Nginx: `docker-compose logs nginx`
   - Agent: PowerShell console
   - Browser: F12 → Console tab

3. **Verify Components:**
   - Nginx: `curl -I https://localhost/guacamole/`
   - Agent: `netstat -an | findstr 8181`
   - Integration: View page source, check for injected scripts

4. **Common Fixes:**
   - Restart services
   - Clear browser cache
   - Check firewall settings
   - Verify SSL certificates

---

**🎉 Native Integration Ready!**

Your Guacamole print solution is now configured to work **without browser extensions**. Users can simply open Guacamole and start printing immediately!

**Access:** `https://localhost/guacamole/`
**Agent:** `node server/websocket-server.js` (in guacamole-extension/)
**Verify:** Look for purple print button + green status dot

**No more browser extension installations needed!** 🎊
