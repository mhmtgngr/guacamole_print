/**
 * Guacamole Print Integration
 * Injects print controls directly into Guacamole web application
 * 
 * This script automatically:
 * 1. Adds print button to Guacamole UI
 * 2. Shows connection status indicator
 * 3. Connects to local print agent via WebSocket
 * 4. Monitors for file downloads
 * 5. Provides print/download options
 */

(function() {
    'use strict';

    // ========================================
    // Configuration
    // ========================================
    const config = {
        wsUrl: 'ws://localhost:8181',
        wssUrl: 'wss://localhost:8181',
        checkInterval: 5000,
        retryAttempts: 3,
        retryDelay: 2000,
        maxHistory: 100,
        historyDays: 7
    };

    // ========================================
    // State Management
    // ========================================
    let state = {
        connected: false,
        connecting: false,
        ws: null,
        reconnectAttempts: 0,
        history: [],
        downloadedFiles: []
    };

    // ========================================
    // Logger
    // ========================================
    function log(message, level = 'INFO') {
        const levels = { ERROR: 'color: red', WARN: 'color: yellow', INFO: 'color: cyan', DEBUG: 'color: gray' };
        console.log(`%c[Guacamole Print ${level}] ${message}`, levels[level]);
    }

    // ========================================
    // WebSocket Connection
    // ========================================
    function connectWebSocket() {
        if (state.connecting) {
            log('Already connecting to WebSocket', 'WARN');
            return;
        }

        state.connecting = true;
        const useSSL = window.location.protocol === 'https:';
        const wsUrl = useSSL ? config.wssUrl : config.wsUrl;

        log(`Connecting to WebSocket: ${wsUrl}...`, 'INFO');

        try {
            state.ws = new WebSocket(wsUrl);
            setupWebSocketHandlers();
        } catch (error) {
            log(`WebSocket connection failed: ${error.message}`, 'ERROR');
            state.connecting = false;
            updateStatusIndicator('error');
            scheduleReconnect();
        }
    }

    function setupWebSocketHandlers() {
        state.ws.onopen = function() {
            log('WebSocket connected', 'INFO');
            state.connected = true;
            state.connecting = false;
            state.reconnectAttempts = 0;
            updateStatusIndicator('connected');
            showNotification('Print agent connected', 'success');
        };

        state.ws.onclose = function(event) {
            log(`WebSocket disconnected: ${event.code} - ${event.reason}`, 'WARN');
            state.connected = false;
            state.connecting = false;
            updateStatusIndicator('disconnected');
            scheduleReconnect();
        };

        state.ws.onerror = function(error) {
            log(`WebSocket error`, 'ERROR');
            state.connecting = false;
            updateStatusIndicator('error');
        };

        state.ws.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                handleMessage(data);
            } catch (error) {
                log(`Failed to parse message: ${error.message}`, 'ERROR');
            }
        };
    }

    function scheduleReconnect() {
        if (state.reconnectAttempts < config.retryAttempts) {
            state.reconnectAttempts++;
            const delay = config.retryDelay * state.reconnectAttempts;
            log(`Scheduling reconnect attempt ${state.reconnectAttempts} in ${delay}ms`, 'INFO');
            setTimeout(connectWebSocket, delay);
        } else {
            log('Maximum reconnection attempts reached', 'ERROR');
        }
    }

    // ========================================
    // Message Handling
    // ========================================
    function handleMessage(data) {
        switch (data.type) {
            case 'connected':
                log('Agent acknowledged connection', 'INFO');
                break;
            case 'status':
                log(`Agent status: ${data.status}`, 'INFO');
                break;
            case 'print_response':
                handlePrintResponse(data);
                break;
            case 'download_response':
                handleDownloadResponse(data);
                break;
            default:
                log(`Unknown message type: ${data.type}`, 'WARN');
        }
    }

    function handlePrintResponse(data) {
        if (data.success) {
            log('Print job completed successfully', 'INFO');
            showNotification('Print completed successfully', 'success');
            addToHistory('print', data.file, true);
        } else {
            log(`Print failed: ${data.error}`, 'ERROR');
            showNotification(`Print failed: ${data.error}`, 'error');
            addToHistory('print', data.file, false, data.error);
        }
    }

    function handleDownloadResponse(data) {
        if (data.success) {
            log('Download completed successfully', 'INFO');
            showNotification('Download completed successfully', 'success');
            addToHistory('download', data.file, true);
        } else {
            log(`Download failed: ${data.error}`, 'ERROR');
            showNotification(`Download failed: ${data.error}`, 'error');
            addToHistory('download', data.file, false, data.error);
        }
    }

    function addToHistory(action, file, success, error) {
        const entry = {
            id: Date.now(),
            action: action,
            file: file,
            success: success,
            error: error,
            timestamp: new Date().toISOString()
        };

        state.history.unshift(entry);

        // Limit history size
        if (state.history.length > config.maxHistory) {
            state.history = state.history.slice(0, config.maxHistory);
        }

        // Save to localStorage
        try {
            localStorage.setItem('guacamole-print-history', JSON.stringify(state.history));
        } catch (error) {
            log(`Failed to save history: ${error.message}`, 'WARN');
        }
    }

    function loadHistory() {
        try {
            const saved = localStorage.getItem('guacamole-print-history');
            if (saved) {
                state.history = JSON.parse(saved);
            }
        } catch (error) {
            log(`Failed to load history: ${error.message}`, 'WARN');
        }
    }

    // ========================================
    // UI Components
    // ========================================
    function createStatusIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'guacamole-print-status';
        indicator.className = 'guacamole-print-status';
        indicator.innerHTML = '<div class="status-indicator status-disconnected" title="Print Agent Status"></div>';
        document.body.appendChild(indicator);
        return indicator;
    }

    function createPrintButton() {
        const button = document.createElement('button');
        button.id = 'guacamole-print-button';
        button.className = 'guacamole-print-button';
        button.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z" />
            </svg>
            <span>Print</span>
        `;
        button.onclick = showPrintDialog;
        return button;
    }

    function showPrintDialog() {
        const downloadedFiles = getDownloadedFiles();

        const dialog = document.createElement('div');
        dialog.className = 'guacamole-print-dialog';
        dialog.onclick = function(e) {
            if (e.target === dialog) {
                dialog.remove();
            }
        };

        if (downloadedFiles.length === 0) {
            dialog.innerHTML = `
                <div class="dialog-header">
                    <h3>Guacamole Print Manager</h3>
                    <button class="close-button" onclick="this.closest('.guacamole-print-dialog').remove()">✕</button>
                </div>
                <div class="dialog-content">
                    <div class="file-list-empty">
                        No files found.<br>
                        Download a file from Guacamole first.
                    </div>
                </div>
                <div class="dialog-footer">
                    <button class="history-button" onclick="window.guacamolePrint.showHistory()">View History</button>
                </div>
            `;
        } else {
            dialog.innerHTML = `
                <div class="dialog-header">
                    <h3>Guacamole Print Manager</h3>
                    <button class="close-button" onclick="this.closest('.guacamole-print-dialog').remove()">✕</button>
                </div>
                <div class="dialog-content">
                    <div class="file-list">
                        ${downloadedFiles.map(file => createFileItem(file)).join('')}
                    </div>
                </div>
                <div class="dialog-footer">
                    <button class="history-button" onclick="window.guacamolePrint.showHistory()">View History</button>
                </div>
            `;
        }

        document.body.appendChild(dialog);
    }

    function createFileItem(file) {
        const fileType = getFileType(file.name);
        const fileIcon = getFileIcon(fileType);

        return `
            <div class="file-item" data-url="${file.url}" data-name="${file.name}">
                <div class="file-icon">${fileIcon}</div>
                <div class="file-info">
                    <div class="file-name">${file.name}</div>
                    <div class="file-meta">${fileType || 'Unknown type'}</div>
                </div>
                <div class="file-actions">
                    <button class="print-button" onclick="event.stopPropagation(); window.guacamolePrint.handleFileAction('${file.url}', 'print')">Print</button>
                    <button class="download-button" onclick="event.stopPropagation(); window.guacamolePrint.handleFileAction('${file.url}', 'download')">Download</button>
                </div>
            </div>
        `;
    }

    function showHistory() {
        loadHistory();

        const dialog = document.createElement('div');
        dialog.className = 'guacamole-print-dialog';
        dialog.onclick = function(e) {
            if (e.target === dialog) {
                dialog.remove();
            }
        };

        if (state.history.length === 0) {
            dialog.innerHTML = `
                <div class="dialog-header">
                    <h3>Print History</h3>
                    <button class="close-button" onclick="this.closest('.guacamole-print-dialog').remove()">✕</button>
                </div>
                <div class="dialog-content">
                    <div class="file-list-empty">
                        No history yet.
                    </div>
                </div>
                <div class="dialog-footer">
                    <button class="settings-button" onclick="window.guacamolePrint.clearHistory()">Clear History</button>
                </div>
            `;
        } else {
            dialog.innerHTML = `
                <div class="dialog-header">
                    <h3>Print History</h3>
                    <button class="close-button" onclick="this.closest('.guacamole-print-dialog').remove()">✕</button>
                </div>
                <div class="dialog-content">
                    <div class="file-list">
                        ${state.history.map(entry => createHistoryItem(entry)).join('')}
                    </div>
                </div>
                <div class="dialog-footer">
                    <button class="settings-button" onclick="window.guacamolePrint.clearHistory()">Clear History</button>
                </div>
            `;
        }

        document.body.appendChild(dialog);
    }

    function createHistoryItem(entry) {
        const icon = entry.success ? '✅' : '❌';
        const actionIcon = entry.action === 'print' ? '🖨️' : '⬇️';

        return `
            <div class="file-item">
                <div class="file-icon">${icon}</div>
                <div class="file-info">
                    <div class="file-name">${actionIcon} ${entry.file ? entry.file.name : 'Unknown'}</div>
                    <div class="file-meta">${new Date(entry.timestamp).toLocaleString()}</div>
                    ${entry.error ? `<div class="file-meta" style="color: #ef4444;">Error: ${entry.error}</div>` : ''}
                </div>
            </div>
        `;
    }

    function clearHistory() {
        if (confirm('Are you sure you want to clear all print history?')) {
            state.history = [];
            localStorage.removeItem('guacamole-print-history');
            log('History cleared', 'INFO');
            showNotification('History cleared', 'info');
            document.querySelector('.guacamole-print-dialog').remove();
        }
    }

    function updateStatusIndicator(status) {
        const indicator = document.getElementById('guacamole-print-status');
        if (!indicator) return;

        const statusEl = indicator.querySelector('.status-indicator');
        statusEl.className = `status-indicator status-${status}`;
    }

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `guacamole-notification notification-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(function() {
            notification.remove();
        }, 3000);
    }

    // ========================================
    // File Management
    // ========================================
    function getDownloadedFiles() {
        const files = [];
        
        // Method 1: Check for download links in DOM
        const downloadLinks = document.querySelectorAll('a[href*="/download"], a[href*="/transfer"], .file-download-link');
        downloadLinks.forEach(link => {
            const href = link.getAttribute('href');
            const fileName = link.textContent || link.getAttribute('download') || extractFileName(href);
            
            // Avoid duplicates
            if (!files.find(f => f.url === href)) {
                files.push({
                    url: href,
                    name: fileName
                });
            }
        });

        // Method 2: Check for Guacamole file manager
        const fileRows = document.querySelectorAll('tr[data-file], [data-file-name]');
        fileRows.forEach(row => {
            const fileName = row.getAttribute('data-file') || row.getAttribute('data-file-name');
            const fileUrl = row.querySelector('a')?.getAttribute('href');
            
            if (fileName && fileUrl && !files.find(f => f.url === fileUrl)) {
                files.push({
                    url: fileUrl,
                    name: fileName
                });
            }
        });

        return files;
    }

    function extractFileName(url) {
        try {
            const urlObj = new URL(url);
            const path = urlObj.pathname;
            const parts = path.split('/');
            const fileName = parts[parts.length - 1];
            return fileName || 'file';
        } catch (error) {
            return url.split('/').pop() || 'file';
        }
    }

    function getFileType(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const types = {
            'pdf': 'PDF Document',
            'doc': 'Word Document',
            'docx': 'Word Document',
            'xls': 'Excel Spreadsheet',
            'xlsx': 'Excel Spreadsheet',
            'ppt': 'PowerPoint Presentation',
            'pptx': 'PowerPoint Presentation',
            'png': 'PNG Image',
            'jpg': 'JPEG Image',
            'jpeg': 'JPEG Image',
            'gif': 'GIF Image',
            'bmp': 'BMP Image',
            'txt': 'Text File',
            'zip': 'ZIP Archive',
            'rar': 'RAR Archive',
            '7z': '7-Zip Archive'
        };
        return types[ext] || 'Unknown type';
    }

    function getFileIcon(fileType) {
        if (fileType.includes('PDF')) return '📄';
        if (fileType.includes('Word')) return '📝';
        if (fileType.includes('Excel')) return '📊';
        if (fileType.includes('PowerPoint')) return '📽️';
        if (fileType.includes('Image')) return '🖼️';
        if (fileType.includes('Archive')) return '📦';
        if (fileType.includes('Text')) return '📃';
        return '📁';
    }

    // ========================================
    // Actions
    // ========================================
    function handleFileAction(url, action) {
        const file = {
            url: url,
            name: extractFileName(url),
            type: getFileType(extractFileName(url))
        };

        if (!state.connected) {
            showNotification('Print agent not connected', 'error');
            return;
        }

        const request = {
            type: `${action}_request`,
            file: {
                name: file.name,
                type: file.type,
                url: file.url
            },
            timestamp: new Date().toISOString()
        };

        try {
            state.ws.send(JSON.stringify(request));
            log(`${action} request sent for: ${file.name}`, 'INFO');
        } catch (error) {
            log(`Failed to send ${action} request: ${error.message}`, 'ERROR');
            showNotification(`Failed to send ${action} request`, 'error');
        }
    }

    // ========================================
    // Initialization
    // ========================================
    function injectCSS() {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/guacamole-print/css/guacamole-print.css';
        document.head.appendChild(link);
        log('CSS injected');
    }

    function init() {
        log('Initializing Guacamole Print Integration...');

        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        // Inject CSS
        injectCSS();

        // Add status indicator
        createStatusIndicator();

        // Add print button to Guacamole header
        const header = findGuacamoleHeader();
        if (header) {
            header.appendChild(createPrintButton());
            log('Print button added to header', 'INFO');
        } else {
            log('Could not find Guacamole header', 'WARN');
        }

        // Load history from localStorage
        loadHistory();

        // Connect to WebSocket
        connectWebSocket();

        // Monitor for file downloads
        observeFileDownloads();

        log('Initialization complete', 'INFO');
    }

    function findGuacamoleHeader() {
        const selectors = [
            '.navbar',
            '.header',
            '[role="navigation"]',
            'nav',
            '.guacamole-header'
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                log(`Found Guacamole header: ${selector}`, 'DEBUG');
                return element;
            }
        }

        log('No Guacamole header found with known selectors', 'WARN');
        return null;
    }

    function observeFileDownloads() {
        // Use MutationObserver to watch for DOM changes
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const links = node.querySelectorAll ? node.querySelectorAll('a[href*="/download"], a[href*="/transfer"]') : [];
                        if (links.length > 0) {
                            log(`Found ${links.length} new download link(s)`, 'DEBUG');
                        }
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        log('File download observer started', 'DEBUG');
    }

    // ========================================
    // Export Functions for HTML Event Handlers
    // ========================================
    window.guacamolePrint = {
        handleFileAction: handleFileAction,
        showHistory: showHistory,
        clearHistory: clearHistory
    };

    // Start initialization
    init();

})();
