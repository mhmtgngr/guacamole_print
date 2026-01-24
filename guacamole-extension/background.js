// ==================== BROWSER EXTENSION BACKGROUND SCRIPT ====================
// This is the main background script for the browser extension

class PrintAgentBackground {
  constructor() {
    this.websocket = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000;
    
    console.log('🚀 Guacamole Print Agent Background Script Starting...');
    
    this.initialize();
  }

  // Initialize the background script
  async initialize() {
    console.log('📡 Initializing background script...');
    
    // Setup WebSocket connection to local agent
    this.setupWebSocket();
    
    // Setup message listeners from content scripts
    this.setupMessageListeners();
    
    // Setup context menu for quick actions
    this.setupContextMenu();
    
    console.log('✅ Background script initialized');
  }

  // Setup WebSocket connection to local agent
  setupWebSocket() {
    try {
      const wsUrl = 'ws://localhost:8181';
      console.log(`🔌 Connecting to WebSocket server at ${wsUrl}`);
      
      this.websocket = new WebSocket(wsUrl);
      
      this.websocket.onopen = () => {
        console.log('✅ WebSocket connection established');
        this.connected = true;
        this.reconnectAttempts = 0;
        
        // Send initial connection message
        this.sendToAgent({
          type: 'extension_connection',
          data: {
            extensionId: chrome.runtime.id,
            timestamp: new Date().toISOString()
          }
        });
      };
      
      this.websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📨 Received message from agent:', message);
          this.handleAgentMessage(message);
        } catch (error) {
          console.error('❌ Failed to parse agent message:', error);
        }
      };
      
      this.websocket.onclose = () => {
        console.log('❌ WebSocket connection closed');
        this.connected = false;
        this.attemptReconnect();
      };
      
      this.websocket.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.connected = false;
      };
      
    } catch (error) {
      console.error('❌ Failed to setup WebSocket:', error);
      this.attemptReconnect();
    }
  }

  // Attempt to reconnect to WebSocket
  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.setupWebSocket();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('❌ Max reconnect attempts reached');
      this.showNotification('Local agent not found', 'Please ensure the local print agent is running', 'error');
    }
  }

  // Setup message listeners from content scripts
  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('📨 Received message from content script:', request);
      
      switch (request.action) {
        case 'printFile':
          this.handlePrintRequest(request.data, sender.tab);
          break;
        case 'saveFile':
          this.handleSaveRequest(request.data, sender.tab);
          break;
        case 'checkAgentStatus':
          sendResponse({ connected: this.connected });
          break;
        default:
          console.warn('⚠️ Unknown action:', request.action);
      }
    });
  }

  // Setup context menu
  setupContextMenu() {
    chrome.runtime.onInstalled.addListener(() => {
      chrome.contextMenus.create({
        id: 'printWithGuacamoleAgent',
        title: 'Print with Local Agent',
        contexts: ['link', 'document'],
        documentUrlPatterns: ['*://*.guacamole.apache.org/*', '*://*/guacamole/*']
      });
    });

    chrome.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId === 'printWithGuacamoleAgent') {
        this.handleContextMenuAction(info, tab);
      }
    });
  }

  // Handle print request from content script
  async handlePrintRequest(fileData, tab) {
    console.log('🖨️ Handling print request:', fileData);
    
    if (!this.connected) {
      this.showNotification('Local agent not connected', 'Please ensure the local print agent is running', 'error');
      return;
    }

    try {
      // Send print request to local agent
      const printJob = {
        type: 'print_job',
        data: {
          id: this.generateJobId(),
          file: fileData,
          options: {
            copies: 1,
            duplex: false,
            color: true
          },
          source: {
            tabId: tab?.id,
            url: tab?.url,
            timestamp: new Date().toISOString()
          }
        }
      };

      await this.sendToAgent(printJob);
      
      // Show success notification
      this.showNotification('Print job submitted', `File "${fileData.name}" sent to local printer`, 'success');
      
      // Store job in history
      this.storeJobInHistory(printJob.data);
      
    } catch (error) {
      console.error('❌ Failed to send print job:', error);
      this.showNotification('Print failed', error.message, 'error');
    }
  }

  // Handle save request from content script
  async handleSaveRequest(fileData, tab) {
    console.log('💾 Handling save request:', fileData);
    
    if (!this.connected) {
      this.showNotification('Local agent not connected', 'Please ensure the local print agent is running', 'error');
      return;
    }

    try {
      // Send save request to local agent
      const saveJob = {
        type: 'save_job',
        data: {
          id: this.generateJobId(),
          file: fileData,
          destination: 'default', // Could be configurable
          source: {
            tabId: tab?.id,
            url: tab?.url,
            timestamp: new Date().toISOString()
          }
        }
      };

      await this.sendToAgent(saveJob);
      
      // Show success notification
      this.showNotification('Save job submitted', `File "${fileData.name}" saved to local storage`, 'success');
      
      // Store job in history
      this.storeJobInHistory(saveJob.data);
      
    } catch (error) {
      console.error('❌ Failed to send save job:', error);
      this.showNotification('Save failed', error.message, 'error');
    }
  }

  // Handle messages from local agent
  handleAgentMessage(message) {
    switch (message.type) {
      case 'print_status':
        this.updateJobStatus(message.data);
        break;
      case 'save_status':
        this.updateJobStatus(message.data);
        break;
      case 'agent_status':
        console.log('📊 Agent status:', message.data);
        break;
      default:
        console.log('📨 Unknown message type:', message.type);
    }
  }

  // Send message to local agent
  async sendToAgent(message) {
    if (!this.connected || !this.websocket) {
      throw new Error('Not connected to local agent');
    }

    try {
      this.websocket.send(JSON.stringify(message));
      console.log('📤 Sent message to agent:', message.type);
    } catch (error) {
      console.error('❌ Failed to send message to agent:', error);
      throw error;
    }
  }

  // Handle context menu action
  async handleContextMenuAction(info, tab) {
    console.log('🖱️ Context menu action:', info);
    
    // Send message to content script to initiate file processing
    chrome.tabs.sendMessage(tab.id, {
      action: 'processFileForPrinting'
    });
  }

  // Show notification to user
  showNotification(title, message, type = 'info') {
    // For Chrome extension, we'll use badge and console
    const badgeText = type === 'error' ? '❌' : type === 'success' ? '✅' : '📋';
    
    chrome.action.setBadgeText({ text: badgeText });
    chrome.action.setBadgeBackgroundColor({ 
      color: type === 'error' ? '#FF0000' : type === 'success' ? '#00FF00' : '#0066CC' 
    });
    
    // Clear badge after 3 seconds
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 3000);
    
    console.log(`🔔 ${title}: ${message}`);
  }

  // Store job in local storage
  async storeJobInHistory(jobData) {
    try {
      const result = await chrome.storage.local.get(['printHistory']);
      const history = result.printHistory || [];
      
      // Add new job to beginning of history
      history.unshift({
        ...jobData,
        timestamp: new Date().toISOString()
      });
      
      // Keep only last 7 days (168 hours)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const filteredHistory = history.filter(job => 
        new Date(job.timestamp) > sevenDaysAgo
      );
      
      // Store updated history (limit to 1000 entries)
      await chrome.storage.local.set({
        printHistory: filteredHistory.slice(0, 1000)
      });
      
    } catch (error) {
      console.error('❌ Failed to store job in history:', error);
    }
  }

  // Update job status in storage
  async updateJobStatus(statusData) {
    try {
      const result = await chrome.storage.local.get(['printHistory']);
      const history = result.printHistory || [];
      
      // Find and update the job
      const jobIndex = history.findIndex(job => job.id === statusData.jobId);
      if (jobIndex !== -1) {
        history[jobIndex].status = statusData.status;
        history[jobIndex].updatedAt = new Date().toISOString();
        
        // Update storage
        await chrome.storage.local.set({ printHistory: history });
        
        // Show notification for completed jobs
        if (statusData.status === 'completed') {
          this.showNotification('Print job completed', statusData.message || 'Successfully printed', 'success');
        } else if (statusData.status === 'failed') {
          this.showNotification('Print job failed', statusData.message || 'Print failed', 'error');
        }
      }
    } catch (error) {
      console.error('❌ Failed to update job status:', error);
    }
  }

  // Generate unique job ID
  generateJobId() {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Check if connected to local agent
  isConnected() {
    return this.connected && this.websocket && this.websocket.readyState === WebSocket.OPEN;
  }

  // Get print history
  async getPrintHistory() {
    try {
      const result = await chrome.storage.local.get(['printHistory']);
      return result.printHistory || [];
    } catch (error) {
      console.error('❌ Failed to get print history:', error);
      return [];
    }
  }

  // Clear print history
  async clearPrintHistory() {
    try {
      await chrome.storage.local.remove(['printHistory']);
      this.showNotification('History cleared', 'Print history has been cleared', 'success');
    } catch (error) {
      console.error('❌ Failed to clear print history:', error);
      this.showNotification('Failed to clear history', error.message, 'error');
    }
  }

  // Get local agent status
  getAgentStatus() {
    return {
      connected: this.isConnected(),
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts
    };
  }
}

// Initialize the background script
const printAgent = new PrintAgentBackground();

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PrintAgentBackground;
}