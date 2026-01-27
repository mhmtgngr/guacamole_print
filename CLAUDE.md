# Guacamole Print Solution - Claude Context

## Project Overview

Enterprise "Click-to-Print" and file transfer solution for Apache Guacamole. Enables seamless printing and file download from browser-based RDP sessions to local printers/storage. Designed for 50-60 concurrent users.

## Architecture

```
RDP Session (Remote Desktop)
    │
    ▼
guacd (Guacamole Daemon - Docker)
    │  file/body instruction with stream
    │  Drive: /drive volume mounted, UID 1000 (guacd user)
    ▼
Guacamole Web Client (Docker, port 8080)
    │  index.html + aggressive-intercept.js v9.0
    ▼
JavaScript Interception (in browser)
    │  3 layers: URL.createObjectURL, onfile stream, anchor clicks
    │  Encodes file as Base64, sends via WebSocket
    │  Heartbeat ping every 10s to detect dead connections
    │  Duplicate detection via capturedFiles map
    ▼
WebSocket: ws://localhost:8181/ws
    ▼
Local Print Agent (C# .NET 8, runs hidden in background)
    │  Installed via MSI to C:\Program Files\GuacamolePrintAgent\
    │  Decodes Base64 → binary
    │  PDF: Renders with PDFtoImage (Pdfium) → native Windows PrintDialog
    │  Non-PDF: Opens directly with default Windows application
    │  ForceForeground: Alt-key trick + AttachThreadInput
    ▼
┌─────────┬────────────┐
│ Printer │ Default App│
└─────────┴────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `dev/aggressive-intercept.js` | **v9.0** - Main JS interception engine injected into Guacamole WAR |
| `dev/Dockerfile` | Builds custom Guacamole image; JS added INSIDE WAR via `jar uf` |
| `dev/docker-compose.yml` | Dev stack: PostgreSQL + guacd (with /drive volume) + init container + Guacamole web |
| `dev/start-aggressive-print.sh` | Entrypoint: calls `/opt/guacamole/bin/entrypoint.sh` |
| `local-print-agent/PrintAgentService/Program.cs` | C# WebSocket server + PDF rendering + PrintDialog + file handling |
| `local-print-agent/PrintAgentService/PrintAgentService.csproj` | .NET 8 project, includes PDFtoImage NuGet package |
| `local-print-agent/installer/GuacamolePrintAgent.msi` | **Single-file MSI installer** (65 MB, self-contained) |
| `local-print-agent/installer/GuacamolePrintAgent.wxs` | WiX v4 source for MSI build |
| `local-print-agent/installer/Install.bat` | Batch installer (alternative to MSI) |
| `local-print-agent/installer/Uninstall.bat` | Batch uninstaller |
| `local-print-agent/installer/StartHidden.vbs` | VBScript launcher - runs agent with no console window |
| `local-print-agent/build-installer.bat` | Builds self-contained EXE + MSI from source |
| `dev/initdb/` | SQL scripts for PostgreSQL initialization |
| `remote-server-scripts/UserFileWatcher.ps1` | PowerShell file watcher for RDP server - copies to `\\tsclient\GuacamoleDrive\Download` |

## Current State (2026-01-27, branch: dev)

### What Works (CONFIRMED)
- Docker stack runs (PostgreSQL, guacd with drive volume, Guacamole web on port 8080)
- guacd init container sets `/drive` permissions (UID 1000) on every startup
- Guacamole drive redirection: `\\tsclient\GuacamoleDrive` accessible in RDP sessions
- C# print agent installs via single MSI file and runs hidden in background
- Agent auto-starts on Windows login (registry + StartHidden.vbs)
- Windows Firewall rule added automatically (port 8181, localhost only)
- Windows Defender exclusion added automatically
- WebSocket connection established between browser and agent
- `aggressive-intercept.js` v9.0 loaded inside WAR (no 404)
- `Guacamole.Client.onfile` patched, stream.index >= 0 captures blob data directly
- **Print data flows end-to-end**: JS captures bytes → sends via WS → C# receives → decodes → renders PDF
- **Native Windows PrintDialog appears** with printer selection
- PDF rendered at 300 DPI on-demand (pages rendered during print, not upfront)
- **Non-PDF files open directly** with default Windows application (no dialog)
- Heartbeat ping/pong keeps connection alive
- Duplicate sends prevented (stream capture marks file, iframe skips it)
- ForceForeground with Alt-key trick brings print dialog to front

### MSI Installer

Single file: `local-print-agent/installer/GuacamolePrintAgent.msi` (65 MB)

**What it does:**
- Installs to `C:\Program Files\GuacamolePrintAgent\`
- Self-contained EXE (no .NET runtime required on target machine)
- Adds Windows Firewall rule (port 8181, localhost only)
- Adds Windows Defender exclusion (folder + process)
- Registers auto-start on login (HKCU Run key via StartHidden.vbs)
- Runs agent hidden (no console window)

**Usage:**
```
:: GUI install (double-click)
msiexec /i GuacamolePrintAgent.msi

:: Silent install
msiexec /i GuacamolePrintAgent.msi /qn

:: Silent uninstall
msiexec /x GuacamolePrintAgent.msi /qn

:: Start agent after silent install (auto-starts on next login)
wscript.exe "C:\Program Files\GuacamolePrintAgent\StartHidden.vbs"
```

**Rebuild MSI:**
```
cd local-print-agent
build-installer.bat
```
Requires: .NET 8 SDK, WiX Toolset 6.0+ (`dotnet tool install -g wix`, `wix extension add WixToolset.Firewall.wixext`)

### Docker Drive Configuration

Guacamole RDP connection settings:
| Setting | Value |
|---------|-------|
| Enable drive | ✓ |
| Drive name | `GuacamoleDrive` |
| Drive path | `/drive` |
| Automatically create drive | ✓ |
| Enable printing | ✓ |
| Redirected printer name | `Guacamole-Printer` |

The `docker-compose.yml` includes:
- `guacd-init` service: runs as root, sets `/drive` ownership to UID 1000 (guacd user)
- `guacd` service: bind mount `./drive:/drive`, depends on init completing
- Drive accessible in RDP as `\\tsclient\GuacamoleDrive` with `Download` subfolder

### Issues Fixed

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| JS 404 | `aggressive-intercept.js` outside WAR | Added JS inside WAR with `jar uf` in Dockerfile |
| Container crash loop | `start-aggressive-print.sh` called wrong entrypoint | Changed to `/opt/guacamole/bin/entrypoint.sh` |
| Print: no data | `stream.sendAck()` with index -1 invalid | Stream index >= 0: direct capture; -1: fallthrough to createObjectURL |
| Download: no dialog | iframe src override bypassed | Added `URL.createObjectURL` override + anchor click interceptor |
| No PDF handler | Shell `Verb="print"` failed | Added `PDFtoImage` NuGet; renders pages → `PrintDocument` + `PrintDialog` |
| Print dialog slow | Pre-rendered all pages at 300 DPI | Pages render on-demand during actual printing |
| Duplicate sends | Same file sent via stream + iframe | `capturedFiles` map prevents double send |
| Stale WebSocket | Agent restart leaves dead connection | 10s heartbeat ping; C# responds with pong |
| Dialog behind windows | `SetForegroundWindow` blocked | `ForceForeground()`: AttachThreadInput + Alt keypress |
| guacd drive permission denied | `/drive` owned by root, guacd runs as UID 1000 | Init container sets ownership before guacd starts |
| Agent exe blocked by Defender | Exclusion added after file copy | Exclusion now added BEFORE copying exe |
| Agent shows console window | EXE runs with visible console | StartHidden.vbs launches with window style 0 |
| Non-PDF shows save/cancel dialog | WinForms dialog for all non-PDF | Non-PDF files now open directly with default app |

### Remaining Issues

1. **Two scripts may conflict** - `aggressive-intercept.js` and `print-agent-client.js` both run; consider disabling `print-agent-client.js`
2. **Message type mismatch** - `print-agent-client.js` sends `type: 'fileTransfer'` (camelCase), C# expects `type: 'file_transfer'` (snake_case)
3. **MSI custom action** - Auto-launch after silent install (`/qn`) doesn't fire; agent starts on next login or manually via VBS

## How Things Are Built & Deployed

### Docker (Guacamole Server)
```bash
cd dev/
docker-compose down && docker-compose up -d --build
```
- Init container fixes `/drive` permissions (UID 1000)
- Dockerfile copies `aggressive-intercept.js` into WAR with `jar uf`
- Entrypoint: `start-aggressive-print.sh` → `/opt/guacamole/bin/entrypoint.sh`

### Local Print Agent (Windows)
```bash
# Build + package MSI
cd local-print-agent/
build-installer.bat

# Or build only (dev):
cd local-print-agent/PrintAgentService/
dotnet build -c Debug
dotnet GuacamolePrintAgent.dll   # run via dotnet (shows console)
```

### Full Rebuild & Restart
```bash
# 1. Rebuild Docker
cd dev && docker-compose down && docker-compose up -d --build

# 2. Rebuild and install agent
cd local-print-agent && build-installer.bat
# Then run Install.bat or msiexec /i GuacamolePrintAgent.msi

# 3. Refresh browser: Ctrl+Shift+R on http://localhost:8080/guacamole
```

## JavaScript Interception Strategy (v9.0)

Three layers + dedup + heartbeat:

1. **`URL.createObjectURL` override** (most reliable)
   - Catches ALL blob downloads regardless of mechanism
   - Maps filenames via `pendingFileNames` from onfile events
   - Uses `WeakSet` to prevent duplicate sends

2. **`Guacamole.Client.onfile` patch**
   - `stream.index >= 0`: Direct blob capture via `onblob`/`onend` handlers + `sendAck`
   - `stream.index === -1`: Pass through to original handler (blob override catches it)
   - Registers filename in `pendingFileNames` for blob URL mapping
   - Marks captured files in `capturedFiles` map

3. **Anchor click interceptor + iframe src override** (backup)
   - Catches `<a download>` clicks for blob: and /streams/ URLs
   - iframe src override for older Guacamole versions
   - Skips files already in `capturedFiles` (prevents double send)

4. **Heartbeat ping** every 10 seconds
   - Detects dead WebSocket connections after agent restart
   - If `ws.send()` throws, triggers reconnect

## C# Print Agent Details

### PDF Printing Flow
1. Receive `file_transfer` message via WebSocket
2. Decode Base64 → `byte[] fileBytes`
3. Save to `%TEMP%\GuacamolePrint\{filename}`
4. `Conversion.GetPageCount(fileBytes)` - get page count
5. Create invisible `TopMost` owner form
6. `ForceForeground(ownerForm.Handle)` - Alt-key trick to steal focus
7. Show `PrintDialog(ownerForm)` - native Windows dialog with printer selection
8. On OK: `PrintDocument.Print()` renders each page on-demand at 300 DPI
9. `Conversion.ToImage(fileBytes, pageIndex, null, RenderOptions(Dpi:300))` per page
10. Scale image to fit `e.MarginBounds`, centered

### Non-PDF File Flow
1. Same decode + save as PDF
2. `Process.Start` with `UseShellExecute = true` - opens with default Windows application
3. Fallback: opens containing folder in Explorer if no app registered

### WebSocket Message Types
| Type | Direction | Purpose |
|------|-----------|---------|
| `file_transfer` | Browser → Agent | File data with base64 content |
| `ping` | Browser → Agent | Heartbeat (every 10s) |
| `pong` | Agent → Browser | Heartbeat response |
| `response` | Agent → Browser | Action result (printing/saved/opened/cancelled) |
| `connection_established` | Agent → Browser | Welcome message on connect |
| `status_query` / `status_response` | Both | System status |

### File Storage
- Temp: `%TEMP%\GuacamolePrint\{filename}`
- Permanent: `~/Documents/GuacamoleFiles/{userName}/{filename}`
- Error log: `%TEMP%\GuacamolePrint\error.log`

## Useful Commands

```bash
# Check running containers
docker ps

# View Guacamole web logs
docker logs guac-print-web -f

# View guacd logs (RDP/drive issues)
docker logs guac-print-daemon -f

# Check print agent process
tasklist | findstr GuacamolePrintAgent

# Health check
curl http://localhost:8181/health

# Stop old Guacamole containers
docker stop guacamole-client guacamole-nginx guacamole-server guacamole-db
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Remote Access | Apache Guacamole 1.6.0 |
| Containers | Docker + Docker Compose |
| Database | PostgreSQL 15 |
| Protocol Daemon | guacd (with drive volume) |
| JS Interception | ES5 (for browser compat) |
| Local Agent | C# .NET 8.0 (net8.0-windows), self-contained publish |
| PDF Rendering | PDFtoImage 4.1.1 (Pdfium native) + SkiaSharp |
| Print Dialog | System.Drawing.Printing.PrintDialog (native Windows) |
| Agent Server | ASP.NET Core WebSocket (port 8181) |
| Foreground Hack | Win32 P/Invoke (AttachThreadInput, keybd_event, SetForegroundWindow) |
| Installer | WiX Toolset 6.0 (MSI) + batch scripts |
| Background Launch | VBScript (StartHidden.vbs, window style 0) |
| Remote Monitor | PowerShell 5.1+ (UserFileWatcher.ps1) |

## Project Cleanup (2026-01-27)

Removed ~100+ obsolete files from root:
- 36 markdown summary/status files
- 16 experimental Dockerfile variants
- 24 one-off PowerShell/batch scripts
- 10 test HTML files, 5 test JS files
- 3 C# Program.cs backups
- 187MB `bin/` build artifacts folder
- Old docker-compose variants
- Malformed filenames
