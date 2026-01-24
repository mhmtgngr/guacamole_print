@echo off
echo ========================================
echo Guacamole Print Agent - Quick Installer
echo ========================================
echo.

echo [1/4] Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js not found. Please install Node.js first:
    echo    https://nodejs.org/
    pause
    exit /b 1
)
echo ✅ Node.js found

echo.
echo [2/4] Installing dependencies...
call npm install
if errorlevel 1 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)
echo ✅ Dependencies installed

echo.
echo [3/4] Starting local print agent...
echo    This window must remain open while using the extension
echo.
start "Guacamole Print Agent" cmd /k "node server/websocket-server.js"
timeout /t 2 >nul
echo ✅ Local agent started

echo.
echo [4/4] Browser Extension Installation:
echo.
echo CHROME/EDGE INSTRUCTIONS:
echo 1. Open chrome://extensions/ or edge://extensions/
echo 2. Enable "Developer mode" (top right toggle)
echo 3. Click "Load unpacked extension"
echo 4. Select this folder: %CD%
echo 5. Enable the extension
echo.
echo FIREFOX INSTRUCTIONS:
echo 1. Open about:debugging
echo 2. Click "This Firefox"
echo 3. Click "Load Temporary Add-on"
echo 4. Select the manifest.json file in this folder
echo.

echo ========================================
echo INSTALLATION INSTRUCTIONS SENT!
echo ========================================
echo.
echo Next: Open your browser and follow the extension installation steps above
echo.
echo After installation, visit your Guacamole web interface and look for:
echo - Purple print button (top-right)
echo - Green "Connected" status (top-left)
echo.
echo Press any key to open this folder in File Explorer...
pause >nul
explorer .

echo.
echo ✅ Setup complete! Your browser extension is ready to install.
echo.
echo For troubleshooting, check:
echo - Agent console in the new window
echo - Browser console (F12) for extension errors
echo - Port 8181 availability
echo.
pause