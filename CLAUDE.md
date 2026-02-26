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
| `local-print-agent/installer/DefenderSetup.vbs` | VBScript - adds Defender exclusions with UAC elevation |
| `local-print-agent/installer/DefenderRemove.vbs` | VBScript - removes Defender exclusions with UAC elevation |
| `local-print-agent/installer/DefenderSetup.bat` | Batch - adds Defender exclusions (self-elevating) |
| `local-print-agent/installer/DefenderRemove.bat` | Batch - removes Defender exclusions (self-elevating) |
| `local-print-agent/build-installer.bat` | Builds self-contained EXE + MSI from source |
| `dev/initdb/` | SQL scripts for PostgreSQL initialization |
| `remote-server-scripts/UserFileWatcher.ps1` | PowerShell file watcher for RDP server - copies to `\\tsclient\GuacamoleDrive\Download` |
| `remote-server-scripts/Install-UserFileWatcher.ps1` | Installer: creates scheduled task (logon + RDP reconnect triggers) |
| `remote-server-scripts/Uninstall-FileWatcher.ps1` | Uninstaller: removes task, stops watchers, deletes install folder |

## Current State (2026-02-26, branch: dev)

### What Works (CONFIRMED)
- Docker stack runs (PostgreSQL, guacd with drive volume, Guacamole web on port 8080)
- guacd init container sets `/drive` permissions (UID 1000) on every startup
- Guacamole drive redirection: `\\tsclient\GuacamoleDrive` accessible in RDP sessions
- C# print agent installs via single MSI file (v2.9.0.0) and runs hidden in background
- Agent auto-starts on Windows login for **all users** (HKLM registry + StartHidden.vbs)
- Windows Firewall rule added automatically (port 8181, localhost only)
- Windows Defender exclusion added automatically
- WebSocket connection established between browser and agent
- **Browser connection indicator**: small green/gray dot in bottom-right corner shows agent status
- `aggressive-intercept.js` v9.0 loaded inside WAR (no 404)
- `Guacamole.Client.onfile` patched, stream.index >= 0 captures blob data directly
- **Print data flows end-to-end**: JS captures bytes → sends via WS → C# receives → decodes → renders PDF
- **Print sizing dialog** before printing: scale options (Sayfaya Sığdır / Gerçek Boyut / Özel 25-400%) + adjustable margins (mm) + live A4 preview
- **Native Windows PrintDialog appears** after sizing dialog with printer selection
- PDF rendered at 300 DPI on-demand (pages rendered during print, not upfront)
- Scale > 100% enlarges content (overflows page, cropped naturally)
- **Non-PDF files show Windows Save As dialog** (user picks save location)
- Heartbeat ping/pong keeps connection alive
- **Duplicate sends prevented**: filename+size dedup (10s window) + blob WeakSet + capturedFiles map
- ForceForeground with Alt-key trick brings dialogs to front
- **UserFileWatcher** on RDP servers: monitors user profile, copies to `\\tsclient\GuacamoleDrive\Download`
- FileWatcher scheduled task triggers on both logon AND RDP reconnect

### MSI Installer

Single file: `local-print-agent/installer/GuacamolePrintAgent.msi` (~65 MB)
Version: **2.9.0.0** (WiX v4, UpgradeCode: `B748B3C5-C676-4B01-83F6-6D8DEE89DFE4`)

**What it does on install:**
1. Installs files to `C:\Program Files\GuacamolePrintAgent\` (8 files)
2. Self-contained EXE (no .NET runtime required on target machine)
3. Adds Windows Firewall rule (port 8181, inbound, localSubnet) via WiX Firewall extension
4. Adds Windows Defender exclusions (folder path + process name) via `DefenderSetup.vbs`
5. Registers auto-start on login for all users (HKLM Run key via StartHidden.vbs)
6. Launches agent hidden (no console window) via `StartHidden.vbs`

**What it does on uninstall:**
1. Stops running `GuacamolePrintAgent.exe` process (deferred CA with `taskkill /F`)
2. Removes Defender exclusions via `DefenderRemove.vbs`
3. Removes all installed files and install folder
4. Removes HKLM auto-start registry key
5. Removes Windows Firewall rule

**Installed files:**
| File | Purpose |
|------|---------|
| `GuacamolePrintAgent.exe` | Main agent (~195 MB, self-contained .NET 8) |
| `appsettings.json` | ASP.NET Core configuration |
| `StartHidden.vbs` | Launches agent with window style 0 (hidden) |
| `Uninstall.bat` | Manual uninstaller (alternative) |
| `DefenderSetup.bat` | Adds Defender exclusions (self-elevating) |
| `DefenderSetup.vbs` | Adds Defender exclusions via ShellExecute runas |
| `DefenderRemove.bat` | Removes Defender exclusions (self-elevating) |
| `DefenderRemove.vbs` | Removes Defender exclusions via ShellExecute runas |

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

**WiX Custom Actions:**
| Action | Type | When | Purpose |
|--------|------|------|---------|
| `StopAgent` | Deferred, SYSTEM | Before RemoveFiles (uninstall/upgrade) | `taskkill /IM GuacamolePrintAgent.exe /F` |
| `AddDefenderExclusions` | Immediate, asyncNoWait | After InstallFinalize (install) | `wscript.exe DefenderSetup.vbs` (UAC elevation) |
| `RemoveDefenderExclusions` | Immediate, asyncNoWait | After StopAgent (uninstall) | `wscript.exe DefenderRemove.vbs` (UAC elevation) |
| `LaunchAgent` | Immediate, asyncNoWait | After AddDefenderExclusions (install) | `wscript.exe StartHidden.vbs` |

**Note on Defender exclusions:** MSI deferred custom actions (running as SYSTEM) cannot execute `Add-MpPreference` / `Remove-MpPreference`. The solution uses VBScript with `ShellExecute "runas"` to properly elevate through Windows UAC. This is the same pattern used by `StartHidden.vbs`.

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
| Non-PDF shows save/cancel dialog | WinForms dialog for all non-PDF | Non-PDF files now show Windows Save As dialog |
| Save dialog appears 6-7 times | Multiple JS layers send same file | Added filename+size dedup with 10s window |
| MSI upgrade doesn't replace EXE | Same version number (1.0.0.0) | Bumped to 1.1.0.0 |
| Auto-start only for installing user | HKCU registry key | Changed to HKLM (all users) |
| FileWatcher not starting on RDP reconnect | AtLogOn only fires on new logon | Added session state change trigger (type 8) |
| WebSocket connect/disconnect loop | Docker OPA container (`openidx-opa`) also listening on port 8181 | Changed OPA port mapping to 8281 |
| MSI uninstall leaves files behind | No custom action to stop agent before file removal; EXE locked | Added `StopAgent` deferred CA with `taskkill /F` before RemoveFiles |
| MSI doesn't add Defender exclusions | MSI deferred CAs (SYSTEM) can't run `Add-MpPreference` | VBScript with `ShellExecute "runas"` for proper UAC elevation |
| MSI doesn't remove Defender on uninstall | No uninstall CA for Defender | Added `RemoveDefenderExclusions` CA via `DefenderRemove.vbs` |
| PDF prints too small on A4 | No scaling options, default margins too large | Added sizing dialog with fit/actual/custom scale + adjustable margins |
| MSI not replacing EXE on upgrade | `AssemblyFileVersion` stuck at 1.0.0.0 while WXS bumped | Synced `AssemblyFileVersion` in csproj with WXS package version |
| Turkish chars clipped in dialog | Fixed-size labels too short for diacritics (Ö, ş, ğ) | Changed to `AutoSize = true` on all labels |
| Dialog appears behind browser | `TopMost` + `BringToFront` not enough from background | Restored `ForceForeground` (Alt-key trick) in Shown event |
| Scale > 100% had no effect | Content clamped back to fit within margins | Removed clamping; overflow clipped to paper bounds |

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
5. Render first page at 96 DPI for preview image
6. Show **sizing dialog** (Turkish UI) with:
   - Scale options: Sayfaya Sığdır (fit) / Gerçek Boyut (actual 100%) / Özel % (25-400%)
   - Adjustable margins: Üst/Alt/Sol/Sağ in mm (default 6mm)
   - Live A4 preview panel with dashed margin lines, updates on any change
   - Content overflow clipped to paper bounds for scale > 100%
7. `ForceForeground(mainForm.Handle)` - Alt-key trick to steal focus from browser
8. On Yazdır: read scale mode + margin values (mm → hundredths of inch)
9. Show `PrintDialog(ownerForm)` - native Windows dialog with printer selection
10. On OK: `PrintDocument.Print()` renders each page on-demand at 300 DPI
11. `Conversion.ToImage(fileBytes, pageIndex, null, RenderOptions(Dpi:300))` per page
12. Scale/position image according to user's chosen scale mode, centered within margins

### Non-PDF File Flow
1. Same decode + save as PDF
2. Show Windows `SaveFileDialog` on STA thread with `ForceForeground`
3. File filter based on extension (Excel, Word, PowerPoint, images, etc.)
4. Default location: Desktop
5. User picks save location → file copied from temp to chosen path

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
| Print Dialog | Custom WinForms sizing dialog (Turkish UI) + System.Drawing.Printing.PrintDialog |
| Agent Server | ASP.NET Core WebSocket (port 8181) |
| Foreground Hack | Win32 P/Invoke (AttachThreadInput, keybd_event, SetForegroundWindow) |
| Installer | WiX Toolset 6.0 (MSI) + batch scripts |
| Background Launch | VBScript (StartHidden.vbs, window style 0) |
| Remote Monitor | PowerShell 5.1+ (UserFileWatcher.ps1) |

## Deploying to Another Project

To add print/file transfer to an existing Guacamole deployment:

1. Create `guacamole-custom/` folder with `Dockerfile`, `aggressive-intercept.js`, `start-aggressive-print.sh` from `dev/`
2. Change guacamole service from `image:` to `build: ./guacamole-custom`
3. Add `./drive:/drive` volume to guacd service
4. `docker-compose up -d --build`
5. Configure RDP connections: Enable Drive, Drive Path `/drive`, Drive Name `GuacamoleDrive`
6. Install `GuacamolePrintAgent.msi` on each client PC
7. (Optional) Install `UserFileWatcher` on RDP servers for auto file transfer

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
