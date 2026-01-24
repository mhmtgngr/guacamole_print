// ==================== GUACAMOLE PRINT AGENT WEBSOCKET SERVER ====================
// Simple WebSocket server for Guacamole print agent connections

const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');

class PrintAgentServer {
  constructor(options = {}) {
    this.port = options.port || 8182;
    this.host = options.host || '0.0.0.0';
    this.clients = new Set();
    this.server = null;
    this.wss = null;
    
    console.log('🚀 Initializing Guacamole Print Agent Server...');
    
    this.createServer();
  }

  // Create HTTP and WebSocket server
  createServer() {
    // Create HTTP server
    this.server = http.createServer((req, res) => {
      if (req.url === '/' || req.url === '/health') {
        this.handleHealthCheck(req, res);
      } else if (req.url === '/ws') {
        // WebSocket upgrade handled by WebSocket server
        res.writeHead(404);
        res.end('Not Found');
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    // Create WebSocket server
    this.wss = new WebSocket.Server({ 
      server: this.server,
      path: '/ws'
    });

    // Setup WebSocket handlers
    this.setupWebSocketHandlers();

    // Start server
    this.start();
  }

  // Setup WebSocket event handlers
  setupWebSocketHandlers() {
    this.wss.on('connection', (ws, req) => {
      console.log('🔗 New WebSocket connection from:', req.socket.remoteAddress);
      
      // Add client to set
      this.clients.add(ws);
      
      // Send connection acknowledgment
      this.sendToClient(ws, {
        type: 'connection_ack',
        status: 'connected',
        message: 'Successfully connected to Guacamole Print Agent',
        timestamp: Date.now()
      });
      
      // Setup client message handlers
      this.setupClientHandlers(ws);
      
      // Log total connections
      console.log(`📊 Total connected clients: ${this.clients.size}`);
    });

    this.wss.on('error', (error) => {
      console.error('❌ WebSocket server error:', error);
    });

    this.server.on('error', (error) => {
      console.error('❌ HTTP server error:', error);
    });
  }

  // Setup individual client handlers
  setupClientHandlers(ws) {
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleClientMessage(ws, message);
      } catch (error) {
        console.error('❌ Error parsing client message:', error);
        this.sendToClient(ws, {
          type: 'error',
          error: 'Invalid message format',
          details: error.message
        });
      }
    });

    ws.on('close', () => {
      console.log('🔌 Client disconnected');
      this.clients.delete(ws);
      console.log(`📊 Total connected clients: ${this.clients.size}`);
    });

    ws.on('error', (error) => {
      console.error('❌ Client WebSocket error:', error);
      this.clients.delete(ws);
    });

    // Send initial status
    this.sendStatus(ws);
  }

  // Handle client messages
  async handleClientMessage(ws, message) {
    console.log('📨 Received message:', message.type);
    
    switch (message.type) {
      case 'ping':
        this.handlePing(ws, message);
        break;
      
      case 'print':
        await this.handlePrintRequest(ws, message);
        break;
      
      case 'status':
        this.sendStatus(ws);
        break;
      
      case 'info':
        this.handleInfoRequest(ws);
        break;
      
      default:
        console.log('📨 Unknown message type:', message.type);
        this.sendToClient(ws, {
          type: 'error',
          error: 'Unknown message type',
          received: message.type
        });
    }
  }

  // Handle ping requests
  handlePing(ws, message) {
    this.sendToClient(ws, {
      type: 'pong',
      timestamp: Date.now(),
      pingData: message.data || null
    });
  }

  // Handle print requests
  async handlePrintRequest(ws, message) {
    try {
      console.log('🖨️ Print request received:', message.data?.name);
      
      // Simulate print processing
      this.sendToClient(ws, {
        type: 'print_response',
        status: 'processing',
        file: message.data?.name,
        timestamp: Date.now()
      });

      // Simulate print job
      setTimeout(() => {
        this.sendToClient(ws, {
          type: 'print_response',
          status: 'completed',
          file: message.data?.name,
          message: 'Print job completed successfully',
          timestamp: Date.now()
        });
      }, 1000);

    } catch (error) {
      console.error('❌ Print request error:', error);
      this.sendToClient(ws, {
        type: 'error',
        error: 'Print request failed',
        details: error.message
      });
    }
  }

  // Handle info requests
  handleInfoRequest(ws) {
    const info = {
      type: 'info_response',
      server: {
        name: 'Guacamole Print Agent',
        version: '1.0.0',
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version
      },
      status: {
        connected: true,
        clients: this.clients.size,
        uptime: process.uptime()
      },
      timestamp: Date.now()
    };

    this.sendToClient(ws, info);
  }

  // Send status to client
  sendStatus(ws) {
    this.sendToClient(ws, {
      type: 'status',
      connected: true,
      clients: this.clients.size,
      uptime: process.uptime(),
      timestamp: Date.now()
    });
  }

  // Send message to specific client
  sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('❌ Error sending message to client:', error);
      }
    }
  }

  // Broadcast message to all clients
  broadcast(message) {
    const messageStr = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageStr);
        } catch (error) {
          console.error('❌ Error broadcasting to client:', error);
        }
      }
    });
  }

  // Handle health check requests
  handleHealthCheck(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      server: 'Guacamole Print Agent',
      version: '1.0.0',
      connected_clients: this.clients.size,
      uptime: process.uptime(),
      timestamp: Date.now()
    }));
  }

  // Start the server
  start() {
    this.server.listen(this.port, this.host, () => {
      console.log(`✅ Guacamole Print Agent Server started:`);
      console.log(`   📍 Host: ${this.host}`);
      console.log(`   🔌 Port: ${this.port}`);
      console.log(`   🔗 WebSocket: ws://${this.host}:${this.port}/ws`);
      console.log(`   🏥 Health: http://${this.host}:${this.port}/health`);
    });
  }

  // Stop the server
  stop() {
    console.log('🛑 Stopping Guacamole Print Agent Server...');
    
    // Close all client connections
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });
    
    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
    }
    
    // Close HTTP server
    if (this.server) {
      this.server.close(() => {
        console.log('✅ Guacamole Print Agent Server stopped');
      });
    }
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new PrintAgentServer();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n📛 Received SIGINT, shutting down gracefully...');
    server.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n📛 Received SIGTERM, shutting down gracefully...');
    server.stop();
    process.exit(0);
  });
}

// Export for testing or use as module
module.exports = PrintAgentServer;