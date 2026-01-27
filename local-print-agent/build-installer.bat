@echo off
:: Build Guacamole Print Agent MSI Installer
echo ============================================
echo   Building Guacamole Print Agent MSI
echo ============================================
echo.

set "PROJECT_DIR=%~dp0PrintAgentService"
set "OUTPUT_DIR=%~dp0installer"
set "WIX_EXT=%~dp0..\.wix\extensions\WixToolset.Firewall.wixext\6.0.2\wixext6\WixToolset.Firewall.wixext.dll"

:: 1. Publish self-contained single-file EXE
echo [1/3] Publishing self-contained executable...
dotnet publish "%PROJECT_DIR%\PrintAgentService.csproj" -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o "%OUTPUT_DIR%"
if %errorLevel% neq 0 (
    echo ERROR: Build failed!
    pause
    exit /b 1
)
echo    Build successful.

:: 2. Build MSI
echo.
echo [2/3] Building MSI installer...
wix build "%OUTPUT_DIR%\GuacamolePrintAgent.wxs" -ext "%WIX_EXT%" -o "%OUTPUT_DIR%\GuacamolePrintAgent.msi" -arch x64
if %errorLevel% neq 0 (
    echo ERROR: MSI build failed!
    pause
    exit /b 1
)
echo    MSI built successfully.

:: 3. Verify output
echo.
echo [3/3] Verifying...
if exist "%OUTPUT_DIR%\GuacamolePrintAgent.msi" (
    for %%A in ("%OUTPUT_DIR%\GuacamolePrintAgent.msi") do echo    GuacamolePrintAgent.msi  %%~zA bytes  OK
) else (
    echo    ERROR: MSI not found!
    pause
    exit /b 1
)

echo.
echo ============================================
echo   MSI installer ready:
echo   %OUTPUT_DIR%\GuacamolePrintAgent.msi
echo.
echo   Install:   msiexec /i GuacamolePrintAgent.msi
echo   Silent:    msiexec /i GuacamolePrintAgent.msi /qn
echo   Uninstall: msiexec /x GuacamolePrintAgent.msi /qn
echo ============================================
echo.
pause
