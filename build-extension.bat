@echo off
echo Setting up Java and Maven environment...

rem Set JAVA_HOME to OpenJDK installation
set JAVA_HOME=C:\Program Files\OpenJDK

rem Add Java to PATH
set PATH=%JAVA_HOME%\bin;%PATH%

echo JAVA_HOME: %JAVA_HOME%
echo Testing Java installation...
"%JAVA_HOME%\bin\java.exe" -version

echo.
echo Building Guacamole Extension Module...
cd /d "C:\Users\Mehmet\guacamole-print-solution\guacamole-extension-module"

rem Use Maven from Chocolatey installation
set MAVEN_HOME=C:\ProgramData\chocolatey\lib\maven
set MAVEN_BIN=%MAVEN_HOME%\apache-maven-3.9.12\bin

"%MAVEN_BIN%\mvn.cmd" --version

echo.
echo Building with Maven...
"%MAVEN_BIN%\mvn.cmd" clean package -Pdev

echo.
echo Build completed. Check target directory for JAR file.
echo Extension JAR should be at: target\guacamole-print-agent-extension-1.0.0.jar

pause