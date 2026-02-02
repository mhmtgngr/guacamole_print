@echo off
:: Self-elevate if not admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    powershell -Command "Start-Process '%~f0' -Verb RunAs" >nul 2>&1
    exit /b
)
powershell.exe -NoProfile -Command "Add-MpPreference -ExclusionPath 'C:\Program Files\GuacamolePrintAgent'" >nul 2>&1
powershell.exe -NoProfile -Command "Add-MpPreference -ExclusionProcess 'GuacamolePrintAgent.exe'" >nul 2>&1
