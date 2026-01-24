# Build and Deployment Guide for Guacamole Print Agent Extension

## 🏗️ Architecture Overview

This module embeds the file transfer and print capabilities directly into Guacamole's web interface using Guacamole's extension system, eliminating the need for separate browser extensions.

## 📋 What's Included

### ✅ **Java Extension Module**
- **PrintAgentExtension.java**: Core extension logic
- **WebSocket Communication**: Direct connection to local print agents
- **File Transfer Logic**: PDF, Excel, Word, Images, Archives
- **User Interface**: Modal dialogs and progress indicators

### ✅ **Client-Side JavaScript**
- **print-agent-client.js**: Main JavaScript file
- **print-agent.css**: Complete UI styling
- **index.html**: Integrated HTML page with extension

### ✅ **Server Integration**
- **WebSocket Handler**: Communicates with local print agents
- **File Processing**: Base64 encoding/decoding
- **Progress Tracking**: Real-time progress updates

## 🔧 Features

### File Transfer Capabilities
- **Supported Types**: PDF, Excel, Word, Images, Text, Archives
- **Actions**: Print, Download, Open with default application
- **File Size Limit**: 50MB (configurable)
- **Preview Support**: Images and PDFs
- **Progress Tracking**: Real-time percentage completion

### User Experience
- **Modal Dialogs**: Action selection with file preview
- **Progress Indicators**: Visual feedback during transfers
- **Status Notifications**: Success/error/status messages
- **Connection Status**: Shows local agent connectivity

### Security Features
- **Server-Side Validation**: File type and size checks
- **Localhost Only**: Connects only to local agents
- **Content Validation**: Base64 validation and sanitization
- **Session Isolation**: Per-user transfer tracking

## 📦 Build Instructions

### Prerequisites
- **Java 8+** (required for Guacamole 1.5.4+)
- **Maven 3.6+** (for building)
- **Guacamole 1.5.4+** (core dependency)

### Building the Extension

1. **Clone Guacamole Source** (if not already downloaded)
   ```bash
   git clone https://github.com/apache/guacamole-client.git
   cd guacamole-client
   git checkout tags/1.5.4
   ```

2. **Copy Extension Files**
   ```bash
   # Create directory
   mkdir -p guacamole-print-extension
   cd guacamole-client/extensions/guacamole-print-agent
   cp -r * C:\guacamole-print-solution\guacamole-extension-module\src\main\*
   ```

3. **Build the Extension**
   ```bash
   cd guacamole-print-extension
   mvn ../pom.xml .
   mvn ../src .
   mvn ../target/guacamole-print-agent-1.0.0.jar .
   ```

4. **Deploy to Guacamole**
   ```bash
   # Copy extension JAR to Guacamole extensions directory
   sudo cp guacamole-print-agent-1.0.0.jar /var/lib/guacamole/
   
   # Set permissions
   sudo chown guacamole:guacamole /var/lib/guacamole/
   sudo chmod 644 /var/lib/guacamole/guacamole-print-agent-1.0.0.jar
   ```

5. **Configure Guacamole**
   Edit `guacamole.properties` to enable the extension:
   ```
   # Basic authentication
   # Optional: SSO integration
   # Extension loading
   ```

## 🔧 Configuration Options

### Extension Configuration
The extension can be configured through Guacamole properties:

```properties
# Enable the print agent extension
guacamole.extensions: guacamole-print-agent

# WebSocket configuration (optional - will use hardcoded value if not specified)
guacamole.print-agent.websocket.url: wss://localhost:8181/ws

# File transfer limits
guacamole.print-agent.max-file-size: 52428800
guacamole.print-agent.allowed-types: pdf,docx,xlsx,jpg,png,txt
guacamole.print-agent.default-action: prompt
```

### Browser-Side URL Structure
Once deployed, the extension will be available at:
- `https://your-guacamole-server/guacamole/` + connection ID + `/print-agent/`

## 🔍 Usage Workflow

1. **Access Guacamole** via browser
2. **PrintAgent Extension** is automatically loaded
3. **File transfers are intercepted automatically**
4. **User selects action** (Print/Download/Open)
5. **Files sent to local agent** via WebSocket
6. **Local agent processes files** accordingly

## 📋 Integration with Local Print Agent

The extension communicates with the local print agent through WebSocket at `wss://localhost:8181/ws`. The complete workflow:

```
Remote RDP → File Generation → Guacamole Server → Embedded Extension → 
User Action Selection → WebSocket → Local Agent → Local Printer/Storage
```

## 🔧 Benefits

✅ **Zero Client Management**: No extension installation required
✅ **Centralized Control**: Server-side configuration
✅ **Enhanced Security**: Server-validated file transfers
✅ **Easier Maintenance**: Single deployment point
✅ **Better Performance**: Direct server-to-agent communication

## 🚀 Next Steps

1. **Build the Extension Module**
2. **Deploy to Your Guacamole Server**
3. **Test File Transfer Workflow**
4. **Deploy Local Print Agent to Client Machines**
5. **Scale for 50-60 Users**

This approach completely eliminates browser extension complexity while providing all the file transfer and printing capabilities you need!