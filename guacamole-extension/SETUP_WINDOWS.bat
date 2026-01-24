@echo off
setlocal enabledelayedexpansion

title Guacamole Print Extension - Windows Setup

echo.
echo ========================================
echo   GUACAMOLE PRINT EXTENSION
echo       Windows Installation Assistant
echo ========================================
echo.

REM Check Administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] This script requires Administrator privileges.
    echo        Please right-click and select "Run as administrator"
    echo.
    pause
    exit /b 1
)
echo [OK] Running with Administrator privileges
echo.

REM Step 1: Check Node.js
echo [1/6] Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed
    echo.
    echo Please install Node.js LTS version:
    echo 1. Visit: https://nodejs.org/
    echo 2. Download and install Node.js 18+ LTS
    echo 3. Restart this script
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [OK] Node.js !NODE_VERSION! installed
echo.

REM Step 2: Check npm
echo [2/6] Checking npm installation...
npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is not installed
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo [OK] npm !NPM_VERSION! installed
echo.

REM Step 3: Install dependencies
echo [3/6] Installing extension dependencies...
call npm install
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    echo.
    echo Possible solutions:
    echo 1. Check internet connection
    echo 2. Try running: npm install --verbose
    echo 3. Clear npm cache: npm cache clean --force
    echo.
    pause
    exit /b 1
)
echo [OK] Dependencies installed successfully
echo.

REM Step 4: Install agent as Windows Service (optional)
echo [4/6] Would you like to install the print agent as a Windows service?
echo        This allows the agent to start automatically on boot.
echo.
set /p INSTALL_SERVICE="Install as Windows Service? (Y/N): "
if /i "!INSTALL_SERVICE!"=="Y" (
    echo Installing Windows service...
    npm run install:service
    if errorlevel 1 (
        echo [WARNING] Service installation failed
        echo           Agent will run in foreground mode
    ) else (
        echo [OK] Windows service installed
        echo         Agent will start automatically on boot
        echo.
        echo To manage service:
        echo   Start:   net start GuacamolePrintAgent
        echo   Stop:    net stop GuacamolePrintAgent
        echo   Remove:   sc delete GuacamolePrintAgent
    )
)
echo.

REM Step 5: Configure Firewall
echo [5/6] Checking Windows Firewall rules...
netsh advfirewall firewall show rule name="Guacamole Print Agent" >nul 2>&1
if errorlevel 1 (
    echo Adding firewall rule...
    netsh advfirewall firewall add rule name="Guacamole Print Agent" ^
        dir=in action=allow protocol=TCP localport=8181 ^
        profile=domain,private,public ^
        description="Allow Guacamole Print Agent WebSocket connections" >nul
    if errorlevel 1 (
        echo [WARNING] Failed to add firewall rule
        echo           You may need to add it manually
    ) else (
        echo [OK] Firewall rule added
    )
) else (
    echo [OK] Firewall rule already exists
)
echo.

REM Step 6: Start Agent
echo [6/6] Starting Guacamole Print Agent...
echo.
echo ========================================
echo Starting in 3 seconds...
echo Press Ctrl+C to stop the agent
echo ========================================
timeout /t 3 >nul

start "Guacamole Print Agent" cmd /k "node server/websocket-server.js"

REM Wait for agent to start
timeout /t 2 >nul

REM Check if agent is running
tasklist /FI "IMAGENAME eq node.exe" 2>nul | find /I /N "node.exe" >nul
if errorlevel 1 (
    echo [WARNING] Agent may not have started properly
    echo.
    echo Please check the new terminal window for error messages
) else (
    echo [OK] Agent started successfully
    echo.
    echo WebSocket server should be listening on ws://localhost:8181
)
echo.

REM Display installation summary
echo.
echo ========================================
echo      INSTALLATION COMPLETE
echo ========================================
echo.
echo Next Steps:
echo.
echo 1. OPEN BROWSER EXTENSION:
echo    Chrome: chrome://extensions/
echo    Edge:   edge://extensions/
echo.
echo 2. ENABLE DEVELOPER MODE:
echo    Toggle "Developer mode" in top-right corner
echo.
echo 3. LOAD EXTENSION:
echo    Click "Load unpacked"
echo    Select this folder: %CD%
echo    Enable the extension
echo.
echo 4. OPEN GUACAMOLE:
echo    Navigate to your Guacamole server
echo    Example: https://localhost/guacamole/
echo.
echo 5. VERIFY INSTALLATION:
echo    Look for purple print button (top-right)
echo    Check green "Connected" status (top-left)
echo.
echo 6. TEST PRINTING:
echo    Download a file in Guacamole
echo    Click purple print button
echo    Choose Print or Save option
echo.
echo ========================================
echo.

REM Create desktop shortcut
echo Creating desktop shortcut...
set DESKTOP=%USERPROFILE%\Desktop
set SHORTCUT=%DESKTOP%\Guacamole Print Agent.lnk
set TARGET=%CD%\START_AGENT.bat

if not exist "%SHORTCUT%" (
    powershell -command "$s=(New-Object -COM WScript.Shell).CreateShortcut('%SHORTCUT%');$s.TargetPath='%TARGET%';$s.WorkingDirectory='%CD%';$s.Description='Start Guacamole Print Agent'"
    echo [OK] Desktop shortcut created
)

REM Create start script for future use
echo @echo off > START_AGENT.bat
echo echo Starting Guacamole Print Agent... >> START_AGENT.bat
echo echo. >> START_AGENT.bat
echo echo Press Ctrl+C to stop >> START_AGENT.bat
echo start "Guacamole Print Agent" cmd /k "node server/websocket-server.js" >> START_AGENT.bat
echo timeout /t 2 ^>nul >> START_AGENT.bat
echo echo Agent started! Check new window for status. >> START_AGENT.bat

echo.
echo [OK] Created START_AGENT.bat for easy startup
echo.

REM Final check
echo.
echo ========================================
echo      VERIFICATION
echo ========================================
echo.
echo Checking port 8181 availability...
timeout /t 1 >nul
netstat -an | findstr "8181" | findstr "LISTENING" >nul
if errorlevel 1 (
    echo [WARNING] Port 8181 not found in LISTENING state
    echo           Agent may not have started correctly
    echo           Check the "Guacamole Print Agent" window for errors
) else (
    echo [OK] Port 8181 is listening
    echo [OK] Agent is ready to accept connections
)
echo.

echo ========================================
echo For detailed documentation, see:
echo   WINDOWS_INSTALLATION_GUIDE.md
echo.
echo For troubleshooting, check:
echo   1. Browser console (F12)
echo   2. Agent console window
echo   3. Port 8181 availability: netstat -an | findstr 8181
echo ========================================
echo.

pause
