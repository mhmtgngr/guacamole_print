@echo off
:: Guacamole Print Agent Installer
:: Requires Administrator privileges

:: Check for admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ============================================
echo   Guacamole Print Agent - Installer v1.0
echo ============================================
echo.

set "INSTALL_DIR=C:\Program Files\GuacamolePrintAgent"
set "AGENT_EXE=GuacamolePrintAgent.exe"
set "RULE_NAME=Guacamole Print Agent"
set "SCRIPT_DIR=%~dp0"

:: 1. Stop existing agent if running
echo [1/6] Stopping existing agent...
taskkill /IM %AGENT_EXE% /F >nul 2>&1
timeout /t 2 /nobreak >nul

:: 2. Add Windows Defender exclusion FIRST (before copying exe)
echo [2/6] Adding Windows Defender exclusion...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
powershell -Command "Add-MpPreference -ExclusionPath '%INSTALL_DIR%'; Add-MpPreference -ExclusionProcess '%INSTALL_DIR%\%AGENT_EXE%'" >nul 2>&1
echo    Defender exclusion added.

:: 3. Copy files (after exclusion is set)
echo [3/6] Installing files to %INSTALL_DIR%...
copy /Y "%SCRIPT_DIR%\%AGENT_EXE%" "%INSTALL_DIR%\" >nul
if exist "%SCRIPT_DIR%\appsettings.json" copy /Y "%SCRIPT_DIR%\appsettings.json" "%INSTALL_DIR%\" >nul
copy /Y "%SCRIPT_DIR%\Uninstall.bat" "%INSTALL_DIR%\" >nul
copy /Y "%SCRIPT_DIR%\StartHidden.vbs" "%INSTALL_DIR%\" >nul
echo    Files installed successfully.

:: 4. Add Windows Firewall rule (localhost only)
echo [4/6] Configuring Windows Firewall...
netsh advfirewall firewall delete rule name="%RULE_NAME%" >nul 2>&1
netsh advfirewall firewall add rule name="%RULE_NAME%" dir=in action=allow protocol=TCP localport=8181 profile=any remoteip=127.0.0.1 >nul
echo    Firewall rule added (port 8181, localhost only).

:: 5. Register for startup (all users)
echo [5/6] Registering auto-start...
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "GuacamolePrintAgent" /t REG_SZ /d "wscript.exe \"%INSTALL_DIR%\StartHidden.vbs\"" /f >nul
echo    Auto-start registered for all users.

:: 6. Start the agent
echo [6/6] Starting Guacamole Print Agent (hidden)...
wscript.exe "%INSTALL_DIR%\StartHidden.vbs"
echo    Agent started in background.

echo.
echo ============================================
echo   Installation complete!
echo   Install path: %INSTALL_DIR%
echo   Port: 8181 (localhost)
echo   Auto-start: Enabled
echo ============================================
echo.
echo   To uninstall, run:
echo   "%INSTALL_DIR%\Uninstall.bat"
echo.
pause
