// Guacamole Print Agent - Popup Script
// Manages the extension popup interface

class GuacamolePopup {
    constructor() {
        this.config = {};
        this.stats = {};
        
        this.init();
    }

    async init() {
        console.log('Guacamole Print Agent: Popup initializing...');
        
        // Load configuration and stats
        await this.loadConfig();
        await this.loadStats();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Update UI
        this.updateUI();
        
        // Test connection
        await this.testConnection();
        
        console.log('Guacamole Print Agent: Popup ready');
    }

    async loadConfig() {
        try {
            const stored = await chrome.storage.sync.get('guacamolePrintConfig');
            this.config = stored.guacamolePrintConfig || {};
        } catch (error) {
            console.warn('Failed to load config:', error);
            this.config = {};
        }
    }

    async loadStats() {
        try {
            const stored = await chrome.storage.local.get('guacamolePrintStats');
            this.stats = stored.guacamolePrintStats || this.getDefaultStats();
        } catch (error) {
            console.warn('Failed to load stats:', error);
            this.stats = this.getDefaultStats();
        }
    }

    async saveStats() {
        try {
            await chrome.storage.local.set({ guacamolePrintStats: this.stats });
        } catch (error) {
            console.warn('Failed to save stats:', error);
        }
    }

    getDefaultStats() {
        return {
            today: 0,
            week: 0,
            total: 0,
            lastReset: new Date().toDateString()
        };
    }

    setupEventListeners() {
        // Test connection button
        document.getElementById('testConnection').addEventListener('click', () => {
            this.testConnection();
        });
        
        // View history button
        document.getElementById('viewHistory').addEventListener('click', () => {
            this.openHistory();
        });
        
        // Settings button
        document.getElementById('openSettings').addEventListener('click', () => {
            this.openSettings();
        });
    }

    updateUI() {
        // Update connection status
        this.updateConnectionStatus();
        
        // Update stats
        this.updateStats();
        
        // Update version
        document.getElementById('agentVersion').textContent = '1.0.0';
    }

    updateConnectionStatus() {
        const statusDot = document.getElementById('connectionStatus');
        const statusText = document.getElementById('connectionText');
        
        // Check if connected (simplified - should query background script)
        chrome.runtime.sendMessage({ type: 'get_status' }, (response) => {
            if (response && response.connected) {
                statusDot.className = 'status-dot status-connected';
                statusText.textContent = 'Connected';
            } else {
                statusDot.className = 'status-dot status-disconnected';
                statusText.textContent = 'Disconnected';
            }
        });
    }

    updateStats() {
        // Reset stats if it's a new day
        const today = new Date().toDateString();
        if (this.stats.lastReset !== today) {
            this.stats.today = 0;
            this.stats.lastReset = today;
            this.saveStats();
        }
        
        // Update UI
        document.getElementById('todayCount').textContent = this.stats.today;
        document.getElementById('weekCount').textContent = this.stats.week;
    }

    async testConnection() {
        const testBtn = document.getElementById('testConnection');
        const originalText = testBtn.textContent;
        
        try {
            testBtn.textContent = 'Testing...';
            testBtn.disabled = true;
            
            // Send test message to background
            const response = await chrome.runtime.sendMessage({ 
                type: 'test_connection' 
            });
            
            if (response && response.success) {
                testBtn.textContent = '✓ Connected';
                testBtn.style.backgroundColor = '#28a745';
                this.showNotification('Connection successful', 'Local print agent is responding');
            } else {
                throw new Error(response?.error || 'Connection failed');
            }
        } catch (error) {
            testBtn.textContent = '✗ Failed';
            testBtn.style.backgroundColor = '#dc3545';
            this.showNotification('Connection failed', 'Unable to connect to local print agent', 'error');
        } finally {
            // Reset button after delay
            setTimeout(() => {
                testBtn.textContent = originalText;
                testBtn.style.backgroundColor = '';
                testBtn.disabled = false;
            }, 2000);
        }
    }

    openHistory() {
        chrome.tabs.create({
            url: chrome.runtime.getURL('history.html')
        });
    }

    openSettings() {
        chrome.tabs.create({
            url: chrome.runtime.getURL('options.html')
        });
    }

    incrementStat(statName) {
        this.stats[statName]++;
        this.stats.total++;
        this.saveStats();
        this.updateStats();
    }

    showNotification(title, message, type = 'info') {
        // Show a simple notification in the popup
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            left: 10px;
            background: ${type === 'error' ? '#dc3545' : '#28a745'};
            color: white;
            padding: 10px;
            border-radius: 6px;
            z-index: 10000;
            font-size: 14px;
            animation: slideIn 0.3s ease-out;
        `;
        notification.textContent = `${title}: ${message}`;
        
        document.body.appendChild(notification);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateY(-20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateY(0); opacity: 1; }
        to { transform: translateY(-20px); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.guacamolePopup = new GuacamolePopup();
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'stats_updated') {
        // Refresh stats when updated from background
        window.guacamolePopup?.loadStats();
        window.guacamolePopup?.updateStats();
    }
});