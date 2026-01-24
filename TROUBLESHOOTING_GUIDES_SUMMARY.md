# Guacamole Print Extension - Troubleshooting Guides

## 📚 Available Troubleshooting Resources

I've created a comprehensive set of troubleshooting resources to help you diagnose and resolve issues with the Guacamole print extension. Based on your report that the print dialog isn't appearing and you're seeing WebSocket connection failures, here are the resources you need:

---

## 🎯 QUICK START (Recommended First)

### 1. Run Automated Diagnostic
```bash
./quick-diagnostic.sh
```

This 5-minute automated check will:
- ✅ Check if Docker container is running
- ✅ Verify web accessibility of Guacamole and extension files
- ✅ Test local print agent connectivity
- ✅ Check if extension files exist in container
- ✅ Verify index.html integration
- ✅ Provide specific next steps and quick fixes

### 2. Quick Reference Guide
**File:** `TROUBLESHOOTING_QUICK_REFERENCE.md`

Perfect for:
- Users who want a 5-minute diagnostic process
- Quick reference of essential commands
- Immediate fixes for common issues
- Success indicators to check against

---

## 🔧 COMPREHENSIVE TROUBLESHOOTING

### 3. Detailed Guide
**File:** `COMPREHENSIVE_TROUBLESHOOTING_GUIDE.md`

This is the complete troubleshooting manual covering:

#### **Section 1: Extension Loading Verification**
- Browser console debugging
- Network tab analysis
- Visual indicator checks
- Manual file access testing

#### **Section 2: Container Status Checks**
- Docker container verification
- File existence in container
- Index.html integration checks
- Container log analysis

#### **Section 3: Network Configuration**
- Basic connectivity testing
- WebSocket connection verification
- Port availability checks
- Local print agent connectivity

#### **Section 4: Console Debugging**
- Advanced JavaScript debugging
- Error pattern recognition
- Manual function testing
- Debug mode enablement

#### **Section 5: Manual Testing**
- Modal display testing
- File download interception testing
- Print button override testing
- WebSocket communication testing

#### **Section 6: Common Issues & Solutions**
- Extension not loading
- WebSocket connection failures
- Modal not appearing
- Print dialog issues
- CSP and CORS errors

#### **Section 7: Quick Reference Cheat Sheet**
- Essential commands
- PowerShell commands
- Browser console commands
- Success indicators
- URLs to test

---

## 🛠️ PRACTICAL TOOLS

### 4. Existing Scripts You Already Have
- `./verify-print-extension.sh` - Extension verification
- `./inject-print-extension-manually.sh` - Manual file injection
- `./rebuild-guacamole-with-print.sh` - Complete rebuild
- `./diagnose-print-agent.ps1` - Windows print agent diagnostics

### 5. New Quick Diagnostic Script
- `./quick-diagnostic.sh` - Comprehensive 5-minute health check

---

## 🚀 YOUR IMMEDIATE ACTION PLAN

Based on your current issues (print dialog not appearing, WebSocket failures), here's what to do:

### Step 1: Run Quick Diagnostic (2 minutes)
```bash
./quick-diagnostic.sh
```

This will likely show:
- ❌ Extension files missing from container (as I found in testing)
- ✅ Local print agent running
- ✅ Guacamole web interface accessible

### Step 2: Fix Missing Files (1 minute)
```bash
./inject-print-extension-manually.sh
```

### Step 3: Verify Fix (1 minute)
```bash
./quick-diagnostic.sh
```

### Step 4: Test in Browser (2 minutes)
1. Open `http://localhost:8080/guacamole`
2. Press F12 → Console
3. Look for: `🚀 Guacamole Print Agent: Initializing client-side JavaScript`
4. Look for red "🖨️ PRINT AGENT LOADED" badge
5. Test manual modal: `window.guacamolePrintAgent.showModal('test.pdf', 'application/pdf', null);`

---

## 🎯 Expected Results After Fix

If the extension is working correctly, you should see:

### In Browser Console:
```
🚀 Guacamole Print Agent: Initializing client-side JavaScript
🎨 Setting up UI first...
🔗 Setting up WebSocket connection...
📡 Setting up file transfer interception...
🖨️ Setting up print interception...
✅ Guacamole Print Agent initialization complete
Connected to local print agent
```

### Visual Indicators:
- ✅ Red "🖨️ PRINT AGENT LOADED" badge in top-left corner
- ✅ Extension files load with 200 OK status
- ✅ WebSocket connects successfully

### Functional Tests:
- ✅ Print modal appears when triggered manually
- ✅ File downloads trigger print modal automatically
- ✅ Print functionality works end-to-end

---

## 📞 If Problems Persist

If you've followed the steps above and still have issues:

1. **Run full diagnostic collection:**
   ```bash
   ./quick-diagnostic.sh > diagnostic-output.txt 2>&1
   ```

2. **Collect browser information:**
   - Screenshot of Console tab (F12)
   - Screenshot of Network tab (filtered by JS/CSS)
   - Note browser version and OS

3. **Review comprehensive guide:**
   - Check `COMPREHENSIVE_TROUBLESHOOTING_GUIDE.md`
   - Focus on Section 6 (Common Issues & Solutions)

---

## 🎉 Success Confirmation

Your print extension is working when:
- [ ] Quick diagnostic shows all green checkmarks
- [ ] Red "🖨️ PRINT AGENT LOADED" badge visible
- [ ] Console shows initialization messages
- [ ] Manual modal test works
- [ ] File download triggers print modal
- [ ] Print functionality works end-to-end

---

**The troubleshooting guides are designed to be self-help resources. Start with the quick diagnostic and reference guide, then use the comprehensive guide only if needed. Most issues should be resolved within 10 minutes using the quick-start approach.**
