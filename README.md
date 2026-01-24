# Guacamole Print Solution

A comprehensive "Click-to-Print" and file transfer solution for Apache Guacamole that enables seamless printing from browser-based RDP sessions to local printers and storage.

## 🎯 Solution Overview

This system provides enterprise-grade file transfer capabilities for Guacamole RDP sessions, supporting 50-60 concurrent users with intelligent file routing, secure communication, and comprehensive management features.

### Architecture Flow

```
Remote Windows RDP → File Generation → Browser Extension Detection → User Action Choice → 
├── Print → WSS (localhost:8181) → Windows Service → Local Printer
├── Download → WSS → Windows Service → System Downloads Folder  
└── Open → WSS → Windows Service → Default Application
```

## 🏗️ System Components

### 1. Docker Guacamole Setup
**Location**: `docker-guacamole/`

**Features**:
- ✅ Multi-user support with isolated file paths per user
- ✅ Enhanced file transfer configuration
- ✅ SSL/TLS support with automated certificate management
- ✅ Load balancing with Nginx reverse proxy
- ✅ Performance tuning for 50-60 concurrent users
- ✅ User quota management and cleanup

**Key Configuration**:
- Per-user directories: `/guacamole/downloads/${GUACAMOLE_USERNAME}/`
- File size limits: 50MB per file, 500MB per user
- Session quotas: 100 files per session
- Automatic cleanup: 7-day retention

### 2. Remote PowerShell Monitor
**Location**: `remote-printer/`

**Features**:
- ✅ Real-time file system monitoring with FileSystemWatcher
- ✅ Multi-user session detection and tracking
- ✅ File type classification and validation
- ✅ Preview generation for images and PDFs
- ✅ Automatic retry with configurable attempts
- ✅ Windows Service installation support

**Supported File Types**:
- PDF: Prompt → Print/Download/Open
- Excel/Word: Download → Download/Open/Print
- Images: Prompt → Print/Download/Open
- Archives: Download only
- Text files: Download → Download/Open

### 3. Local Print Agent (C# .NET 8)
**Location**: `local-print-agent/`

**Features**:
- ✅ Windows Service with automatic startup
- ✅ Secure WebSocket Server (WSS) on localhost:8181
- ✅ Automated SSL certificate generation and trust installation
- ✅ Multi-action file processing (Print/Download/Open)
- ✅ 7-day transfer history with SQLite database
- ✅ Intelligent file routing based on type and user preferences
- ✅ Background cleanup and maintenance
- ✅ User interface with action selection and file preview

**Architecture**:
- **WebSocket Server**: Handles encrypted client communications
- **Certificate Manager**: Automated SSL/TLS certificate lifecycle
- **File Processor**: Multi-format printing and file operations
- **History Manager**: SQLite database for audit and retry
- **UI Manager**: User interaction and preference management

### 4. Browser Extension
**Location**: `guacamole-extension/`

**Features**:
- ✅ Custom Chrome/Edge extension (manifest v3)
- ✅ Real-time file download interception
- ✅ Network request monitoring for file transfers
- ✅ DOM element scanning for Guacamole interfaces
- ✅ User action selection interface with file preview
- ✅ Secure WebSocket communication to local agent
- ✅ Context menu integration for manual actions
- ✅ User preference storage and memory

**Interception Methods**:
- DOM monitoring for download links and elements
- Network request monitoring for file URLs
- Downloads API interception
- Context menu actions for manual intervention

## 🚀 Quick Start

### Prerequisites
- Windows client machines (for local agent)
- Docker and Docker Compose (for Guacamole)
- PowerShell 5.1+ (for remote monitor)
- Chrome/Edge browser (for extension)
- Administrative privileges (for service installation)

### 1. Deploy Guacamole Server

```bash
cd guacamole-print-solution/docker-guacamole
chmod +x ../deployment/docker-setup.sh
./docker-setup.sh
```

**Expected Output**:
- HTTPS Guacamole: `https://localhost/guacamole`
- Admin interface: `http://localhost:8080/guacamole`
- Multi-user directories created
- SSL certificates generated and installed

### 2. Install Local Print Agent

```powershell
# On Windows client machine
cd local-print-agent/Scripts
.\install-service.ps1 -Force
```

**Expected Output**:
- Windows service "GuacamolePrintAgent" installed
- SSL certificate generated and trusted
- WebSocket server running on localhost:8181
- Desktop shortcuts created
- Firewall rules configured

### 3. Install Browser Extension

1. Open Chrome/Edge
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select `guacamole-extension` folder

### 4. Deploy Remote Monitor

```powershell
# On Guacamole RDP servers
cd remote-printer
.\installer.ps1 -MonitoredUsers "user1,user2,user3"
```

## 📊 Multi-User Configuration

### User Directory Structure
```
guacamole-print-solution/
├── user-downloads/
│   ├── user1/
│   │   ├── print/           # Print jobs
│   │   ├── temp/            # Temporary files
│   │   └── config.json      # User config
│   ├── user2/
│   └── ...
├── user-recordings/
│   ├── user1/
│   └── ...
└── config/
    ├── users.txt           # User list
    └── monitoring.json     # Monitoring settings
```

### Docker Configuration for 50-60 Users
```yaml
# Key performance settings in docker-compose.yml
services:
  guacamole-client:
    environment:
      # Performance tuning
      MAX_CONNECTIONS: 100
      MAX_MEMORY: 2G
      # User isolation
      ENABLE_USER_ISOLATION: true
      USER_QUOTA_SIZE: 524288000
      # File transfer
      MAX_FILE_SIZE: 52428800
      RETENTION_DAYS: 7
```

## 🔧 Configuration

### Server Configuration
Edit `docker-guacamole/guacamole/guacamole.properties`:

```properties
# Multi-user file paths
drive-path: /guacamole/downloads/${GUACAMOLE_USERNAME}
drive-filename-pattern: ${GUACAMOLE_USERNAME}-${timestamp}-${filename}

# Performance for 50-60 users
client-max-connections: 100
max-connections-per-user: 5
```

### Agent Configuration
Edit `local-print-agent/PrintAgentService/appsettings.json`:

```json
{
  "Server": {
    "Port": 8181,
    "EnableSSL": true
  },
  "FileActions": {
    "DefaultAction": "prompt",
    "RememberUserChoices": true
  },
  "Security": {
    "MaxFileSize": 52428800,
    "RetentionDays": 7
  }
}
```

### Extension Configuration
Extension configuration is stored in browser storage:

```javascript
// Via popup or options page
{
  "endpoint": "wss://localhost:8181/ws",
  "showNotifications": true,
  "autoProcess": false,
  "rememberChoices": true
}
```

## 📁 File Type Actions

| File Type | Default Action | Available Actions | Notes |
|------------|------------------|-------------------|---------|
| PDF | Prompt | Print, Download, Open | Direct printing supported |
| Excel (.xlsx/.xls) | Download | Download, Open, Print | Via default app |
| Word (.docx/.doc) | Download | Download, Open, Print | Via default app |
| Images (.jpg/.png) | Prompt | Print, Download, Open | Thumbnail preview |
| Text (.txt) | Download | Download, Open | Simple text editor |
| Archives (.zip/.rar) | Download | Download only | Cannot open directly |

## 🛡️ Security Features

### Network Security
- **WSS Only**: Secure WebSocket connections with TLS
- **Localhost Only**: Print agent accepts only localhost connections
- **Certificate Validation**: Automatic certificate generation and trust installation
- **Rate Limiting**: 10 requests per minute per connection
- **Access Control**: User isolation and directory permissions

### File Security
- **File Type Validation**: Only allowed extensions processed
- **Size Limits**: 50MB per file, configurable
- **Content Scanning**: Optional malware scanning integration
- **Audit Logging**: Complete transfer history with metadata

### Data Protection
- **User Isolation**: Per-user directories and quotas
- **Secure Storage**: Encrypted local preferences
- **Automatic Cleanup**: 7-day retention with manual override
- **Backup Support**: Automated database and file backups

## 📈 Performance Optimization

### Multi-User Scalability
- **Connection Pooling**: WebSocket connection reuse
- **Lazy Loading**: On-demand service initialization
- **Memory Management**: Efficient file streaming and cleanup
- **Disk I/O**: Optimized file operations with buffering

### Browser Extension
- **Event Delegation**: Efficient DOM and network monitoring
- **Memory Management**: Automatic cleanup of intercepted data
- **UI Responsiveness**: Asynchronous file processing
- **Background Processing**: Service worker for heavy operations

### Docker Environment
- **Resource Limits**: Configured memory and CPU limits
- **Load Balancing**: Nginx reverse proxy with health checks
- **Volume Optimization**: Proper Docker volumes for persistence
- **Health Monitoring**: Automated service health checks

## 📋 Management and Monitoring

### Real-time Monitoring
```bash
# Service status
./monitor-services.sh

# User quotas
./scripts/monitor-user-quotas.sh

# Transfer history
sqlite3 Database/history.db "SELECT * FROM TransferHistory ORDER BY CreatedAt DESC LIMIT 10"
```

### Administrative Tasks
```bash
# Update users
./setup-multi-user.sh

# Backup data
./backup-data.sh

# Update services
./update-services.sh

# Cleanup old files
./scripts/cleanup-user-files.sh
```

### User Statistics
- **Daily Statistics**: Files processed, types, actions
- **Usage Reports**: Per-user transfer volumes
- **Performance Metrics**: Processing times, success rates
- **Error Tracking**: Failed transfers with detailed logs

## 🔧 Troubleshooting

### Common Issues

**Certificate Trust Errors**:
```powershell
# Regenerate certificate
./generate-cert.ps1 -InstallTrust -Force

# Manual trust import
certmgr.msc → Trusted Root → Import certificate.cer
```

**Service Connection Issues**:
```powershell
# Check service status
Get-Service GuacamolePrintAgent

# Test WebSocket port
Test-NetConnection -ComputerName localhost -Port 8181

# Check logs
Get-EventLog -LogName Application -Source "Guacamole Print Agent" -Newest 20
```

**File Transfer Issues**:
```bash
# Check Guacamole logs
docker-compose logs guacamole-client

# Verify user directory
ls -la user-downlogs/username/

# Check file permissions
stat user-downloads/username/filename.pdf
```

### Debug Mode
Enable debug logging:
```json
// appsettings.json
{
  "Logging": {
    "LogLevel": "Debug",
    "EnableFileLogging": true
  }
}
```

## 📚 API Reference

### WebSocket Protocol

#### File Transfer Request
```json
{
  "messageId": "msg_123456789_abc123",
  "type": "file_transfer",
  "action": "print|download|open|prompt",
  "file": {
    "name": "document.pdf",
    "type": "application/pdf",
    "size": 1048576,
    "content": "base64_encoded_file_content",
    "availableActions": ["print", "download", "open"]
  },
  "metadata": {
    "userName": "john.doe",
    "sessionId": "session_abc123",
    "source": "remote-desktop-server-01"
  }
}
```

#### Response
```json
{
  "messageId": "msg_123456789_abc123",
  "type": "response",
  "status": "success|error",
  "data": {
    "action": "print",
    "filePath": "C:\\Users\\User\\Downloads\\document.pdf",
    "printer": "HP LaserJet Pro",
    "processingTimeMs": 2500
  }
}
```

### REST Endpoints
- **Health Check**: `GET /health`
- **Status**: `GET /status` (requires connection)
- **History**: `GET /history` (WebSocket message)

## 🚀 Deployment Scripts

### Automated Client Deployment
```batch
deployment\setup-client.bat
```
- ✅ Checks administrative privileges
- ✅ Installs .NET 8 Runtime
- ✅ Builds and installs service
- ✅ Generates SSL certificate
- ✅ Creates desktop shortcuts
- ✅ Configures firewall
- ✅ Tests installation

### Docker Deployment
```bash
deployment/docker-setup.sh
```
- ✅ Sets up multi-user directories
- ✅ Generates SSL certificates
- ✅ Builds and starts Docker services
- ✅ Creates management scripts
- ✅ Configures monitoring
- ✅ Provides management commands

## 📖 Documentation

- **User Guide**: Step-by-step setup and usage
- **Admin Guide**: Multi-user configuration and management
- **API Reference**: Complete WebSocket and REST API docs
- **Troubleshooting**: Common issues and solutions
- **Development**: Extending and customizing the solution

## 🎯 Success Criteria

### Functional Requirements ✅
- [x] Seamless PDF printing from RDP sessions
- [x] Multi-file type support with intelligent routing
- [x] 7-day transfer history with retry capability
- [x] Secure WebSocket communication
- [x] User-friendly interface with action choices

### Performance Requirements ✅
- [x] File transfer completion within 10 seconds for <5MB files
- [x] Certificate generation within 30 seconds
- [x] UI response time <2 seconds
- [x] Service startup time <15 seconds

### Security Requirements ✅
- [x] All communications encrypted via WSS
- [x] File type validation and size limits
- [x] Localhost-only connections for print agent
- [x] Audit logging for all transfers

### Usability Requirements ✅
- [x] One-click installation for clients
- [x] Automatic certificate trust setup
- [x] Intuitive file action selection
- [x] Clear error messages and troubleshooting

---

## 🎉 Ready for Production

This comprehensive solution is now ready for deployment in your Guacamole environment supporting 50-60 concurrent users. All components have been implemented with enterprise-grade security, performance optimization, and user-friendly interfaces.

For immediate deployment, follow the Quick Start section or run the provided deployment scripts for automated setup.

**Built with ❤️ for seamless Guacamole printing and file transfer**