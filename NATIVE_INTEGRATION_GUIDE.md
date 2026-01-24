# Guacamole Print Solution - Native Integration Guide

**Integrating Print Control directly into Guacamole Web Application**

---

## 🎯 Overview

This guide shows how to integrate the print functionality **directly into Guacamole's web application**, rather than using a browser extension.

### Benefits of Native Integration:
- ✅ No browser extension required
- ✅ Print controls always visible in Guacamole UI
- ✅ Works across all browsers without extension installation
- ✅ Easier deployment for enterprise environments
- ✅ No need for users to install browser add-ons

---

## 📐 Architecture

```
Guacamole Web App (Native Integration)
├── app.html (modified)
├── app.js (modified)
├── guacamole-print.js (new)
├── guacamole-print.css (new)
└── guacamole-print.html (new)
     ↓
WebSocket Server (localhost:8181)
     ↓
Local Print Agent
```

---

## 🔧 Implementation Options

### Option A: Docker Volume Mounting (Easiest)

Mount custom files into Guacamole container to override default behavior.

### Option B: Custom Guacamole Build (Best for Production)

Build Guacamole from source with print functionality included.

### Option C: Server-Side Injection (Enterprise)

Inject print controls via Nginx or Apache before serving to client.

---

## 🚀 Option A: Docker Volume Mounting

### Step 1: Create Custom Guacamole Directory Structure

```cmd
mkdir guacamole-print-web
cd guacamole-print-web
mkdir css
mkdir js
```

### Step 2: Copy Print Controls

From your `guacamole-extension` folder, copy these files:

```cmd
copy ..\guacamole-extension\popup.html guacamole-print.html
copy ..\guacamole-extension\popup.js guacamole-print.js
copy ..\guacamole-extension\styles.css css\guacamole-print.css
```

### Step 3: Create Integration Script

Create `guacamole-print-web\integrate.js`:

```javascript
/**
 * Guacamole Print Integration
 * Injects print controls into Guacamole web interface
 */

(function() {
    'use strict';

    // Configuration
    const config = {
        wsUrl: 'ws://localhost:8181',
        wssUrl: 'wss://localhost:8181',
        apiEndpoint: '/api/files',
        checkInterval: 5000,
        retryAttempts: 3,
        retryDelay: 2000
    };

    // State management
    let state = {
        connected: false,
        connecting: false,
        ws: null,
        reconnectAttempts: 0
    };

    // Logger
    function log(message, level = 'INFO') {
        const levels = { ERROR: 'red', WARN: 'yellow', INFO: 'cyan', DEBUG: 'gray' };
        console.log(`%c[Guacamole Print ${level}] ${message}`, `color:${levels[level]}`);
    }

    // Create WebSocket connection
    function connectWebSocket() {
        if (state.connecting) {
            return;
        }

        state.connecting = true;
        const useSSL = window.location.protocol === 'https:';
        const wsUrl = useSSL ? config.wssUrl : config.wsUrl;

        log(`Connecting to WebSocket: ${wsUrl}...`);

        try {
            state.ws = new WebSocket(wsUrl);
            setupWebSocketHandlers();
        } catch (error) {
            log(`WebSocket connection failed: ${error.message}`, 'ERROR');
            state.connecting = false;
            scheduleReconnect();
        }
    }

    // Setup WebSocket event handlers
    function setupWebSocketHandlers() {
        state.ws.onopen = () => {
            log('WebSocket connected', 'INFO');
            state.connected = true;
            state.connecting = false;
            state.reconnectAttempts = 0;
            updateStatusIndicator('connected');
        };

        state.ws.onclose = (event) => {
            log(`WebSocket disconnected: ${event.code} - ${event.reason}`, 'WARN');
            state.connected = false;
            state.connecting = false;
            updateStatusIndicator('disconnected');
            scheduleReconnect();
        };

        state.ws.onerror = (error) => {
            log(`WebSocket error: ${error}`, 'ERROR');
            state.connecting = false;
            updateStatusIndicator('error');
        };

        state.ws.onmessage = (event) => {
            handleMessage(JSON.parse(event.data));
        };
    }

    // Handle incoming messages
    function handleMessage(data) {
        switch (data.type) {
            case 'connected':
                log('Agent acknowledged connection');
                break;
            case 'status':
                log(`Agent status: ${data.status}`);
                break;
            case 'print_response':
                handlePrintResponse(data);
                break;
            default:
                log(`Unknown message type: ${data.type}`, 'WARN');
        }
    }

    // Handle print response
    function handlePrintResponse(data) {
        if (data.success) {
            log('Print job completed successfully', 'INFO');
            showNotification('Print completed', 'success');
        } else {
            log(`Print failed: ${data.error}`, 'ERROR');
            showNotification(`Print failed: ${data.error}`, 'error');
        }
    }

    // Schedule reconnection attempt
    function scheduleReconnect() {
        if (state.reconnectAttempts < config.retryAttempts) {
            state.reconnectAttempts++;
            const delay = config.retryDelay * state.reconnectAttempts;
            log(`Scheduling reconnect attempt ${state.reconnectAttempts} in ${delay}ms`);
            setTimeout(connectWebSocket, delay);
        } else {
            log('Maximum reconnection attempts reached', 'ERROR');
        }
    }

    // Send print request
    function sendPrintRequest(file) {
        if (!state.connected) {
            showNotification('Print agent not connected', 'error');
            return false;
        }

        const request = {
            type: 'print_request',
            file: {
                name: file.name,
                type: file.type,
                size: file.size,
                url: file.url,
                data: file.data
            },
            timestamp: new Date().toISOString()
        };

        try {
            state.ws.send(JSON.stringify(request));
            log(`Print request sent for: ${file.name}`);
            return true;
        } catch (error) {
            log(`Failed to send print request: ${error.message}`, 'ERROR');
            return false;
        }
    }

    // Create status indicator
    function createStatusIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'guacamole-print-status';
        indicator.className = 'guacamole-print-status';
        indicator.innerHTML = `
            <div class="status-indicator status-disconnected" title="Print Agent Status"></div>
        `;
        document.body.appendChild(indicator);
        return indicator;
    }

    // Create print button
    function createPrintButton() {
        const button = document.createElement('button');
        button.id = 'guacamole-print-button';
        button.className = 'guacamole-print-button';
        button.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z" />
            </svg>
            Print
        `;
        button.onclick = showPrintDialog;
        return button;
    }

    // Show print dialog
    function showPrintDialog() {
        // Find downloaded files in Guacamole
        const downloadedFiles = findDownloadedFiles();

        if (downloadedFiles.length === 0) {
            showNotification('No files found. Download a file first.', 'info');
            return;
        }

        const dialog = document.createElement('div');
        dialog.className = 'guacamole-print-dialog';
        dialog.innerHTML = `
            <div class="dialog-header">
                <h3>Guacamole Print Manager</h3>
                <button class="close-button" onclick="this.closest('.guacamole-print-dialog').remove()">✕</button>
            </div>
            <div class="dialog-content">
                <div class="file-list">
                    ${downloadedFiles.map(file => `
                        <div class="file-item" data-url="${file.url}" data-name="${file.name}" data-type="${file.type}">
                            <div class="file-icon">📄</div>
                            <div class="file-info">
                                <div class="file-name">${file.name}</div>
                                <div class="file-meta">${formatFileSize(file.size)} • ${file.type}</div>
                            </div>
                            <div class="file-actions">
                                <button class="print-button" onclick="handleFileAction('${file.url}', 'print')">Print</button>
                                <button class="download-button" onclick="handleFileAction('${file.url}', 'download')">Download</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="dialog-footer">
                <button class="history-button" onclick="showHistory()">View History</button>
                <button class="settings-button" onclick="showSettings()">Settings</button>
            </div>
        `;

        document.body.appendChild(dialog);
    }

    // Find downloaded files in Guacamole
    function findDownloadedFiles() {
        // Check DOM for download links
        const downloadLinks = document.querySelectorAll('a[href*="/download"], a[href*="/transfer"]');
        const files = [];

        downloadLinks.forEach(link => {
            const href = link.getAttribute('href');
            const fileName = link.textContent || link.getAttribute('download') || extractFileName(href);
            files.push({
                url: href,
                name: fileName,
                size: 0, // Unknown from DOM
                type: getFileType(fileName)
            });
        });

        return files;
    }

    // Extract filename from URL
    function extractFileName(url) {
        const parts = url.split('/');
        return parts[parts.length - 1] || 'file';
    }

    // Get file type
    function getFileType(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const types = {
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif'
        };
        return types[ext] || 'application/octet-stream';
    }

    // Format file size
    function formatFileSize(bytes) {
        if (bytes === 0) return 'Unknown';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    }

    // Handle file action
    function handleFileAction(url, action) {
        const file = {
            url: url,
            name: extractFileName(url),
            type: getFileType(extractFileName(url)),
            size: 0
        };

        if (action === 'print') {
            sendPrintRequest(file);
        } else if (action === 'download') {
            window.location.href = url;
        }
    }

    // Update status indicator
    function updateStatusIndicator(status) {
        const indicator = document.getElementById('guacamole-print-status');
        if (!indicator) return;

        const statusEl = indicator.querySelector('.status-indicator');
        statusEl.className = `status-indicator status-${status}`;

        switch (status) {
            case 'connected':
                statusEl.title = 'Print Agent Connected';
                break;
            case 'disconnected':
                statusEl.title = 'Print Agent Disconnected';
                break;
            case 'error':
                statusEl.title = 'Print Agent Error';
                break;
        }
    }

    // Show notification
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `guacamole-notification notification-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => notification.remove(), 3000);
    }

    // Initialize
    function init() {
        log('Initializing Guacamole Print Integration...');

        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        // Add status indicator
        createStatusIndicator();

        // Add print button to Guacamole header
        const header = document.querySelector('.navbar, header, [role="navigation"]');
        if (header) {
            header.appendChild(createPrintButton());
            log('Print button added to header');
        }

        // Connect to WebSocket
        connectWebSocket();

        // Monitor for file downloads
        observeFileDownloads();

        log('Initialization complete');
    }

    // Observe file downloads
    function observeFileDownloads() {
        // Use MutationObserver to watch for new download links
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const links = node.querySelectorAll ? node.querySelectorAll('a[href*="/download"], a[href*="/transfer"]') : [];
                        if (links.length > 0) {
                            log(`Found ${links.length} new download link(s)`);
                        }
                    }
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Start initialization
    init();
})();

// Export functions for HTML onclick handlers
window.handleFileAction = handleFileAction;
window.showHistory = function() {
    showNotification('History feature coming soon!', 'info');
};

window.showSettings = function() {
    showNotification('Settings feature coming soon!', 'info');
};
```

### Step 4: Create CSS File

Create `guacamole-print-web\css\guacamole-print.css`:

```css
/* Guacamole Print Integration Styles */

/* Status Indicator */
.guacamole-print-status {
    position: fixed;
    top: 10px;
    left: 10px;
    z-index: 9999;
}

.status-indicator {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

.status-connected {
    background-color: #22c55e;
    animation: pulse 2s infinite;
}

.status-disconnected {
    background-color: #ef4444;
}

.status-error {
    background-color: #f59e0b;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

/* Print Button */
.guacamole-print-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background-color: #a855f7;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
}

.guacamole-print-button:hover {
    background-color: #9333ea;
}

.guacamole-print-button svg {
    width: 20px;
    height: 20px;
}

/* Print Dialog */
.guacamole-print-dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90%;
    max-width: 800px;
    max-height: 80vh;
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    z-index: 9999;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
}

.dialog-header h3 {
    margin: 0;
    font-size: 18px;
    color: #1f2937;
}

.close-button {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #6b7280;
    padding: 0;
    width: 32px;
    height: 32px;
}

.close-button:hover {
    color: #1f2937;
}

.dialog-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
}

.dialog-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-top: 1px solid #e5e7eb;
    background: #f9fafb;
}

/* File List */
.file-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.file-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: white;
    transition: all 0.2s;
}

.file-item:hover {
    border-color: #a855f7;
    box-shadow: 0 2px 8px rgba(168,85,247,0.1);
}

.file-icon {
    font-size: 32px;
}

.file-info {
    flex: 1;
    min-width: 0;
}

.file-name {
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 4px;
}

.file-meta {
    font-size: 12px;
    color: #6b7280;
}

.file-actions {
    display: flex;
    gap: 8px;
}

.print-button,
.download-button,
.history-button,
.settings-button {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.print-button {
    background-color: #a855f7;
    color: white;
}

.print-button:hover {
    background-color: #9333ea;
}

.download-button,
.history-button,
.settings-button {
    background-color: #e5e7eb;
    color: #1f2937;
}

.download-button:hover,
.history-button:hover,
.settings-button:hover {
    background-color: #d1d5db;
}

/* Notifications */
.guacamole-notification {
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 16px 24px;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
}

.notification-success {
    background-color: #22c55e;
}

.notification-error {
    background-color: #ef4444;
}

.notification-info {
    background-color: #3b82f6;
}

@keyframes slideIn {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}
```

### Step 5: Modify Docker Compose

Update `docker-guacamole/docker-compose.yml`:

```yaml
version: '3.8'

services:
  guacamole-client:
    build:
      context: ./build
      dockerfile: Dockerfile.guacamole
    container_name: guacamole-client
    volumes:
      # Mount custom print integration
      - ./guacamole-print-web/:/usr/local/tomcat/webapps/guacamole-print/:ro
      - ./guacamole/guacamole.properties:/opt/tomcat/webapps/guacamole/WEB-INF/classes/guacamole.properties
      - ./guacamole/extensions:/opt/tomcat/webapps/guacamole/WEB-INF/extensions
      - ./user-downloads:/guacamole/downloads
    # ... rest of config
```

### Step 6: Inject Integration into Guacamole

Create Nginx configuration to inject the print integration:

Create `docker-guacamole/nginx/guacamole-print.conf`:

```nginx
# Inject print integration JavaScript and CSS into Guacamole
sub_filter_once '</head>' '
    <link rel="stylesheet" href="/guacamole-print/css/guacamole-print.css">
    <script src="/guacamole-print/js/integrate.js"></script>
</head>';

sub_filter_once '<body>' '
    <script>
        // Configure Guacamole Print
        window.GUACAMOLE_PRINT_CONFIG = {
            wsUrl: "ws://localhost:8181",
            wssUrl: "wss://localhost:8181",
            apiEndpoint: "/api/print"
        };
    </script>
</body>';
```

Add to main `docker-guacamole/nginx/nginx.conf`:

```nginx
# In the http server block, add:
include guacamole-print.conf;
```

---

## 🎯 Option B: Custom Guacamole Build

### Step 1: Clone Guacamole Source

```cmd
git clone https://github.com/apache/guacamole-client.git guacamole-print-build
cd guacamole-print-build
git checkout 1.5.5
```

### Step 2: Add Print Module

Create `guacamole-print-build/extensions/guacamole-print/pom.xml`:

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>org.apache.guacamole</groupId>
    <artifactId>guacamole-print</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>
    <name>Guacamole Print Extension</name>

    <dependencies>
        <dependency>
            <groupId>org.apache.guacamole</groupId>
            <artifactId>guacamole-common</artifactId>
            <version>${project.version}</version>
        </dependency>
    </dependencies>
</project>
```

### Step 3: Build Custom Guacamole

```cmd
cd guacamole-print-build
mvn clean package -DskipTests
```

### Step 4: Deploy Custom Build

Copy the generated WAR file to your Docker setup:

```cmd
copy guacamole-client\target\guacamole-*.war docker-guacamole\guacamole-custom.war
```

Update Dockerfile to use custom WAR:

```dockerfile
COPY guacamole-custom.war /opt/tomcat/webapps/guacamole.war
```

---

## 🚀 Deployment Steps

### Quick Deployment (Option A):

1. **Create Print Integration Directory:**
   ```cmd
   cd C:\Users\Mehmet\guacamole-print-solution
   mkdir guacamole-print-web
   mkdir guacamole-print-web\css
   mkdir guacamole-print-web\js
   ```

2. **Copy Files:**
   ```cmd
   copy guacamole-extension\popup.js guacamole-print-web\js\integrate.js
   copy guacamole-extension\styles.css guacamole-print-web\css\guacamole-print.css
   ```

3. **Update Docker Compose:**
   Add volume mount for print integration

4. **Restart Guacamole:**
   ```cmd
   cd docker-guacamole
   docker-compose down
   docker-compose up -d
   ```

5. **Start Print Agent:**
   ```cmd
   cd guacamole-extension
   node server/websocket-server.js
   ```

6. **Verify Integration:**
   - Open `https://localhost/guacamole/`
   - Look for **purple print button** in header
   - Check **green status indicator** (top-left)
   - Click print button to see file manager

---

## ✅ Verification

### Visual Indicators:
- ✅ **Purple print button** appears in Guacamole header
- ✅ **Green status dot** in top-left corner (connected)
- ✅ **Print dialog** opens when clicking print button
- ✅ **Downloaded files** appear in print dialog

### Functionality Tests:
- ✅ Can view downloaded files
- ✅ Can print files to local printer
- ✅ Can download files to local machine
- ✅ Status updates correctly
- ✅ Reconnects automatically if agent restarts

---

## 📋 Complete File Structure

```
guacamole-print-solution/
├── guacamole-print-web/                  # NEW - Native integration files
│   ├── css/
│   │   └── guacamole-print.css       # Styles
│   ├── js/
│   │   └── integrate.js              # Main integration script
│   └── guacamole-print.html          # Standalone HTML (optional)
├── docker-guacamole/
│   ├── nginx/
│   │   ├── nginx.conf
│   │   └── guacamole-print.conf      # NEW - Injection config
│   └── docker-compose.yml            # Updated with volume mounts
├── guacamole-extension/                 # Browser extension (alternative)
└── local-print-agent/                   # Print agent service
```

---

## 🎯 Benefits Over Browser Extension

### Native Integration:
- ✅ **No extension installation** required for users
- ✅ **Works on all browsers** automatically
- ✅ **Easier enterprise deployment**
- ✅ **Always available** - no per-user setup
- ✅ **Updates with Guacamole** - no separate updates

### Browser Extension (Alternative):
- ⚠️ Requires user to install extension
- ⚠️ Different for Chrome/Firefox/Edge
- ⚠️ Updates separately from Guacamole
- ⚠️ Enterprise deployment is complex

---

## 📞 Troubleshooting

### Print button not appearing:

**Solution:** Check Nginx is injecting the script correctly.

```cmd
cd docker-guacamole
docker-compose logs nginx | grep "integrate.js"
```

### WebSocket not connecting:

**Solution:** Verify agent is running and accessible.

```cmd
# Check agent
tasklist | findstr "node.exe"

# Check port
netstat -an | findstr "8181"

# Restart agent
# Ctrl+C then: node server/websocket-server.js
```

### Files not appearing in dialog:

**Solution:** Check Guacamole download links are being detected.

1. Press F12 in browser
2. Go to Console tab
3. Look for "Found X new download link" messages
4. Check Guacamole HTML structure for download links

---

## 🎉 Complete Integration Summary

You now have a **native Guacamole print solution** that:

1. ✅ **Injects print controls** directly into Guacamole UI
2. ✅ **No browser extension** required
3. ✅ **Works across all browsers**
4. ✅ **Easy enterprise deployment**
5. ✅ **Seamless user experience**

**Files Modified/Created:**
- `guacamole-print-web/js/integrate.js` - Main integration
- `guacamole-print-web/css/guacamole-print.css` - Styling
- `docker-guacamole/nginx/guacamole-print.conf` - Nginx injection
- `docker-guacamole/docker-compose.yml` - Volume mounts

**Next Steps:**
1. Test the integration in development environment
2. Verify all print functionality works
3. Deploy to production
4. Document for users (no extension needed!)

---

**🎯 Native Integration Complete!**

Your Guacamole print solution is now integrated directly into the Guacamole web application. Users can print without installing any browser extensions!
