@echo off
echo Setting JAVA_HOME to PDF24 JRE...
set JAVA_HOME=C:\Program Files\PDF24\jre
set PATH=%JAVA_HOME%\bin;%PATH%

echo JAVA_HOME: %JAVA_HOME%
echo Testing Java...
"%JAVA_HOME%\bin\java.exe" -version

echo.
echo Finding Maven...
set MAVEN_HOME=C:\ProgramData\chocolatey\lib\maven
set MAVEN_BIN=%MAVEN_HOME%\apache-maven-3.9.12\bin

echo MAVEN_HOME: %MAVEN_HOME%
echo Testing Maven...
"%MAVEN_BIN%\mvn.cmd" --version

echo.
echo Building Guacamole Extension...
cd /d "C:\Users\Mehmet\guacamole-print-solution\guacamole-extension-module"

echo Maven build started...
"%MAVEN_BIN%\mvn.cmd" clean package -Pdev -q

echo.
echo Checking build results...
if exist "target\guacamole-print-agent-extension-1.0.0.jar" (
    echo SUCCESS: Extension JAR created at:
    echo target\guacamole-print-agent-extension-1.0.0.jar
    echo.
    echo File size:
    dir "target\guacamole-print-agent-extension-1.0.0.jar" | findstr guacamole-print-agent-extension-1.0.0.jar
) else (
    echo ERROR: Extension JAR not found
    echo Target directory contents:
    dir target
)

echo.
pause