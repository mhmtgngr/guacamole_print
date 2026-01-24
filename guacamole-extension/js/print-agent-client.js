// ==================== GUACAMOLE PRINT AGENT CLIENT SCRIPT ====================
// Content script that runs on Guacamole pages to intercept downloads

class GuacamolePrintClient {
  constructor() {
    this.isInitialized = false;
    this.extensionId = null;
    this.agentConnected = false;
    this.processingFiles = new Set();
    this.downloadHistory = [];
    
    console.log('🚀 Guacamole Print Client Initializing...');
    
    this.initialize();
  }

  // Initialize the client
  async initialize() {
    try {
      console.log('📡 Initializing print client...');
      
      // Check if we're on a Guacamole page
      if (!this.isGuacamolePage()) {
        console.log('ℹ️ Not a Guacamole page - skipping initialization');
        return;
      }
      
      // Get extension ID
      this.extensionId = await this.getExtensionId();
      
      // Setup download interception
      this.setupDownloadInterception();
      
      // Setup file upload monitoring
      this.setupFileUploadMonitoring();
      
      // Setup UI injection
      this.setupUI();
      
      // Setup message listeners
      this.setupMessageListeners();
      
      // Check agent connection
      await this.checkAgentConnection();
      
      this.isInitialized = true;
      console.log('✅ Guacamole Print Client initialized successfully');
      
      // Show ready notification
      this.showNotification('Print Agent Ready', 'Local printing is now available', 'success');
      
    } catch (error) {
      console.error('❌ Failed to initialize print client:', error);
      this.showNotification('Print Agent Error', error.message, 'error');
    }
  }

  // Check if current page is a Guacamole page
  isGuacamolePage() {
    const url = window.location.href;
    return url.includes('guacamole') || 
           document.title.includes('Guacamole') ||
           document.querySelector('meta[name="generator"]')?.content?.includes('guacamole');
  }

  // Get extension ID from background script
  async getExtensionId() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        resolve(chrome.runtime.id);
      } else {
        // Fallback for content script context
        resolve('guacamole-print-agent');
      }
    });
  }

  // Setup download interception
  setupDownloadInterception() {
    console.log('🎯 Setting up download interception...');
    
    // Intercept XMLHttpRequest downloads
    this.interceptXMLHttpRequest();
    
    // Intercept fetch requests
    this.interceptFetchRequests();
    
    // Intercept download links
    this.interceptDownloadLinks();
    
    // Monitor dynamic content
    this.monitorDynamicContent();
  }

  // Intercept XMLHttpRequest downloads
  interceptXMLHttpRequest() {
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
      this._guacamoleUrl = url;
      this._guacamoleMethod = method;
      return originalXHROpen.apply(this, [method, url, ...args]);
    };
    
    XMLHttpRequest.prototype.send = function(...args) {
      const xhr = this;
      
      // Setup response handling for file downloads
      const originalOnReadyStateChange = xhr.onreadystatechange;
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4 && xhr.status === 200) {
          const contentType = xhr.getResponseHeader('Content-Type') || '';
          const contentDisposition = xhr.getResponseHeader('Content-Disposition') || '';
          
          if (window.guacamolePrintClient.shouldInterceptResponse(contentType, contentDisposition, xhr._guacamoleUrl)) {
            window.guacamolePrintClient.handleFileDownload({
              url: xhr._guacamoleUrl,
              method: xhr._guacamoleMethod,
              response: xhr.response,
              responseText: xhr.responseText,
              responseType: xhr.responseType,
              contentType: contentType,
              contentDisposition: contentDisposition,
              size: xhr.getResponseHeader('Content-Length') || 0,
              timestamp: Date.now()
            });
          }
        }
        
        if (originalOnReadyStateChange) {
          originalOnReadyStateChange.apply(this, arguments);
        }
      };
      
      return originalXHRSend.apply(this, args);
    };
  }

  // Intercept fetch requests
  interceptFetchRequests() {
    const originalFetch = window.fetch;
    
    window.fetch = async function(url, options = {}) {
      const response = await originalFetch(url, options);
      
      // Clone the response to avoid body lock
      const clonedResponse = response.clone();
      
      try {
        const contentType = response.headers.get('Content-Type') || '';
        const contentDisposition = response.headers.get('Content-Disposition') || '';
        
        if (window.guacamolePrintClient.shouldInterceptResponse(contentType, contentDisposition, url)) {
          const responseText = await clonedResponse.text();
          
          window.guacamolePrintClient.handleFileDownload({
            url: url,
            method: options.method || 'GET',
            response: responseText,
            responseText: responseText,
            responseType: 'text',
            contentType: contentType,
            contentDisposition: contentDisposition,
            size: response.headers.get('Content-Length') || 0,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        console.warn('Failed to intercept fetch response:', error);
      }
      
      return response;
    };
  }

  // Intercept download links
  interceptDownloadLinks() {
    document.addEventListener('click', (event) => {
      const target = event.target.closest('a[href]');
      if (target && this.isDownloadLink(target)) {
        event.preventDefault();
        this.handleDownloadLink(target);
      }
    }, true);
  }

  // Monitor dynamic content for new download links
  monitorDynamicContent() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check for download links in added nodes
            const downloadLinks = node.querySelectorAll ? 
              node.querySelectorAll('a[download], a[href*="download"], a[href*="export"]') : [];
            
            downloadLinks.forEach(link => {
              if (this.isDownloadLink(link)) {
                link.addEventListener('click', (e) => {
                  e.preventDefault();
                  this.handleDownloadLink(link);
                });
              }
            });
          }
        });
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Setup file upload monitoring
  setupFileUploadMonitoring() {
    console.log('📁 Setting up file upload monitoring...');
    
    // Monitor file input changes
    document.addEventListener('change', (event) => {
      if (event.target.type === 'file' && event.target.files.length > 0) {
        this.handleFileUpload(event.target.files);
      }
    }, true);
    
    // Monitor drag and drop
    document.addEventListener('drop', (event) => {
      if (event.dataTransfer.files.length > 0) {
        event.preventDefault();
        this.handleFileUpload(event.dataTransfer.files);
      }
    }, true);
  }

  // Setup UI injection
  setupUI() {
    console.log('🎨 Setting up user interface...');
    
    // Create print agent button
    this.createPrintButton();
    
    // Create status indicator
    this.createStatusIndicator();
    
    // Create settings panel
    this.createSettingsPanel();
    
    // Create history panel
    this.createHistoryPanel();
  }

  // Create print button
  createPrintButton() {
    const button = document.createElement('button');
    button.id = 'guacamole-print-button';
    button.className = 'guacamole-print-button';
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="6" y="4" width="12" height="8" rx="1"/>
        <rect x="6" y="14" width="12" height="8" rx="1"/>
        <line x1="9" y1="8" x2="15" y2="8"/>
        <line x1="9" y1="18" x2="15" y2="18"/>
      </svg>
      Print with Local Agent
    `;
    
    button.addEventListener('click', () => {
      this.showPrintDialog();
    });
    
    // Insert into page
    document.body.appendChild(button);
  }

  // Create status indicator
  createStatusIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'guacamole-status-indicator';
    indicator.className = 'guacamole-status-indicator guacamole-status-disconnected';
    indicator.innerHTML = `
      <div class="guacamole-status-dot"></div>
      <span class="guacamole-status-text">Not Connected</span>
    `;
    
    document.body.appendChild(indicator);
  }

  // Create settings panel
  createSettingsPanel() {
    const panel = document.createElement('div');
    panel.id = 'guacamole-settings-panel';
    panel.className = 'guacamole-panel guacamole-hidden';
    panel.innerHTML = `
      <div class="guacamole-panel-header">
        <h3>Print Agent Settings</h3>
        <button class="guacamole-close-button">&times;</button>
      </div>
      <div class="guacamole-panel-content">
        <div class="guacamole-setting">
          <label>Default Printer:</label>
          <select id="default-printer">
            <option value="">Select printer...</option>
          </select>
        </div>
        <div class="guacamole-setting">
          <label>
            <input type="checkbox" id="auto-print" checked>
            Auto-print documents
          </label>
        </div>
        <div class="guacamole-setting">
          <label>
            <input type="checkbox" id="save-copies" checked>
            Save local copies
          </label>
        </div>
        <div class="guacamole-setting">
          <label>Default Save Location:</label>
          <input type="text" id="save-location" value="~/Downloads/PrintJobs" placeholder="Enter path...">
        </div>
      </div>
      <div class="guacamole-panel-footer">
        <button class="guacamole-button guacamole-button-primary">Save Settings</button>
        <button class="guacamole-button guacamole-button-secondary">Cancel</button>
      </div>
    `;
    
    document.body.appendChild(panel);
    this.setupPanelListeners(panel);
  }

  // Create history panel
  createHistoryPanel() {
    const panel = document.createElement('div');
    panel.id = 'guacamole-history-panel';
    panel.className = 'guacamole-panel guacamole-hidden';
    panel.innerHTML = `
      <div class="guacamole-panel-header">
        <h3>Print History</h3>
        <button class="guacamole-close-button">&times;</button>
      </div>
      <div class="guacamole-panel-content">
        <div class="guacamole-history-filters">
          <select id="history-filter">
            <option value="all">All Jobs</option>
            <option value="printed">Printed</option>
            <option value="saved">Saved</option>
            <option value="failed">Failed</option>
          </select>
          <button class="guacamole-button guacamole-button-small" id="clear-history">Clear History</button>
        </div>
        <div class="guacamole-history-list" id="history-list">
          <!-- History items will be added here -->
        </div>
      </div>
    `;
    
    document.body.appendChild(panel);
    this.setupPanelListeners(panel);
  }

  // Setup message listeners from background script
  setupMessageListeners() {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        switch (request.action) {
          case 'processFileForPrinting':
            this.processFileForPrinting();
            break;
          default:
            console.log('Unknown message action:', request.action);
        }
      });
    }
  }

  // Check connection to local agent
  async checkAgentConnection() {
    try {
      // First try WebSocket connection
      const websocketConnected = await this.checkWebSocketConnection();
      
      if (websocketConnected) {
        this.agentConnected = true;
        this.updateStatusIndicator(true);
        console.log('📡 Agent connection status: Connected via WebSocket');
        return;
      }
      
      // Fallback to Chrome extension if available
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        const response = await chrome.runtime.sendMessage({
          action: 'checkAgentStatus'
        });
        
        this.agentConnected = response.connected;
        this.updateStatusIndicator(this.agentConnected);
        
        console.log('📡 Agent connection status:', this.agentConnected ? 'Connected via Extension' : 'Disconnected');
      } else {
        this.agentConnected = false;
        this.updateStatusIndicator(false);
        console.log('📡 Agent connection status: Disconnected - No WebSocket or Extension');
      }
    } catch (error) {
      console.warn('Failed to check agent status:', error);
      this.agentConnected = false;
      this.updateStatusIndicator(false);
    }
  }

  // Check WebSocket connection to local print agent
  async checkWebSocketConnection() {
    const urls = [
      'ws://localhost:8182/ws',
      'ws://localhost:8182',
      'ws://127.0.0.1:8182/ws',
      'ws://127.0.0.1:8182',
      'ws://localhost:8181/ws',
      'ws://localhost:8181',
      'ws://127.0.0.1:8181/ws',
      'ws://127.0.0.1:8181'
    ];

    for (const url of urls) {
      try {
        console.log(`🔌 Trying WebSocket URL: ${url}`);
        
        const ws = new WebSocket(url);
        
        const connected = await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            ws.close();
            resolve(false);
          }, 2000);

          ws.onopen = () => {
            clearTimeout(timeout);
            console.log(`✅ Connected to local print agent via: ${url}`);
            this.websocketConnection = ws;
            this.setupWebSocketHandlers(ws);
            resolve(true);
          };

          ws.onerror = (error) => {
            clearTimeout(timeout);
            console.warn(`❌ WebSocket connection failed for ${url}:`, error);
            resolve(false);
          };

          ws.onclose = () => {
            clearTimeout(timeout);
            resolve(false);
          };
        });

        if (connected) {
          return true;
        }
        
      } catch (error) {
        console.warn(`❌ WebSocket attempt failed for ${url}:`, error);
        continue;
      }
    }
    
    return false;
  }

  // Setup WebSocket event handlers
  setupWebSocketHandlers(ws) {
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleWebSocketMessage(message);
      } catch (error) {
        console.warn('Failed to parse WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('🔌 WebSocket connection closed');
      this.agentConnected = false;
      this.updateStatusIndicator(false);
    };

    ws.onerror = (error) => {
      console.warn('🔌 WebSocket error:', error);
      this.agentConnected = false;
      this.updateStatusIndicator(false);
    };
  }

  // Handle WebSocket messages
  handleWebSocketMessage(message) {
    console.log('📨 Received WebSocket message:', message);
    
    switch (message.type) {
      case 'connection_ack':
        console.log('✅ Print agent acknowledged connection');
        this.agentConnected = true;
        this.updateStatusIndicator(true);
        break;
      
      case 'print_response':
        console.log('🖨️ Print response received:', message);
        break;
      
      case 'error':
        console.error('❌ Print agent error:', message.error);
        this.showNotification('Print Agent Error', message.error, 'error');
        break;
      
      default:
        console.log('📨 Unknown message type:', message.type);
    }
  }

  // Send message via WebSocket
  sendWebSocketMessage(message) {
    if (this.websocketConnection && this.websocketConnection.readyState === WebSocket.OPEN) {
      this.websocketConnection.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  // Determine if response should be intercepted
  shouldInterceptResponse(contentType, contentDisposition, url) {
    const urlLower = url.toLowerCase();
    const contentTypeLower = contentType.toLowerCase();
    const contentDispositionLower = contentDisposition.toLowerCase();
    
    // Check for download indicators in URL
    if (urlLower.includes('download') || 
        urlLower.includes('export') || 
        urlLower.includes('print')) {
      return true;
    }
    
    // Check for file content types
    const fileTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml',
      'image/',
      'text/plain',
      'text/csv'
    ];
    
    for (const type of fileTypes) {
      if (contentTypeLower.includes(type)) {
        return true;
      }
    }
    
    // Check content disposition
    if (contentDispositionLower.includes('attachment') || 
        contentDispositionLower.includes('inline')) {
      return true;
    }
    
    return false;
  }

  // Handle file download
  async handleFileDownload(fileInfo) {
    console.log('📥 Intercepted file download:', fileInfo);
    
    // Avoid processing the same file multiple times
    const fileKey = `${fileInfo.url}_${fileInfo.timestamp}`;
    if (this.processingFiles.has(fileKey)) {
      return;
    }
    
    this.processingFiles.add(fileKey);
    
    try {
      // Extract file name
      const fileName = this.extractFileName(fileInfo);
      
      // Create file data object
      const fileData = {
        name: fileName,
        type: fileInfo.contentType,
        size: fileInfo.size,
        data: fileInfo.response,
        url: fileInfo.url,
        timestamp: fileInfo.timestamp
      };
      
      // Show download dialog
      await this.showDownloadDialog(fileData);
      
      // Add to history
      this.addToHistory(fileData, 'downloaded');
      
    } catch (error) {
      console.error('❌ Failed to handle file download:', error);
      this.showNotification('Download Error', error.message, 'error');
    } finally {
      this.processingFiles.delete(fileKey);
    }
  }

  // Handle download link click
  async handleDownloadLink(link) {
    const url = link.href;
    const fileName = link.download || this.extractFileNameFromUrl(url);
    
    console.log('🔗 Processing download link:', url);
    
    try {
      // Fetch the file
      const response = await fetch(url);
      const data = await response.blob();
      
      const fileData = {
        name: fileName,
        type: data.type || 'application/octet-stream',
        size: data.size,
        data: data,
        url: url,
        timestamp: Date.now()
      };
      
      // Show download dialog
      await this.showDownloadDialog(fileData);
      
      // Add to history
      this.addToHistory(fileData, 'downloaded');
      
    } catch (error) {
      console.error('❌ Failed to process download link:', error);
      this.showNotification('Download Error', error.message, 'error');
    }
  }

  // Handle file upload
  async handleFileUpload(files) {
    console.log('📤 Handling file upload:', files);
    
    for (const file of files) {
      const fileData = {
        name: file.name,
        type: file.type,
        size: file.size,
        data: file,
        timestamp: Date.now()
      };
      
      // Add to history
      this.addToHistory(fileData, 'uploaded');
      
      // Show notification
      this.showNotification('File Uploaded', `Successfully uploaded ${file.name}`, 'success');
    }
  }

  // Show download dialog
  async showDownloadDialog(fileData) {
    return new Promise((resolve) => {
      // Create dialog
      const dialog = document.createElement('div');
      dialog.className = 'guacamole-dialog';
      dialog.innerHTML = `
        <div class="guacamole-dialog-content">
          <div class="guacamole-dialog-header">
            <h3>File Downloaded</h3>
            <p>${fileData.name}</p>
            <p>Size: ${this.formatFileSize(fileData.size)}</p>
            <p>Type: ${fileData.type}</p>
          </div>
          <div class="guacamole-dialog-actions">
            <button class="guacamole-button guacamole-button-primary" data-action="print">
              🖨️ Print
            </button>
            <button class="guacamole-button guacamole-button-secondary" data-action="save">
              💾 Save
            </button>
            <button class="guacamole-button guacamole-button-secondary" data-action="preview">
              👁️ Preview
            </button>
            <button class="guacamole-button guacamole-button-secondary" data-action="cancel">
              Cancel
            </button>
          </div>
        </div>
      `;
      
      document.body.appendChild(dialog);
      
      // Setup handlers
      dialog.addEventListener('click', async (event) => {
        const action = event.target.dataset.action;
        if (action) {
          event.preventDefault();
          
          // Remove dialog
          document.body.removeChild(dialog);
          
          // Handle action
          switch (action) {
            case 'print':
              await this.printFile(fileData);
              resolve('print');
              break;
            case 'save':
              await this.saveFile(fileData);
              resolve('save');
              break;
            case 'preview':
              await this.previewFile(fileData);
              resolve('preview');
              break;
            case 'cancel':
              resolve('cancel');
              break;
          }
        }
      });
      
      // Focus first button
      dialog.querySelector('.guacamole-button-primary')?.focus();
    });
  }

  // Print file
  async printFile(fileData) {
    console.log('🖨️ Printing file:', fileData.name);
    
    try {
      // Try WebSocket first
      if (this.websocketConnection && this.websocketConnection.readyState === WebSocket.OPEN) {
        const printMessage = {
          type: 'print',
          data: {
            name: fileData.name,
            type: fileData.type,
            size: fileData.size,
            data: this.arrayBufferToBase64(fileData.data),
            timestamp: fileData.timestamp
          }
        };
        
        if (this.sendWebSocketMessage(printMessage)) {
          this.showNotification('Print Job Sent', `${fileData.name} sent to local printer via WebSocket`, 'success');
          this.addToHistory(fileData, 'printed');
          return;
        }
      }
      
      // Fallback to Chrome extension
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        await chrome.runtime.sendMessage({
          action: 'printFile',
          data: fileData
        });
        
        this.showNotification('Print Job Sent', `${fileData.name} sent to local printer via Extension`, 'success');
        this.addToHistory(fileData, 'printed');
      } else {
        throw new Error('No WebSocket connection or extension runtime available');
      }
    } catch (error) {
      console.error('❌ Failed to print file:', error);
      this.showNotification('Print Failed', error.message, 'error');
    }
  }

  // Convert ArrayBuffer/Base64 data for WebSocket transmission
  arrayBufferToBase64(data) {
    if (data instanceof ArrayBuffer) {
      return btoa(String.fromCharCode.apply(null, new Uint8Array(data)));
    } else if (data instanceof Blob) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          if (result instanceof ArrayBuffer) {
            resolve(this.arrayBufferToBase64(result));
          } else {
            resolve(result);
          }
        };
        reader.readAsArrayBuffer(data);
      });
    } else if (typeof data === 'string') {
      return btoa(unescape(encodeURIComponent(data)));
    } else {
      return data;
    }
  }

  // Save file
  async saveFile(fileData) {
    console.log('💾 Saving file:', fileData.name);
    
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        await chrome.runtime.sendMessage({
          action: 'saveFile',
          data: fileData
        });
        
        this.showNotification('Save Job Sent', `${fileData.name} saved to local storage`, 'success');
        this.addToHistory(fileData, 'saved');
      } else {
        throw new Error('Extension runtime not available');
      }
    } catch (error) {
      console.error('❌ Failed to save file:', error);
      this.showNotification('Save Failed', error.message, 'error');
    }
  }

  // Preview file
  async previewFile(fileData) {
    console.log('👁️ Previewing file:', fileData.name);
    
    try {
      // Create blob URL for preview
      const blob = new Blob([fileData.data], { type: fileData.type });
      const url = URL.createObjectURL(blob);
      
      // Open in new tab
      window.open(url, '_blank');
      
      // Cleanup after 30 seconds
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 30000);
      
    } catch (error) {
      console.error('❌ Failed to preview file:', error);
      this.showNotification('Preview Failed', error.message, 'error');
    }
  }

  // Extract file name from file info
  extractFileName(fileInfo) {
    // Try Content-Disposition first
    const contentDisposition = fileInfo.contentDisposition;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match && match[1]) {
        return match[1].replace(/['"]/g, '');
      }
    }
    
    // Try URL
    return this.extractFileNameFromUrl(fileInfo.url) || `download_${fileInfo.timestamp}`;
  }

  // Extract file name from URL
  extractFileNameFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop();
      
      if (filename && filename !== '') {
        return filename;
      }
      
      // Try to extract from query parameters
      const params = new URLSearchParams(urlObj.search);
      return params.get('filename') || params.get('name') || null;
    } catch (error) {
      return null;
    }
  }

  // Check if link is a download link
  isDownloadLink(link) {
    const href = link.href || '';
    const download = link.download;
    
    // Explicit download attribute
    if (download) {
      return true;
    }
    
    // Check URL patterns
    const downloadPatterns = [
      /download/i,
      /export/i,
      /print/i,
      /pdf/i,
      /doc/i,
      /xls/i,
      /ppt/i
    ];
    
    return downloadPatterns.some(pattern => pattern.test(href));
  }

  // Process file for printing (called from context menu)
  async processFileForPrinting() {
    // This would handle context menu actions
    console.log('🖨️ Processing file for printing from context menu');
  }

  // Show print dialog
  showPrintDialog() {
    console.log('🖨️ Showing print dialog');
    // Implementation for showing comprehensive print dialog
    this.showNotification('Print Dialog', 'Print dialog coming soon!', 'info');
  }

  // Update status indicator
  updateStatusIndicator(connected) {
    const indicator = document.getElementById('guacamole-status-indicator');
    if (indicator) {
      const dot = indicator.querySelector('.guacamole-status-dot');
      const text = indicator.querySelector('.guacamole-status-text');
      
      if (connected) {
        indicator.className = 'guacamole-status-indicator guacamole-status-connected';
        text.textContent = 'Connected';
      } else {
        indicator.className = 'guacamole-status-indicator guacamole-status-disconnected';
        text.textContent = 'Not Connected';
      }
    }
  }

  // Setup panel listeners
  setupPanelListeners(panel) {
    // Close button
    const closeBtn = panel.querySelector('.guacamole-close-button');
    closeBtn.addEventListener('click', () => {
      panel.classList.add('guacamole-hidden');
    });
    
    // Cancel button
    const cancelBtn = panel.querySelector('.guacamole-button-secondary');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        panel.classList.add('guacamole-hidden');
      });
    }
  }

  // Add to history
  addToHistory(fileData, action) {
    const historyItem = {
      id: Date.now(),
      file: fileData.name,
      size: fileData.size,
      type: fileData.type,
      action: action,
      timestamp: new Date().toISOString()
    };
    
    this.downloadHistory.unshift(historyItem);
    
    // Keep only last 100 items
    if (this.downloadHistory.length > 100) {
      this.downloadHistory = this.downloadHistory.slice(0, 100);
    }
    
    // Update history panel if visible
    this.updateHistoryPanel();
  }

  // Update history panel
  updateHistoryPanel() {
    const historyList = document.getElementById('history-list');
    if (historyList) {
      historyList.innerHTML = this.downloadHistory.map(item => `
        <div class="guacamole-history-item">
          <div class="guacamole-history-file">${item.file}</div>
          <div class="guacamole-history-details">
            <span class="guacamole-history-action">${item.action}</span>
            <span class="guacamole-history-size">${this.formatFileSize(item.size)}</span>
            <span class="guacamole-history-time">${new Date(item.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>
      `).join('');
    }
  }

  // Show notification
  showNotification(title, message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `guacamole-notification guacamole-notification-${type}`;
    notification.innerHTML = `
      <div class="guacamole-notification-content">
        <div class="guacamole-notification-title">${title}</div>
        <div class="guacamole-notification-message">${message}</div>
      </div>
      <button class="guacamole-notification-close">&times;</button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
    
    // Close button
    notification.querySelector('.guacamole-notification-close').addEventListener('click', () => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    });
  }

  // Format file size
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Public API methods
  isReady() {
    return this.isInitialized && this.agentConnected;
  }

  getConnectionStatus() {
    return {
      initialized: this.isInitialized,
      agentConnected: this.agentConnected,
      processingFiles: this.processingFiles.size,
      historyCount: this.downloadHistory.length
    };
  }
}

// Initialize the client
window.guacamolePrintClient = new GuacamolePrintClient();

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GuacamolePrintClient;
}