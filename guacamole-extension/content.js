// Guacamole Print Agent - Content Script
// Intercepts file downloads and provides user interface for action selection

class GuacamoleFileInterceptor {
    constructor() {
        this.websocket = null;
        this.isConnected = false;
        this.connectionAttempts = 0;
        this.maxConnectionAttempts = 5;
        this.interceptedFiles = new Map();
        this.config = {
            endpoint: 'wss://localhost:8181/ws',
            connectionTimeout: 5000,
            reconnectInterval: 3000,
            maxFileSize: 50 * 1024 * 1024, // 50MB
            allowedTypes: ['pdf', 'xlsx', 'xls', 'docx', 'doc', 'jpg', 'jpeg', 'png', 'txt', 'zip', 'rar'],
            showNotifications: true,
            autoProcess: false
        };
        
        this.init();
    }

    async init() {
        console.log('Guacamole Print Agent: Initializing...');
        
        // Load configuration
        await this.loadConfig();
        
        // Connect to local agent
        this.connectWebSocket();
        
        // Set up file download interception
        this.setupDownloadInterception();
        
        // Set up DOM monitoring for Guacamole elements
        this.setupDOMMonitoring();
        
        // Set up network request monitoring
        this.setupNetworkMonitoring();
        
        // Create UI elements
        this.createUIElements();
        
        console.log('Guacamole Print Agent: Initialization complete');
    }

    async loadConfig() {
        try {
            const stored = await chrome.storage.sync.get('guacamolePrintConfig');
            if (stored.guacamolePrintConfig) {
                this.config = { ...this.config, ...stored.guacamolePrintConfig };
            }
        } catch (error) {
            console.warn('Failed to load config:', error);
        }
    }

    async saveConfig() {
        try {
            await chrome.storage.sync.set({ guacamolePrintConfig: this.config });
        } catch (error) {
            console.warn('Failed to save config:', error);
        }
    }

    connectWebSocket() {
        if (this.connectionAttempts >= this.maxConnectionAttempts) {
            console.error('Guacamole Print Agent: Max connection attempts reached');
            this.showNotification('Connection Error', 'Unable to connect to local print agent', 'error');
            return;
        }

        try {
            console.log(`Guacamole Print Agent: Connecting to ${this.config.endpoint} (attempt ${this.connectionAttempts + 1})`);
            
            this.websocket = new WebSocket(this.config.endpoint);
            
            this.websocket.onopen = () => {
                console.log('Guacamole Print Agent: WebSocket connected');
                this.isConnected = true;
                this.connectionAttempts = 0;
                this.showNotification('Connected', 'Successfully connected to local print agent', 'success');
            };

            this.websocket.onclose = (event) => {
                console.log('Guacamole Print Agent: WebSocket disconnected', event);
                this.isConnected = false;
                
                // Attempt to reconnect
                if (this.connectionAttempts < this.maxConnectionAttempts) {
                    this.connectionAttempts++;
                    setTimeout(() => {
                        this.connectWebSocket();
                    }, this.config.reconnectInterval);
                }
            };

            this.websocket.onerror = (error) => {
                console.error('Guacamole Print Agent: WebSocket error:', error);
                this.isConnected = false;
            };

            this.websocket.onmessage = (event) => {
                this.handleWebSocketMessage(event);
            };

            // Connection timeout
            setTimeout(() => {
                if (this.websocket && this.websocket.readyState === WebSocket.CONNECTING) {
                    this.websocket.close();
                    this.connectionAttempts++;
                    setTimeout(() => {
                        this.connectWebSocket();
                    }, this.config.reconnectInterval);
                }
            }, this.config.connectionTimeout);

        } catch (error) {
            console.error('Guacamole Print Agent: Connection error:', error);
            this.connectionAttempts++;
            setTimeout(() => {
                this.connectWebSocket();
            }, this.config.reconnectInterval);
        }
    }

    handleWebSocketMessage(event) {
        try {
            const message = JSON.parse(event.data);
            
            switch (message.type) {
                case 'connection_established':
                    console.log('Guacamole Print Agent: Connection established');
                    break;
                    
                case 'response':
                    this.handleFileResponse(message);
                    break;
                    
                case 'error':
                    console.error('Guacamole Print Agent: Server error:', message.message);
                    this.showNotification('Error', message.message, 'error');
                    break;
                    
                default:
                    console.log('Guacamole Print Agent: Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('Guacamole Print Agent: Error parsing message:', error);
        }
    }

    setupDownloadInterception() {
        // Override download attribute handling
        const originalCreateElement = document.createElement;
        document.createElement = function(tagName, options) {
            const element = originalCreateElement.call(this, tagName, options);
            
            if (tagName.toUpperCase() === 'A') {
                const originalSetAttribute = element.setAttribute.bind(element);
                
                element.setAttribute = function(name, value) {
                    originalSetAttribute(name, value);
                    
                    if (name === 'download' || name === 'href') {
                        window.guacamoleInterceptor?.checkElementForFile(element);
                    }
                };
                
                const originalClick = element.click.bind(element);
                element.click = function(event) {
                    if (window.guacamoleInterceptor?.checkElementForFile(element)) {
                        event?.preventDefault();
                    } else {
                        originalClick(event);
                    }
                };
            }
            
            return element;
        };

        // Listen for download events
        document.addEventListener('click', (event) => {
            const link = event.target.closest('a[href], [download]');
            if (link) {
                this.checkElementForFile(link);
            }
        });

        // Monitor download using downloads API
        if (chrome.downloads) {
            chrome.downloads.onCreated.addListener((downloadItem) => {
                this.handleDownloadItem(downloadItem);
            });
        }
    }

    setupDOMMonitoring() {
        // Monitor for dynamically added download links
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const links = node.querySelectorAll ? 
                            node.querySelectorAll('a[href], [download]') : [];
                        links.forEach(link => this.checkElementForFile(link));
                        
                        if (node.tagName === 'A') {
                            this.checkElementForFile(node);
                        }
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    setupNetworkMonitoring() {
        // Monitor network requests for file downloads
        const originalFetch = window.fetch;
        window.fetch = function(url, options) {
            const promise = originalFetch.apply(this, arguments);
            
            // Check if this looks like a file download
            if (typeof url === 'string' && window.guacamoleInterceptor?.isFileUrl(url)) {
                promise.then(response => {
                    if (response.ok && window.guacamoleInterceptor?.shouldInterceptResponse(response)) {
                        window.guacamoleInterceptor?.handleNetworkResponse(url, response.clone());
                    }
                });
            }
            
            return promise;
        };

        // Monitor XMLHttpRequest
        const originalXHROpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url) {
            this._url = url;
            return originalXHROpen.apply(this, arguments);
        };

        const originalXHRSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function() {
            if (this._url && window.guacamoleInterceptor?.isFileUrl(this._url)) {
                const originalOnReadyStateChange = this.onreadystatechange;
                this.onreadystatechange = function() {
                    if (this.readyState === 4 && this.status === 200) {
                        if (window.guacamoleInterceptor?.shouldInterceptResponse(this.response)) {
                            window.guacamoleInterceptor?.handleNetworkResponse(this._url, this);
                        }
                    }
                    if (originalOnReadyStateChange) {
                        originalOnReadyStateChange.apply(this, arguments);
                    }
                };
            }
            return originalXHRSend.apply(this, arguments);
        };
    }

    createUIElements() {
        // Create file action modal
        const modal = document.createElement('div');
        modal.id = 'guacamole-print-modal';
        modal.className = 'guacamole-print-modal';
        modal.innerHTML = `
            <div class="guacamole-modal-content">
                <div class="guacamole-modal-header">
                    <h3>Guacamole File Action</h3>
                    <button class="guacamole-close-btn">&times;</button>
                </div>
                <div class="guacamole-modal-body">
                    <div class="guacamole-file-info">
                        <h4 id="guacamole-file-name">File Name</h4>
                        <p id="guacamole-file-size">Size: 0 bytes</p>
                        <p id="guacamole-file-type">Type: Unknown</p>
                    </div>
                    <div class="guacamole-preview-container">
                        <img id="guacamole-preview" style="display: none;" alt="Preview">
                    </div>
                    <div class="guacamole-actions">
                        <button id="guacamole-action-print" class="guacamole-btn guacamole-btn-primary">
                            🖨️ Print
                        </button>
                        <button id="guacamole-action-download" class="guacamole-btn guacamole-btn-secondary">
                            💾 Download
                        </button>
                        <button id="guacamole-action-open" class="guacamole-btn guacamole-btn-secondary">
                            📂 Open
                        </button>
                        <button id="guacamole-action-cancel" class="guacamole-btn guacamole-btn-cancel">
                            ✖ Cancel
                        </button>
                    </div>
                    <div class="guacamole-remember-choice">
                        <label>
                            <input type="checkbox" id="guacamole-remember"> Remember my choice for this file type
                        </label>
                    </div>
                </div>
                <div class="guacamole-modal-footer">
                    <div class="guacamole-progress" style="display: none;">
                        <div class="guacamole-progress-bar">
                            <div class="guacamole-progress-fill"></div>
                        </div>
                        <span class="guacamole-progress-text">0%</span>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Set up modal event handlers
        this.setupModalHandlers();
        
        // Create status indicator
        const indicator = document.createElement('div');
        indicator.id = 'guacamole-status-indicator';
        indicator.className = 'guacamole-status-indicator';
        indicator.innerHTML = `
            <div class="guacamole-status-dot guacamole-status-disconnected"></div>
            <span class="guacamole-status-text">Disconnected</span>
        `;
        
        document.body.appendChild(indicator);
        
        this.updateStatusIndicator();
    }

    setupModalHandlers() {
        const modal = document.getElementById('guacamole-print-modal');
        const closeBtn = modal.querySelector('.guacamole-close-btn');
        const cancelBtn = document.getElementById('guacamole-action-cancel');
        
        closeBtn.addEventListener('click', () => this.hideModal());
        cancelBtn.addEventListener('click', () => this.hideModal());
        
        // Action buttons
        document.getElementById('guacamole-action-print').addEventListener('click', () => {
            this.executeFileAction('print');
        });
        
        document.getElementById('guacamole-action-download').addEventListener('click', () => {
            this.executeFileAction('download');
        });
        
        document.getElementById('guacamole-action-open').addEventListener('click', () => {
            this.executeFileAction('open');
        });
        
        // Close modal when clicking outside
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                this.hideModal();
            }
        });
    }

    checkElementForFile(element) {
        try {
            const href = element.getAttribute('href') || '';
            const download = element.getAttribute('download') || '';
            
            if (this.isFileUrl(href) || download) {
                event.preventDefault();
                this.interceptFileDownload(element, href, download);
                return true;
            }
        } catch (error) {
            console.error('Error checking element:', error);
        }
        
        return false;
    }

    isFileUrl(url) {
        if (!url) return false;
        
        // Check URL patterns that suggest file downloads
        const filePatterns = [
            /\.pdf$/i,
            /\.xlsx?$/i,
            /\.docx?$/i,
            /\.jpe?g$/i,
            /\.png$/i,
            /\.txt$/i,
            /\.zip$/i,
            /\.rar$/i,
            /\/download\//i,
            /\/file\//i,
            /\/attachment\//i,
            /guacamole/i
        ];
        
        return filePatterns.some(pattern => pattern.test(url)) || 
               url.includes('Content-Disposition') ||
               url.includes('filename=');
    }

    async handleNetworkResponse(url, response) {
        try {
            console.log('Guacamole Print Agent: Handling network response for:', url);
            
            let fileContent;
            let contentType = 'application/octet-stream';
            let fileName = this.extractFileNameFromUrl(url);
            
            if (response instanceof Response) {
                const blob = await response.blob();
                fileContent = await this.blobToBase64(blob);
                contentType = blob.type || contentType;
                fileName = fileName || this.extractFileNameFromHeaders(response.headers);
            } else if (response.response) {
                fileContent = btoa(response.response);
                contentType = this.extractContentTypeFromResponse(response) || contentType;
            }
            
            if (fileContent && this.shouldProcessFile(fileName, fileContent)) {
                this.promptForFileAction(fileName, fileContent, contentType, url);
            }
        } catch (error) {
            console.error('Error handling network response:', error);
        }
    }

    handleDownloadItem(downloadItem) {
        try {
            if (!downloadItem.filename || !downloadItem.url) return;
            
            console.log('Guacamole Print Agent: Download item detected:', downloadItem.filename);
            
            if (this.shouldProcessFile(downloadItem.filename)) {
                // Cancel the default download
                chrome.downloads.cancel(downloadItem.id);
                
                // Get file content (this is limited - better to intercept earlier)
                chrome.downloads.search({ id: downloadItem.id }, (results) => {
                    if (results.length > 0) {
                        const item = results[0];
                        this.promptForFileAction(
                            item.filename,
                            null, // Content not available at this point
                            item.mime || 'application/octet-stream',
                            item.url
                        );
                    }
                });
            }
        } catch (error) {
            console.error('Error handling download item:', error);
        }
    }

    async interceptFileDownload(element, href, download) {
        try {
            const fileName = download || this.extractFileNameFromUrl(href);
            const url = href || element.getAttribute('href');
            
            console.log('Guacamole Print Agent: Intercepting file download:', fileName);
            
            // Get file content
            const response = await fetch(url);
            const blob = await response.blob();
            const fileContent = await this.blobToBase64(blob);
            
            if (this.shouldProcessFile(fileName, fileContent)) {
                this.promptForFileAction(fileName, fileContent, blob.type, url);
            } else {
                // Fallback to normal download
                this.performNormalDownload(element, url, download);
            }
        } catch (error) {
            console.error('Error intercepting download:', error);
            // Fallback to normal download
            this.performNormalDownload(element, href, download);
        }
    }

    shouldProcessFile(fileName, fileContent = null) {
        if (!fileName) return false;
        
        const extension = this.getFileExtension(fileName).toLowerCase();
        const isAllowedType = this.config.allowedTypes.includes(extension);
        const isValidSize = !fileContent || fileContent.length <= this.config.maxFileSize;
        
        return isAllowedType && isValidSize;
    }

    async promptForFileAction(fileName, fileContent, contentType, source) {
        try {
            console.log('Guacamole Print Agent: Prompting for action on:', fileName);
            
            // Show modal with file info
            this.showModal(fileName, fileContent, contentType);
            
            // Store file data for action execution
            const fileId = Date.now().toString();
            this.interceptedFiles.set(fileId, {
                fileName,
                fileContent,
                contentType,
                source,
                timestamp: new Date().toISOString()
            });
            
            // Auto-process if configured
            if (this.config.autoProcess) {
                const defaultAction = this.getDefaultActionForFile(fileName);
                setTimeout(() => {
                    this.executeFileAction(defaultAction);
                }, 1000);
            }
        } catch (error) {
            console.error('Error showing prompt:', error);
        }
    }

    showModal(fileName, fileContent, contentType) {
        const modal = document.getElementById('guacamole-print-modal');
        const fileNameEl = document.getElementById('guacamole-file-name');
        const fileSizeEl = document.getElementById('guacamole-file-size');
        const fileTypeEl = document.getElementById('guacamole-file-type');
        const previewEl = document.getElementById('guacamole-preview');
        
        // Update file info
        fileNameEl.textContent = fileName;
        fileSizeEl.textContent = fileContent ? `Size: ${this.formatFileSize(fileContent.length)}` : 'Size: Unknown';
        fileTypeEl.textContent = `Type: ${contentType || 'Unknown'}`;
        
        // Show preview if available
        if (fileContent && contentType && contentType.startsWith('image/')) {
            previewEl.src = `data:${contentType};base64,${fileContent}`;
            previewEl.style.display = 'block';
        } else {
            previewEl.style.display = 'none';
        }
        
        // Show modal
        modal.style.display = 'flex';
        modal.classList.add('guacamole-modal-show');
    }

    hideModal() {
        const modal = document.getElementById('guacamole-print-modal');
        modal.style.display = 'none';
        modal.classList.remove('guacamole-modal-show');
    }

    async executeFileAction(action) {
        try {
            // Get the current file (simplified - should be tracked properly)
            const currentFile = Array.from(this.interceptedFiles.values()).pop();
            if (!currentFile) {
                throw new Error('No file data available');
            }
            
            this.showProgress(0);
            
            if (!this.isConnected) {
                throw new Error('Not connected to local print agent');
            }
            
            const message = {
                messageId: this.generateMessageId(),
                type: 'file_transfer',
                action: action,
                file: {
                    name: currentFile.fileName,
                    type: currentFile.contentType,
                    size: currentFile.fileContent ? currentFile.fileContent.length : 0,
                    content: currentFile.fileContent,
                    availableActions: this.getAvailableActions(currentFile.fileName)
                },
                metadata: {
                    userName: this.extractUserName(),
                    sessionId: this.extractSessionId(),
                    source: currentFile.source || 'browser_extension',
                    timestamp: new Date().toISOString()
                }
            };
            
            this.websocket.send(JSON.stringify(message));
            
            // Remember choice if requested
            const rememberCheckbox = document.getElementById('guacamole-remember');
            if (rememberCheckbox.checked) {
                await this.saveUserPreference(currentFile.fileName, action);
            }
            
            this.hideModal();
            
        } catch (error) {
            console.error('Error executing file action:', error);
            this.showNotification('Error', `Failed to ${action} file: ${error.message}`, 'error');
            this.hideProgress();
        }
    }

    handleFileResponse(message) {
        try {
            this.hideProgress();
            
            if (message.status === 'success') {
                this.showNotification('Success', `File ${message.data.action} completed successfully`, 'success');
            } else {
                this.showNotification('Error', message.message || 'File action failed', 'error');
            }
        } catch (error) {
            console.error('Error handling file response:', error);
        }
    }

    showProgress(percent) {
        const progress = document.querySelector('.guacamole-progress');
        const fill = document.querySelector('.guacamole-progress-fill');
        const text = document.querySelector('.guacamole-progress-text');
        
        progress.style.display = 'block';
        fill.style.width = `${percent}%`;
        text.textContent = `${percent}%`;
    }

    hideProgress() {
        const progress = document.querySelector('.guacamole-progress');
        progress.style.display = 'none';
    }

    updateStatusIndicator() {
        const dot = document.querySelector('.guacamole-status-dot');
        const text = document.querySelector('.guacamole-status-text');
        
        if (this.isConnected) {
            dot.className = 'guacamole-status-dot guacamole-status-connected';
            text.textContent = 'Connected';
        } else {
            dot.className = 'guacamole-status-dot guacamole-status-disconnected';
            text.textContent = 'Disconnected';
        }
    }

    showNotification(title, message, type = 'info') {
        if (!this.config.showNotifications) return;
        
        // Use browser notifications if available
        if (chrome.notifications) {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon64.png',
                title: title,
                message: message
            });
        } else {
            // Fallback to console
            console.log(`[${type.toUpperCase()}] ${title}: ${message}`);
        }
    }

    // Helper methods
    generateMessageId() {
        return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getFileExtension(fileName) {
        const parts = fileName.split('.');
        return parts.length > 1 ? parts[parts.length - 1] : '';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    extractFileNameFromUrl(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const filename = pathname.split('/').pop();
            
            if (filename && filename.includes('.')) {
                return filename;
            }
            
            // Try to extract from search parameters
            const params = new URLSearchParams(urlObj.search);
            return params.get('filename') || params.get('download') || 'unknown_file';
        } catch (error) {
            return 'unknown_file';
        }
    }

    async blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    getDefaultActionForFile(fileName) {
        const extension = this.getFileExtension(fileName).toLowerCase();
        
        const actionMap = {
            'pdf': 'print',
            'jpg': 'prompt',
            'jpeg': 'prompt',
            'png': 'prompt',
            'xlsx': 'download',
            'xls': 'download',
            'docx': 'download',
            'doc': 'download',
            'txt': 'download',
            'zip': 'download',
            'rar': 'download'
        };
        
        return actionMap[extension] || 'download';
    }

    getAvailableActions(fileName) {
        const extension = this.getFileExtension(fileName).toLowerCase();
        
        const actionMap = {
            'pdf': ['print', 'download', 'open'],
            'jpg': ['print', 'download', 'open'],
            'jpeg': ['print', 'download', 'open'],
            'png': ['print', 'download', 'open'],
            'xlsx': ['download', 'open', 'print'],
            'xls': ['download', 'open', 'print'],
            'docx': ['download', 'open', 'print'],
            'doc': ['download', 'open', 'print'],
            'txt': ['download', 'open'],
            'zip': ['download'],
            'rar': ['download']
        };
        
        return actionMap[extension] || ['download'];
    }

    extractUserName() {
        // Try to get username from various sources
        return window.location.pathname.split('/')[1] || 'unknown_user';
    }

    extractSessionId() {
        // Try to get session ID from URL or other sources
        const match = window.location.search.match(/[?&]session=([^&]+)/);
        return match ? match[1] : 'unknown_session';
    }

    async saveUserPreference(fileName, action) {
        try {
            const extension = this.getFileExtension(fileName).toLowerCase();
            const preferences = await chrome.storage.sync.get('guacamoleUserPreferences') || {};
            preferences.guacamoleUserPreferences = preferences.guacamoleUserPreferences || {};
            preferences.guacamoleUserPreferences[extension] = action;
            await chrome.storage.sync.set(preferences);
        } catch (error) {
            console.warn('Failed to save user preference:', error);
        }
    }

    performNormalDownload(element, url, download) {
        // Create a temporary link to trigger normal download
        const link = document.createElement('a');
        link.href = url;
        if (download) {
            link.download = download;
        }
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Initialize the interceptor when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.guacamoleInterceptor = new GuacamoleFileInterceptor();
    });
} else {
    window.guacamoleInterceptor = new GuacamoleFileInterceptor();
}