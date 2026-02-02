@echo off
:: Guacamole Print Agent Uninstaller
:: Requires Administrator privileges

:: Check for admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ============================================
echo   Guacamole Print Agent - Uninstaller
echo ============================================
echo.

set "INSTALL_DIR=C:\Program Files\GuacamolePrintAgent"
set "AGENT_EXE=GuacamolePrintAgent.exe"
set "RULE_NAME=Guacamole Print Agent"

:: 1. Stop agent
echo [1/4] Stopping agent...
taskkill /IM %AGENT_EXE% /F >nul 2>&1
timeout /t 2 /nobreak >nul
echo    Agent stopped.

:: 2. Remove firewall rule
echo [2/4] Removing firewall rule...
netsh advfirewall firewall delete rule name="%RULE_NAME%" >nul 2>&1
echo    Firewall rule removed.

:: 3. Remove Defender exclusion
echo [3/4] Removing Defender exclusion...
powershell -Command "Remove-MpPreference -ExclusionPath '%INSTALL_DIR%'" >nul 2>&1
echo    Defender exclusion removed.

:: 4. Remove startup entry
echo [4/4] Removing auto-start...
reg delete "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "GuacamolePrintAgent" /f >nul 2>&1
reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "GuacamolePrintAgent" /f >nul 2>&1
echo    Auto-start removed.

:: 5. Delete install folder
echo.
echo Removing files from %INSTALL_DIR%...
:: Copy uninstaller to temp to allow self-deletion
copy /Y "%~f0" "%TEMP%\GuacPrintUninstall_cleanup.bat" >nul 2>&1
rd /s /q "%INSTALL_DIR%" >nul 2>&1
echo    Files removed.

echo.
echo ============================================
echo   Uninstall complete!
echo ============================================
echo.
pause
