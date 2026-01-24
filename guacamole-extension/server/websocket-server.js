// ==================== GUACAMOLE PRINT AGENT WEBSOCKET SERVER ====================
// Local WebSocket server that bridges browser extension with system resources

const WebSocket = require('ws');
const fs = require('fs').promises;
const path = require('path');
const { spawn, exec } = require('child_process');
const os = require('os');
const crypto = require('crypto');

class PrintAgentWebSocketServer {
  constructor(options = {}) {
    this.port = options.port || 8181;
    this.host = options.host || 'localhost';
    this.wss = null;
    this.clients = new Map();
    this.printJobs = new Map();
    this.printers = [];
    this.defaultSavePath = path.join(os.homedir(), 'Downloads', 'PrintJobs');
    
    console.log('🚀 Initializing Guacamole Print Agent WebSocket Server...');
    
    this.initialize();
  }

  async initialize() {
    try {
      console.log('📡 Setting up WebSocket server...');
      
      // Create default save directory
      await this.ensureSaveDirectory();
      
      // Detect available printers
      await this.detectPrinters();
      
      // Setup WebSocket server
      this.setupWebSocketServer();
      
      console.log('✅ Print Agent Server initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize Print Agent Server:', error);
      throw error;
    }
  }

  // Ensure save directory exists
  async ensureSaveDirectory() {
    try {
      await fs.mkdir(this.defaultSavePath, { recursive: true });
      console.log(`📁 Save directory ready: ${this.defaultSavePath}`);
    } catch (error) {
      console.warn('⚠️ Failed to create save directory:', error.message);
    }
  }

  // Detect available printers based on OS
  async detectPrinters() {
    return new Promise((resolve) => {
      const platform = os.platform();
      let command;
      
      switch (platform) {
        case 'win32':
          command = 'wmic printer get name';
          break;
        case 'darwin':
          command = 'lpstat -p';
          break;
        case 'linux':
          command = 'lpstat -p';
          break;
        default:
          command = 'lpstat -p';
      }
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.warn('⚠️ Could not detect printers:', error.message);
          this.printers = ['Default Printer']; // Fallback
          resolve(this.printers);
          return;
        }
        
        try {
          const lines = stdout.split('\n');
          const printers = [];
          
          lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.toLowerCase().includes('name') && !trimmed.toLowerCase().includes('printer')) {
              // Extract printer name
              const parts = trimmed.split(/\s+/);
              const name = parts[parts.length - 1];
              if (name && !printers.includes(name)) {
                printers.push(name);
              }
            }
          });
          
          this.printers = printers.length > 0 ? printers : ['Default Printer'];
          console.log(`🖨️ Detected printers: ${this.printers.join(', ')}`);
          
        } catch (parseError) {
          console.warn('⚠️ Failed to parse printer list:', parseError.message);
          this.printers = ['Default Printer'];
        }
        
        resolve(this.printers);
      });
    });
  }

  // Setup WebSocket server
  setupWebSocketServer() {
    this.wss = new WebSocket.Server({ 
      host: this.host,
      port: this.port 
    });
    
    this.wss.on('connection', (ws, request) => {
      this.handleClientConnection(ws, request);
    });
    
    this.wss.on('error', (error) => {
      console.error('❌ WebSocket server error:', error);
    });
    
    console.log(`🔌 WebSocket server listening on ${this.host}:${this.port}`);
  }

  // Handle new client connection
  handleClientConnection(ws, request) {
    const clientId = this.generateClientId();
    const clientInfo = {
      id: clientId,
      socket: ws,
      connected: true,
      lastActivity: new Date(),
      userAgent: request.headers['user-agent'],
      extensionId: null
    };
    
    this.clients.set(clientId, clientInfo);
    console.log(`🔗 Client connected: ${clientId}`);
    
    // Setup message handlers
    ws.on('message', (message) => {
      this.handleClientMessage(clientId, message);
    });
    
    ws.on('close', () => {
      this.handleClientDisconnection(clientId);
    });
    
    ws.on('error', (error) => {
      console.error(`❌ Client error (${clientId}):`, error);
      this.handleClientDisconnection(clientId);
    });
    
    // Send welcome message
    this.sendToClient(clientId, {
      type: 'server_info',
      data: {
        version: '1.0.0',
        clientId: clientId,
        printers: this.printers,
        os: os.platform(),
        savePath: this.defaultSavePath
      }
    });
  }

  // Handle client disconnection
  handleClientDisconnection(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.connected = false;
      console.log(`❌ Client disconnected: ${clientId}`);
      this.clients.delete(clientId);
    }
  }

  // Handle client message
  async handleClientMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    client.lastActivity = new Date();
    
    try {
      const data = JSON.parse(message);
      console.log(`📨 Message from client (${clientId}):`, data.type);
      
      switch (data.type) {
        case 'extension_connection':
          await this.handleExtensionConnection(clientId, data.data);
          break;
        case 'print_job':
          await this.handlePrintJob(clientId, data.data);
          break;
        case 'save_job':
          await this.handleSaveJob(clientId, data.data);
          break;
        case 'get_printers':
          await this.sendPrintersList(clientId);
          break;
        case 'get_history':
          await this.sendHistory(clientId);
          break;
        case 'ping':
          this.sendToClient(clientId, { type: 'pong' });
          break;
        default:
          console.warn(`⚠️ Unknown message type: ${data.type}`);
      }
      
    } catch (error) {
      console.error(`❌ Failed to handle client message (${clientId}):`, error);
      this.sendToClient(clientId, {
        type: 'error',
        data: { message: 'Failed to process message', details: error.message }
      });
    }
  }

  // Handle extension connection
  async handleExtensionConnection(clientId, data) {
    const client = this.clients.get(clientId);
    if (client && data.extensionId) {
      client.extensionId = data.extensionId;
      console.log(`🔗 Extension connected: ${data.extensionId}`);
      
      this.sendToClient(clientId, {
        type: 'connection_accepted',
        data: { 
          clientId: clientId,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  // Handle print job
  async handlePrintJob(clientId, jobData) {
    console.log(`🖨️ Processing print job: ${jobData.id}`);
    
    try {
      // Update job status
      this.updatePrintJobStatus(jobData.id, 'processing', 'Processing print job...');
      
      // Save file to temporary location
      const tempFilePath = await this.saveFileTemporarily(jobData.file);
      
      // Print the file
      await this.printFile(tempFilePath, jobData.options);
      
      // Clean up temp file
      await fs.unlink(tempFilePath).catch(() => {}); // Ignore cleanup errors
      
      // Update job status
      this.updatePrintJobStatus(jobData.id, 'completed', 'Print job completed successfully');
      
      // Notify client
      this.sendToClient(clientId, {
        type: 'print_status',
        data: {
          jobId: jobData.id,
          status: 'completed',
          message: 'Printed successfully',
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      console.error(`❌ Print job failed (${jobData.id}):`, error);
      
      // Update job status
      this.updatePrintJobStatus(jobData.id, 'failed', error.message);
      
      // Notify client
      this.sendToClient(clientId, {
        type: 'print_status',
        data: {
          jobId: jobData.id,
          status: 'failed',
          message: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  // Handle save job
  async handleSaveJob(clientId, jobData) {
    console.log(`💾 Processing save job: ${jobData.id}`);
    
    try {
      // Update job status
      this.updatePrintJobStatus(jobData.id, 'processing', 'Processing save job...');
      
      // Save file to target location
      const savedFilePath = await this.saveFile(jobData.file, jobData.destination);
      
      // Update job status
      this.updatePrintJobStatus(jobData.id, 'completed', `File saved to ${savedFilePath}`);
      
      // Notify client
      this.sendToClient(clientId, {
        type: 'save_status',
        data: {
          jobId: jobData.id,
          status: 'completed',
          message: `Saved to ${savedFilePath}`,
          filePath: savedFilePath,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      console.error(`❌ Save job failed (${jobData.id}):`, error);
      
      // Update job status
      this.updatePrintJobStatus(jobData.id, 'failed', error.message);
      
      // Notify client
      this.sendToClient(clientId, {
        type: 'save_status',
        data: {
          jobId: jobData.id,
          status: 'failed',
          message: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  // Save file temporarily
  async saveFileTemporarily(fileData) {
    const tempDir = path.join(os.tmpdir(), 'guacamole-print-jobs');
    await fs.mkdir(tempDir, { recursive: true });
    
    const fileName = `temp_${Date.now()}_${this.sanitizeFileName(fileData.name)}`;
    const tempFilePath = path.join(tempDir, fileName);
    
    // Handle different data types
    if (typeof fileData.data === 'string') {
      await fs.writeFile(tempFilePath, fileData.data, 'base64');
    } else if (fileData.data instanceof Buffer) {
      await fs.writeFile(tempFilePath, fileData.data);
    } else {
      // Assume it's a blob-like object
      await fs.writeFile(tempFilePath, Buffer.from(fileData.data));
    }
    
    return tempFilePath;
  }

  // Save file to target location
  async saveFile(fileData, destination) {
    const saveDir = destination ? 
      path.resolve(destination) : 
      this.defaultSavePath;
    
    await fs.mkdir(saveDir, { recursive: true });
    
    const fileName = this.sanitizeFileName(fileData.name);
    const filePath = path.join(saveDir, fileName);
    
    // Handle different data types
    if (typeof fileData.data === 'string') {
      await fs.writeFile(filePath, fileData.data, 'base64');
    } else if (fileData.data instanceof Buffer) {
      await fs.writeFile(filePath, fileData.data);
    } else {
      // Assume it's a blob-like object
      await fs.writeFile(filePath, Buffer.from(fileData.data));
    }
    
    return filePath;
  }

  // Print file using OS-specific commands
  async printFile(filePath, options = {}) {
    return new Promise((resolve, reject) => {
      const platform = os.platform();
      let command;
      let args = [];
      
      const printerName = options.printer || this.printers[0] || 'Default Printer';
      
      switch (platform) {
        case 'win32':
          command = 'rundll32';
          args = ['msprint32.dll,PrintDlgEx', filePath];
          break;
          
        case 'darwin':
          command = 'lpr';
          args = ['-P', printerName, filePath];
          if (options.copies) args.push('-#', options.copies.toString());
          if (!options.color) args.push('-o', 'Color=False');
          if (options.duplex) args.push('-o', 'Duplex=DuplexNoTumble');
          break;
          
        case 'linux':
          command = 'lp';
          args = ['-d', printerName, filePath];
          if (options.copies) args.push('-n', options.copies.toString());
          if (!options.color) args.push('-o', 'Color=False');
          if (options.duplex) args.push('-o', 'sides=two-sided-long-edge');
          break;
          
        default:
          // Fallback: try to open file with default application
          command = 'xdg-open';
          args = [filePath];
          break;
      }
      
      const process = spawn(command, args);
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Print command failed with exit code ${code}`));
        }
      });
      
      process.on('error', (error) => {
        reject(new Error(`Failed to execute print command: ${error.message}`));
      });
    });
  }

  // Send printers list to client
  async sendPrintersList(clientId) {
    // Refresh printers list
    await this.detectPrinters();
    
    this.sendToClient(clientId, {
      type: 'printers_list',
      data: {
        printers: this.printers,
        default: this.printers[0] || null
      }
    });
  }

  // Send history to client
  async sendHistory(clientId) {
    // This could load from a persistent store
    const history = Array.from(this.printJobs.values()).map(job => ({
      id: job.id,
      type: job.type,
      fileName: job.fileName,
      status: job.status,
      timestamp: job.timestamp,
      message: job.message
    }));
    
    this.sendToClient(clientId, {
      type: 'history',
      data: { history: history }
    });
  }

  // Update print job status
  updatePrintJobStatus(jobId, status, message) {
    this.printJobs.set(jobId, {
      id: jobId,
      status: status,
      message: message,
      timestamp: new Date().toISOString()
    });
  }

  // Send message to specific client
  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (client && client.socket.readyState === WebSocket.OPEN) {
      try {
        client.socket.send(JSON.stringify(message));
        console.log(`📤 Sent message to client (${clientId}): ${message.type}`);
      } catch (error) {
        console.error(`❌ Failed to send message to client (${clientId}):`, error);
      }
    }
  }

  // Generate unique client ID
  generateClientId() {
    return crypto.randomBytes(16).toString('hex');
  }

  // Sanitize file name for safe storage
  sanitizeFileName(fileName) {
    return fileName
      .replace(/[^a-zA-Z0-9\-_.]/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 100); // Limit length
  }

  // Broadcast message to all connected clients
  broadcast(message) {
    for (const [clientId, client] of this.clients) {
      if (client.socket.readyState === WebSocket.OPEN) {
        this.sendToClient(clientId, message);
      }
    }
  }

  // Get server status
  getStatus() {
    return {
      port: this.port,
      host: this.host,
      connectedClients: this.clients.size,
      printers: this.printers.length,
      activeJobs: this.printJobs.size,
      uptime: process.uptime()
    };
  }

  // Graceful shutdown
  async shutdown() {
    console.log('🔄 Shutting down Print Agent Server...');
    
    // Close all client connections
    for (const [clientId, client] of this.clients) {
      try {
        client.socket.close();
      } catch (error) {
        // Ignore close errors
      }
    }
    
    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
    }
    
    console.log('✅ Print Agent Server shutdown complete');
  }
}

// Export for use as module
module.exports = PrintAgentWebSocketServer;

// Start server if run directly
if (require.main === module) {
  const server = new PrintAgentWebSocketServer();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🔄 Received SIGINT, shutting down gracefully...');
    await server.shutdown();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n🔄 Received SIGTERM, shutting down gracefully...');
    await server.shutdown();
    process.exit(0);
  });
  
  console.log('🖨️ Guacamole Print Agent WebSocket Server is running...');
  console.log(`🔌 Server listening on ws://localhost:${server.port}`);
}