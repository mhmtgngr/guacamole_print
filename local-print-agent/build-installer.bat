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
echo [1/4] Publishing self-contained executable...
dotnet publish "%PROJECT_DIR%\PrintAgentService.csproj" -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o "%OUTPUT_DIR%"
if %errorLevel% neq 0 (
    echo ERROR: Build failed!
    pause
    exit /b 1
)
echo    Build successful.

:: 2. Build MSI
echo.
echo [2/4] Building MSI installer...
wix build "%OUTPUT_DIR%\GuacamolePrintAgent.wxs" -ext "%WIX_EXT%" -o "%OUTPUT_DIR%\GuacamolePrintAgent.msi" -arch x64
if %errorLevel% neq 0 (
    echo ERROR: MSI build failed!
    pause
    exit /b 1
)
echo    MSI built successfully.

:: 3. Build EXE (Burn bootstrapper wrapping MSI)
echo.
set "BAL_EXT=%USERPROFILE%\.wix\extensions\WixToolset.Bal.wixext\6.0.2\wixext6\WixToolset.BootstrapperApplications.wixext.dll"
echo [3/4] Building Setup EXE...
wix build "%OUTPUT_DIR%\Bundle.wxs" -ext "%BAL_EXT%" -o "%OUTPUT_DIR%\GuacamolePrintAgentSetup.exe" -arch x64
if %errorLevel% neq 0 (
    echo WARNING: EXE build failed! MSI is still available.
    echo    Make sure WixToolset.Bal.wixext is installed:
    echo    wix extension add --global WixToolset.Bal.wixext/6.0.2
) else (
    echo    Setup EXE built successfully.
)

:: 4. Verify output
echo.
echo [4/4] Verifying...
if exist "%OUTPUT_DIR%\GuacamolePrintAgent.msi" (
    for %%A in ("%OUTPUT_DIR%\GuacamolePrintAgent.msi") do echo    GuacamolePrintAgent.msi  %%~zA bytes  OK
) else (
    echo    ERROR: MSI not found!
    pause
    exit /b 1
)
if exist "%OUTPUT_DIR%\GuacamolePrintAgentSetup.exe" (
    for %%A in ("%OUTPUT_DIR%\GuacamolePrintAgentSetup.exe") do echo    GuacamolePrintAgentSetup.exe  %%~zA bytes  OK
)

echo.
echo ============================================
echo   Installers ready:
echo   %OUTPUT_DIR%\GuacamolePrintAgent.msi
echo   %OUTPUT_DIR%\GuacamolePrintAgentSetup.exe
echo.
echo   EXE Install:    GuacamolePrintAgentSetup.exe
echo   EXE Silent:     GuacamolePrintAgentSetup.exe /quiet
echo   EXE Uninstall:  GuacamolePrintAgentSetup.exe /uninstall
echo.
echo   MSI Install:    msiexec /i GuacamolePrintAgent.msi
echo   MSI Silent:     msiexec /i GuacamolePrintAgent.msi /qn
echo   MSI Uninstall:  msiexec /x GuacamolePrintAgent.msi /qn
echo ============================================
echo.
pause
