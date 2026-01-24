/*
 * Guacamole Print Agent - Client Side JavaScript
 * Embedded directly into Guacamole web interface for file transfer functionality
 */

// Global object for print agent communication
window.guacamolePrintAgent = {
    connection: null,
    config: {
        wsUrl: 'ws://localhost:8181/ws',
        wssUrl: 'wss://localhost:8181/ws',
        maxFileSize: 50 * 1024 * 1024, // 50MB
        allowedFileTypes: ['.pdf', '.xlsx', '.xls', '.docx', '.doc', '.jpg', '.jpeg', '.png', '.txt', '.zip', '.rar'],
        defaultAction: 'prompt',
        enablePreviews: true,
        enableNotifications: true
    },
    
    activeTransfers: new Map(),
    
    init: function() {
        console.log('🚀 Guacamole Print Agent: Initializing client-side JavaScript');
        
        // Create debug overlay
        this.createDebugOverlay();
        
        // Create modal FIRST to ensure it exists before any operations
        console.log('🎨 Setting up UI first...');
        this.setupUI();
        
        console.log('🔗 Setting up WebSocket connection...');
        this.connect();
        
        console.log('📡 Setting up file transfer interception...');
        this.setupFileTransferInterception();
        
        console.log('🖨️ Setting up print interception...');
        this.setupPrintInterception();
        
        console.log('✅ Guacamole Print Agent initialization complete');
    },
    
    createDebugOverlay: function() {
        // Create a small debug indicator
        const debugOverlay = document.createElement('div');
        debugOverlay.id = 'guacamole-print-debug';
        debugOverlay.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: #ff6b6b;
            color: white;
            padding: 5px 10px;
            border-radius: 5px;
            font-size: 12px;
            font-weight: bold;
            z-index: 99999;
            pointer-events: none;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        `;
        debugOverlay.textContent = '🖨️ PRINT AGENT LOADED';
        document.body.appendChild(debugOverlay);
        
        console.log('🎯 Debug overlay created');
    },
    
    connect: async function() {
        if (!window.guacamolePrintAgent.connection) {
            console.log('Connecting to local print agent...');
            
            // Try both WebSocket URLs with fallback
            const wsUrls = [
                window.guacamolePrintAgent.config.wsUrl,  // ws://localhost:8181/ws
                'ws://localhost:8181/ws',                // ws://localhost:8181/ws
                'ws://127.0.0.1:8181/ws',            // ws://127.0.0.1:8181/ws
                'ws://127.0.0.1:8181',               // ws://127.0.0.1:8181
                'wss://localhost:8181/ws',               // wss://localhost:8181/ws (SSL)
                'wss://127.0.0.1:8181/ws',            // wss://127.0.0.1:8181/ws (SSL)
                'wss://localhost:8181',               // wss://localhost:8181 (SSL)
                'wss://127.0.0.1:8181'               // wss://127.0.0.1:8181 (SSL)
            ];
            
            for (const wsUrl of wsUrls) {
                try {
                    console.log(`Trying WebSocket URL: ${wsUrl}`);
                    this.connection = new WebSocket(wsUrl);
                    
                    // Wait for connection to be established
                    const connected = await new Promise((resolve) => {
                        const timeout = setTimeout(() => {
                            this.connection.close();
                            resolve(false);
                        }, 2000);

                        this.connection.onopen = () => {
                            clearTimeout(timeout);
                            console.log('Connected to local print agent via:', wsUrl);
                            window.guacamolePrintAgent.status = 'connected';
                            window.guacamolePrintAgent.showMessage('Connected to local print agent', 'success');
                            this.setupWebSocketHandlers(this.connection);
                            resolve(true);
                        };

                        this.connection.onerror = (error) => {
                            clearTimeout(timeout);
                            console.error('WebSocket error:', error);
                            resolve(false);
                        };

                        this.connection.onclose = () => {
                            clearTimeout(timeout);
                            resolve(false);
                        };
                    });

                    if (connected) {
                        return; // Successfully connected
                    }
                    
                } catch (error) {
                    console.warn(`Failed to connect to ${wsUrl}:`, error);
                    // Continue to next URL
                    continue;
                }
            }
            
            // If all WebSocket attempts fail, work without local agent
            console.warn('Could not connect to local print agent - working in standalone mode');
            window.guacamolePrintAgent.status = 'disconnected';
            window.guacamolePrintAgent.showMessage('Local print agent not available - using standalone mode', 'warning');
        }
    },
    
    setupWebSocketHandlers: function(connection) {
        connection.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (e) {
                console.error('Failed to parse message:', e);
            }
        };
        
        connection.onerror = (error) => {
            console.error('WebSocket error:', error);
            window.guacamolePrintAgent.status = 'error';
            window.guacamolePrintAgent.showMessage('Connection error', 'error');
        };
        
        connection.onclose = () => {
            console.log('WebSocket connection closed');
            window.guacamolePrintAgent.status = 'disconnected';
            window.guacamolePrintAgent.showMessage('Disconnected from local print agent', 'warning');
        };
    },
    
    handleMessage: function(message) {
        console.log('📨 Received WebSocket message:', message);
        
        switch (message.type) {
            case 'connection_ack':
                console.log('✅ Print agent acknowledged connection');
                window.guacamolePrintAgent.status = 'connected';
                break;
            
            case 'print_response':
                console.log('🖨️ Print response received:', message);
                if (message.status === 'completed') {
                    window.guacamolePrintAgent.showMessage('Print job completed successfully', 'success');
                }
                break;
            
            case 'error':
                console.error('❌ Print agent error:', message.error);
                window.guacamolePrintAgent.showMessage('Print agent error: ' + message.error, 'error');
                break;
            
            default:
                console.log('📨 Unknown message type:', message.type);
        }
    },
    
    setupUI: function() {
        // Create action selection dialog
        if (!document.getElementById('guacamole-print-modal')) {
            const modal = document.createElement('div');
            modal.id = 'guacamole-print-modal';
            modal.className = 'guacamole-print-modal';
            modal.innerHTML = `
                <div class="guacamole-modal-content">
                    <div class="guacamole-modal-header">
                        <h3>🖨️ Guacamole File Action</h3>
                        <span class="guacamole-status-indicator" id="guacamole-status"></span>
                        <button class="guacamole-close-btn">&times;</button>
                    </div>
                    <div class="guacamole-modal-body">
                        <div class="guacamole-file-info">
                            <h4 id="guacamole-file-name">Select Action</h4>
                            <p id="guacamole-file-size"></p>
                            <p id="guacamole-file-type"></p>
                            <div id="guacamole-preview" style="display: none; text-align: center; padding: 20px; background: #f5f5f5; border-radius: 4px;">
                                <span style="color: #666;">No preview available</span>
                            </div>
                        </div>
                        <div class="guacamole-actions" id="guacamole-actions">
                            <button class="guacamole-btn guacamole-btn-primary" data-action="print">
                                🖨️ Print
                            </button>
                            <button class="guacamole-btn guacamole-btn-secondary" data-action="download">
                                💾 Download
                            </button>
                            <button class="guacamole-btn guacamole-btn-secondary" data-action="open">
                                📂 Open
                            </button>
                            <button class="guacamole-btn guacamole-btn-cancel" data-action="cancel">
                                ❌ Cancel
                            </button>
                        </div>
                        <div class="guacamole-progress" style="display: none;">
                            <div class="guacamole-progress-bar">
                                <div class="guacamole-progress-fill" style="width: 0%;"></div>
                            </div>
                            <span class="guacamole-progress-text">0%</span>
                        </div>
                        <div class="guacamole-remember-choice" style="display: none;">
                            <label>
                                <input type="checkbox" id="guacamole-remember-action">
                                Remember my choice for this file type
                            </label>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Add event listeners
            document.querySelector('.guacamole-close-btn').onclick = function() {
                window.guacamolePrintAgent.hideModal();
            };
            
            document.querySelectorAll('.guacamole-btn').forEach(button => {
                button.onclick = function() {
                    const action = this.getAttribute('data-action');
                    window.guacamolePrintAgent.executeAction(action);
                };
            });
        }
    },
    
    setupFileTransferInterception: function() {
        // Override link click handlers for download links
        document.addEventListener('click', function(event) {
            const link = event.target.closest('a');
            if (link && link.href) {
                const fileName = link.getAttribute('download') || link.href.split('/').pop();
                const fileExtension = fileName.split('.').pop().toLowerCase();
                
                if (window.guacamolePrintAgent.config.allowedFileTypes.includes('.' + fileExtension)) {
                    event.preventDefault();
                    event.stopPropagation();
                    
                    console.log('Intercepted file download:', fileName);
                    
                    // For PDF files, default to print action
                    const defaultAction = (fileExtension === 'pdf') ? 'print' : 'prompt';
                    
                    // Fetch file content
                    window.guacamolePrintAgent.downloadFile(link.href, fileName, defaultAction);
                }
            }
        });
        
        // Monitor for dynamically created download links
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.tagName === 'A') {
                        const link = node;
                        const fileName = link.getAttribute('download') || link.href.split('/').pop();
                        const fileExtension = fileName.split('.').pop().toLowerCase();
                        
                        if (window.guacamolePrintAgent.config.allowedFileTypes.includes('.' + fileExtension)) {
                            // Set up click listener for new link
                            link.addEventListener('click', function(event) {
                                const targetLink = event.target;
                                const targetFileName = targetLink.getAttribute('download') || targetLink.href.split('/').pop();
                                
                                if (window.guacamolePrintAgent.config.allowedFileTypes.includes('.' + targetFileName.split('.').pop().toLowerCase())) {
                                    event.preventDefault();
                                    console.log('Intercepted dynamic file download:', targetFileName);
                                    window.guacamolePrintAgent.downloadFile(targetLink.href, targetFileName);
                                }
                            });
                        }
                    }
                });
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    },
    
    setupPrintInterception: function() {
        // Override Guacamole print functionality
        console.log('Setting up print interception...');
        
        // Wait for Guacamole to load and override its print functionality
        const overrideGuacamolePrint = () => {
            if (window.Guacamole && window.Guacamole.Client) {
                console.log('Found Guacamole Client - overriding print functionality');
                
                // Override Guacamole.Client.prototype.sendBlob
                const originalSendBlob = window.Guacamole.Client.prototype.sendBlob;
                if (originalSendBlob) {
                    window.Guacamole.Client.prototype.sendBlob = function(stream, mimetype, filename, blob) {
                        console.log('Guacamole print intercepted:', filename, mimetype);
                        
                        // Check if this is a PDF
                        if (mimetype === 'application/pdf' || filename.endsWith('.pdf')) {
                            // Convert blob to base64
                            const reader = new FileReader();
                            reader.onload = (e) => {
                                const base64 = e.target.result;
                                
                                // Send to print agent
                                if (window.guacamolePrintAgent.connection) {
                                    window.guacamolePrintAgent.sendToServer({
                                        type: 'print',
                                        file: {
                                            name: filename,
                                            type: mimetype,
                                            data: base64,
                                            size: blob.size
                                        }
                                    });
                                    
                                    window.guacamolePrintAgent.showMessage('Sent to print agent', 'success');
                                } else {
                                    console.warn('Print agent not connected');
                                    // Fallback to original behavior
                                    originalSendBlob.apply(this, arguments);
                                }
                            };
                            reader.readAsDataURL(blob);
                            return;
                        }
                        
                        // Not a PDF, use original behavior
                        originalSendBlob.apply(this, arguments);
                    };
                    
                    console.log('✅ Guacamole print interception enabled');
                }
            } else {
                // Try again in 1 second
                setTimeout(overrideGuacamolePrint, 1000);
            }
        };
        
        // Start overriding
        setTimeout(overrideGuacamolePrint, 2000);
        
        console.log('✅ Print interception setup complete');
    },
    
    triggerPrintExport: function() {
        console.log('Triggering Guacamole print/export...');
        
        // Try to find and trigger Guacamole's built-in export functionality
        const exportMethods = [
            () => window.Guacamole && window.Guacamole.Session && window.Guacamole.Session.exportFile && window.Guacamole.Session.exportFile(),
            () => window.guacamoleSession && window.guacamoleSession.exportFile && window.guacamoleSession.exportFile(),
            () => this.findAndTriggerGuacamoleExport(),
            () => this.simulateKeyPressForPrint()
        ];
        
        // Try each method until one works
        for (const method of exportMethods) {
            try {
                const result = method();
                if (result) {
                    console.log('Export triggered successfully');
                    return;
                }
            } catch (error) {
                console.log('Export method failed:', error);
            }
        }
        
        console.warn('Could not trigger automatic export, showing manual prompt');
        this.showManualExportPrompt();
    },
    
    findAndTriggerGuacamoleExport: function() {
        // Look for hidden file download links that Guacamole might create
        const exportLinks = document.querySelectorAll('a[download][href*=".pdf"]');
        if (exportLinks.length > 0) {
            const link = exportLinks[0];
            const fileName = link.getAttribute('download') || 'guacamole-export.pdf';
            console.log('Found export link:', fileName);
            this.downloadFile(link.href, fileName, 'print');
            return true;
        }
        return false;
    },
    
    simulateKeyPressForPrint: function() {
        // Try to trigger print via keyboard shortcuts
        const keys = [
            { key: 'p', ctrlKey: true }, // Ctrl+P
            { key: 'Print' }, // Print key
            { key: 'F11' } // Some apps use F11 for fullscreen export
        ];
        
        keys.forEach(keyConfig => {
            try {
                const event = new KeyboardEvent('keydown', {
                    key: keyConfig.key,
                    ctrlKey: keyConfig.ctrlKey || false,
                    bubbles: true
                });
                document.dispatchEvent(event);
                console.log('Triggered key:', keyConfig.key);
            } catch (error) {
                console.log('Key simulation failed:', error);
            }
        });
    },
    
    showManualExportPrompt: function() {
        this.showModal('Export to Print', 'application/pdf', null);
        this.showMessage('Please use the Print button below to export and print', 'info');
    },
    
    downloadFile: function(url, fileName, defaultAction) {
        console.log('Downloading file:', fileName, url, 'Default action:', defaultAction);
        
        // Show modal with file info
        window.guacamolePrintAgent.showModal(fileName, null, null);
        
        // Helper function
        const arrayBufferToBase64 = (buffer) => {
            let binary = '';
            const bytes = new Uint8Array(buffer);
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return window.btoa(binary);
        };
        
        // Fetch file content
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const contentLength = response.headers.get('content-length');
                const totalBytes = parseInt(contentLength);
                let receivedBytes = 0;
                
                return response.arrayBuffer();
            })
            .then(arrayBuffer => {
                const fileContent = arrayBufferToBase64(arrayBuffer);
                const fileSize = fileContent.length;
                const fileExtension = fileName.split('.').pop().toLowerCase();
                
                console.log('File fetched, size:', fileSize, 'Extension:', fileExtension);
                
                // Always use 'prompt' to show dialog with Print, Download, Open, Cancel buttons
                let action = 'prompt';
                
                // Store current transfer data
                window.guacamolePrintAgent.currentTransfer = {
                    fileName: fileName,
                    fileType: window.guacamolePrintAgent.getFileType(fileName),
                    fileSize: fileSize,
                    fileContent: fileContent
                };
                
                // Update modal with file content after download completes
                window.guacamolePrintAgent.showModal(fileName, window.guacamolePrintAgent.getFileType(fileName), fileContent);
                
                // Only send to agent if action is not 'prompt' (prompt means show dialog for user choice)
                if (action !== 'prompt') {
                    window.guacamolePrintAgent.sendFileToAgent({
                        name: fileName,
                        type: window.guacamolePrintAgent.getFileType(fileName),
                        content: fileContent,
                        size: fileSize,
                        action: action
                    });
                }
            })
            .catch(error => {
                console.error('Failed to download file:', error);
                window.guacamolePrintAgent.hideModal();
                window.guacamolePrintAgent.showMessage('Failed to download file: ' + error.message, 'error');
            });
    },
    
    showModal: function(fileName, fileType, fileContent) {
        console.log('🎯 showModal called with:', fileName, fileType, fileContent ? 'content present' : 'no content');
        
        let modal = document.getElementById('guacamole-print-modal');
        
        // Add modal existence check and recreate if missing
        if (!modal) {
            console.error('❌ Modal element not found - recreating UI');
            this.setupUI(); // Recreate modal if missing
            modal = document.getElementById('guacamole-print-modal');
            if (!modal) {
                console.error('❌ Still could not create modal - aborting');
                return;
            }
        }
        
        const fileNameEl = document.getElementById('guacamole-file-name');
        const fileSizeEl = document.getElementById('guacamole-file-size');
        const fileTypeEl = document.getElementById('guacamole-file-type');
        const previewEl = document.getElementById('guacamole-preview');
        const actionsEl = document.getElementById('guacamole-actions');
        
        if (!fileNameEl || !fileSizeEl || !fileTypeEl) {
            console.error('❌ Modal elements missing - recreate UI');
            this.setupUI();
            return this.showModal(fileName, fileType, fileContent); // Retry
        }
        
        fileNameEl.textContent = fileName || 'Unknown file';
        
        // Update file type attribute for styling
        if (actionsEl) {
            if (fileType === 'application/pdf') {
                actionsEl.setAttribute('data-file-type', 'pdf');
                console.log('📄 Set PDF file type for actions');
            } else {
                actionsEl.removeAttribute('data-file-type');
            }
        }
        
        if (fileContent) {
            const fileSize = fileContent.length;
            fileSizeEl.textContent = `Size: ${window.guacamolePrintAgent.formatFileSize(fileSize)}`;
            
            // Show preview if it's an image or PDF
            if (fileType && (fileType.includes('image/') || fileType === 'application/pdf')) {
                previewEl.innerHTML = `<img src="data:${fileType};base64,${fileContent}" style="max-width: 100%; max-height: 100px; object-fit: contain;">`;
                previewEl.style.display = 'block';
            } else {
                previewEl.style.display = 'none';
            }
        } else {
            fileSizeEl.textContent = 'Size: Unknown';
            previewEl.style.display = 'none';
        }
        
        if (fileType) {
            fileTypeEl.textContent = `Type: ${fileType}`;
        } else {
            fileTypeEl.textContent = 'Type: Unknown';
        }
        
        console.log('🎯 Showing modal with display: flex and class');
        modal.style.display = 'flex';
        modal.classList.add('guacamole-modal-show');
        
        // Debug: Check if modal is actually visible
        setTimeout(() => {
            const computedStyle = window.getComputedStyle(modal);
            console.log('🎯 Modal computed display style:', computedStyle.display);
            console.log('🎯 Modal has class:', modal.classList.contains('guacamole-modal-show'));
        }, 100);
        
        // For PDFs, automatically highlight the print option
        if (fileType === 'application/pdf') {
            this.showMessage('PDF detected - Use Print button to send to printer', 'info');
        }
    },
    
    hideModal: function() {
        const modal = document.getElementById('guacamole-print-modal');
        modal.classList.remove('guacamole-modal-show');
        
        // Reset progress
        window.guacamolePrintAgent.updateProgress(0);
    },
    
    executeAction: function(action) {
        const activeTransfer = window.guacamolePrintAgent.currentTransfer;
        if (!activeTransfer) {
            console.warn('No active transfer to execute action:', action);
            window.guacamolePrintAgent.hideModal();
            return;
        }
        
        activeTransfer.action = action;
        window.guacamolePrintAgent.updateProgress(10); // Start progress
        
        // Send to local agent
        const message = {
            messageId: 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            type: 'fileTransfer',
            file: {
                name: activeTransfer.fileName,
                type: activeTransfer.fileType,
                size: activeTransfer.fileSize,
                content: activeTransfer.fileContent,
                action: action
            }
        };
        
        try {
            window.guacamolePrintAgent.connection.send(JSON.stringify(message));
            console.log('Sending file transfer request for action:', action);
        } catch (error) {
            console.error('Failed to send file transfer request:', error);
            activeTransfer.action = 'error';
            window.guacamolePrintAgent.updateProgress(0);
            window.guacamolePrintAgent.showMessage('Failed to send to local agent: ' + error.message, 'error');
        }
    },
    
    sendFileToAgent: function(fileData) {
        try {
            window.guacamolePrintAgent.connection.send(JSON.stringify({
                messageId: 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                type: 'fileTransfer',
                action: fileData.action,
                file: {
                    name: fileData.name,
                    type: fileData.type,
                    size: fileData.size,
                    content: fileData.content
                }
            }));
            
            console.log('File data sent to local agent:', fileData.name, fileData.action);
        } catch (error) {
            console.error('Failed to send file data:', error);
            window.guacamolePrintAgent.showMessage('Failed to send file to local agent: ' + error.message, 'error');
        }
    },
    
    updateProgress: function(percent) {
        const progressFill = document.querySelector('.guacamole-progress-fill');
        const progressText = document.querySelector('.guacamole-progress-text');
        const progressContainer = document.querySelector('.guacamole-progress');
        
        if (progressFill) {
            progressFill.style.width = percent + '%';
            progressText.textContent = percent + '%';
            progressContainer.style.display = 'block';
        }
        
        if (percent >= 100) {
            setTimeout(() => {
                window.guacamolePrintAgent.hideModal();
            }, 1000);
        }
    },
    
    showMessage: function(message, type) {
        const statusIndicator = document.getElementById('guacamole-status');
        if (!statusIndicator) return;
        
        const statusDot = statusIndicator;
        statusDot.className = 'guacamole-status-dot guacamole-status-' + type;
        
        // Create temporary notification
        const notification = document.createElement('div');
        notification.className = 'guacamole-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#ffc107'};
            color: white;
            padding: 10px 15px;
            border-radius: 4px;
            z-index: 9999;
            font-size: 14px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            animation: slideIn 0.3s ease-out;
            max-width: 300px;
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    },
    
    getFileType: function(fileName) {
        const extension = fileName.split('.').pop().toLowerCase();
        const typeMap = {
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'txt': 'text/plain',
            'zip': 'application/zip',
            'rar': 'application/x-rar-compressed'
        };
        
        return typeMap[extension] || 'application/octet-stream';
    },
    
    formatFileSize: function(bytes) {
        if (bytes < 1024) return bytes + ' bytes';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    },
    
    arrayBufferToBase64: function(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        window.guacamolePrintAgent.init();
    });
} else {
    // DOM might already be loaded
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        window.guacamolePrintAgent.init();
    }
}