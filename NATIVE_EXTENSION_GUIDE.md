# Guacamole Print Agent - No Browser Extension Solution

## Overview

This solution provides seamless printing from Guacamole without requiring browser extensions. It uses a native Guacamole extension module that integrates directly with the Guacamole server.

## Architecture

```
Guacamole Server → Extension Module → WebSocket → Local Print Agent → Print Dialog
```

## Components

### 1. Guacamole Extension Module
- **Location**: `guacamole-extension-module/`
- **Language**: Java
- **Purpose**: Embeds print functionality directly into Guacamole web interface
- **Key Features**:
  - Intercepts file downloads and print operations
  - Communicates with local print agent via WebSocket
  - Shows embedded UI for print/download/open actions
  - No browser extension required

### 2. Local Print Agent
- **Location**: `local-print-agent/PrintAgentService/`
- **Language**: C#/.NET 8
- **Purpose**: Receives print jobs and processes them locally
- **Key Features**:
  - WebSocket server on port 8181
  - Native Windows printing support
  - File type validation and security
  - Progress tracking and error handling

### 3. JavaScript Client Integration
- **Location**: `guacamole-extension-module/src/main/resources/js/`
- **Purpose**: Client-side JavaScript embedded in Guacamole pages
- **Key Features**:
  - File download interception
  - Modal UI for action selection
  - WebSocket communication
  - Progress indicators

## Installation Steps

### Step 1: Build Extension Module
```bash
# Navigate to extension module directory
cd guacamole-extension-module

# Build with Maven (requires Java 8+ and Maven)
mvn clean package -Pdev

# Output: target/guacamole-print-agent-extension-1.0.0.jar
```

### Step 2: Deploy Extension to Guacamole
```bash
# Copy extension JAR to Guacamole extensions directory
cp target/guacamole-print-agent-extension-1.0.0.jar /etc/guacamole/extensions/

# Or add to your Guacamole WAR file
# Place in WEB-INF/lib/ directory of Guacamole webapp
```

### Step 3: Configure Guacamole
Add to `guacamole.properties`:
```properties
# Enable the extension
extension: org.apache.guacamole.printagent.extension.PrintAgentExtension

# WebSocket endpoint (if different)
print-agent.websocket.endpoint: ws://localhost:8181/ws
```

### Step 4: Start Local Print Agent
```bash
# Navigate to print agent directory
cd local-print-agent/PrintAgentService

# Build and run
dotnet build
dotnet run

# Or install as Windows service
sc create GuacamolePrintAgent bin=Release/net8.0-windows/GuacamolePrintAgent.exe
sc start GuacamolePrintAgent
```

## Usage Flow

1. **User connects to Guacamole**
   - Extension automatically initializes
   - Shows connection status in interface

2. **User tries to print/download a file**
   - Extension intercepts the action
   - Shows modal with options: Print, Download, Open

3. **User selects action**
   - File is transferred via WebSocket to local agent
   - Progress is shown to user

4. **Local processing**
   - Print agent receives file
   - Opens local print dialog (if printing)
   - Returns success/error status

5. **Result displayed**
   - User sees completion status
   - File appears in local system as requested

## Key Advantages

✅ **No Browser Extension Required**
- Built directly into Guacamole server
- Works with any modern browser
- No client-side installation needed

✅ **Seamless Integration**
- Native-looking interface
- Smooth user experience
- Consistent across all clients

✅ **Secure Communication**
- Encrypted WebSocket connections
- Local-only processing
- File type validation

✅ **Cross-Platform Ready**
- Java-based server extension
- .NET-based local agent
- Can be adapted for other platforms

## Troubleshooting

### Extension Not Loading
- Check Guacamole logs for extension errors
- Verify JAR is in correct extensions directory
- Ensure Java 8+ is available

### Local Agent Not Connecting
- Verify port 8181 is not blocked by firewall
- Check if agent service is running
- Test WebSocket connection manually

### Print Jobs Not Appearing
- Verify default printer is configured
- Check file permissions for temporary files
- Review agent logs for errors

## Configuration Options

### Extension Settings
- File size limits
- Allowed file types
- WebSocket endpoint configuration
- User action preferences

### Agent Settings
- Port configuration (default: 8181)
- SSL/TLS settings
- Printer preferences
- Security policies

## Development Notes

### Building Extension Module
Requires:
- Java Development Kit (JDK) 8+
- Apache Maven 3.6+
- Guacamole extension API dependencies

### Building Local Agent
Requires:
- .NET 8.0 SDK
- Windows Forms (for UI)
- WebSocket dependencies

### Testing
1. Start local agent service
2. Deploy extension to test Guacamole instance
3. Connect via browser to Guacamole
4. Test print/download operations
5. Check WebSocket communication logs

## Security Considerations

- All file processing happens locally on user machine
- No sensitive data transmitted over internet
- File type and size restrictions enforced
- Encrypted communication channels
- Audit logging available