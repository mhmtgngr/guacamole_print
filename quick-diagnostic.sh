#!/bin/bash

echo "🔍 Guacamole Print Extension - Quick Diagnostic"
echo "============================================="
echo ""

# Function to print colored output
print_status() {
    case $1 in
        "OK") echo "✅ $2" ;;
        "FAIL") echo "❌ $2" ;;
        "WARN") echo "⚠️ $2" ;;
        "INFO") echo "ℹ️ $2" ;;
    esac
}

# 1. Check Docker
print_status "INFO" "1. Checking Docker containers..."
if command -v docker &> /dev/null; then
    CONTAINER=$(docker ps | grep guacamole | head -1)
    if [ -n "$CONTAINER" ]; then
        print_status "OK" "Guacamole container is running"
        echo "$CONTAINER"
    else
        print_status "FAIL" "No Guacamole container found"
        echo "To start: docker-compose -f docker-guacamole/docker-compose.stable.yml up -d"
    fi
else
    print_status "FAIL" "Docker not installed or not accessible"
fi

echo ""

# 2. Check web access
print_status "INFO" "2. Checking web accessibility..."
if curl -s --connect-timeout 5 http://localhost:8080/guacamole > /dev/null; then
    print_status "OK" "Guacamole web interface accessible"
else
    print_status "FAIL" "Cannot access Guacamole at http://localhost:8080/guacamole"
fi

if curl -s --connect-timeout 5 http://localhost:8080/guacamole/print-agent-client.js | grep -q "guacamolePrintAgent"; then
    print_status "OK" "Extension JavaScript accessible"
else
    print_status "FAIL" "Extension JavaScript not accessible"
fi

if curl -s --connect-timeout 5 http://localhost:8080/guacamole/print-agent.css | grep -q "guacamole-print-modal"; then
    print_status "OK" "Extension CSS accessible"
else
    print_status "FAIL" "Extension CSS not accessible"
fi

echo ""

# 3. Check local print agent (if curl can reach it)
print_status "INFO" "3. Checking local print agent..."
if curl -s --connect-timeout 5 http://localhost:8181/health > /dev/null; then
    print_status "OK" "Local print agent is running"
    HEALTH=$(curl -s http://localhost:8181/health 2>/dev/null)
    echo "Health response: $HEALTH"
else
    print_status "FAIL" "Local print agent not accessible at http://localhost:8181"
    if command -v powershell.exe &> /dev/null; then
        print_status "INFO" "Running Windows service check..."
        powershell.exe -Command "Get-Service -Name 'GuacamolePrintAgent' -ErrorAction SilentlyContinue | Select-Object Name, Status"
    fi
fi

echo ""

# 4. Check files in container
CONTAINER_NAME=$(docker ps | grep guacamole | head -1 | awk '{print $NF}')
if [ -n "$CONTAINER_NAME" ]; then
    print_status "INFO" "4. Checking extension files in container..."
    
    JS_EXISTS=$(docker exec $CONTAINER_NAME test -f /home/guacamole/tomcat/webapps/guacamole/print-agent-client.js 2>/dev/null && echo "YES" || echo "NO")
    CSS_EXISTS=$(docker exec $CONTAINER_NAME test -f /home/guacamole/tomcat/webapps/guacamole/print-agent.css 2>/dev/null && echo "YES" || echo "NO")
    
    if [ "$JS_EXISTS" = "YES" ]; then
        print_status "OK" "print-agent-client.js exists in container"
    else
        print_status "FAIL" "print-agent-client.js missing from container"
    fi
    
    if [ "$CSS_EXISTS" = "YES" ]; then
        print_status "OK" "print-agent.css exists in container"
    else
        print_status "FAIL" "print-agent.css missing from container"
    fi
    
    # Check index.html integration
    INDEX_JS=$(docker exec $CONTAINER_NAME grep -c "print-agent-client.js" /home/guacamole/tomcat/webapps/guacamole/index.html 2>/dev/null || echo "0")
    INDEX_CSS=$(docker exec $CONTAINER_NAME grep -c "print-agent.css" /home/guacamole/tomcat/webapps/guacamole/index.html 2>/dev/null || echo "0")
    
    if [ "$INDEX_JS" -gt 0 ]; then
        print_status "OK" "print-agent-client.js included in index.html"
    else
        print_status "FAIL" "print-agent-client.js not included in index.html"
    fi
    
    if [ "$INDEX_CSS" -gt 0 ]; then
        print_status "OK" "print-agent.css included in index.html"
    else
        print_status "FAIL" "print-agent.css not included in index.html"
    fi
fi

echo ""

# 5. Summary and recommendations
print_status "INFO" "5. Summary & Next Steps"
echo "======================================"
echo ""

echo "🌐 Browser Test:"
echo "1. Open http://localhost:8080/guacamole in your browser"
echo "2. Press F12 to open Developer Tools"
echo "3. Check Console tab for: '🚀 Guacamole Print Agent: Initializing'"
echo "4. Look for red '🖨️ PRINT AGENT LOADED' badge in top-left corner"
echo ""

echo "🧪 Manual Test (in browser console):"
echo "window.guacamolePrintAgent.showModal('test.pdf', 'application/pdf', null);"
echo ""

echo "🔧 Quick Fixes:"
echo "- If files missing: ./inject-print-extension-manually.sh"
echo "- If container not running: docker-compose -f docker-guacamole/docker-compose.stable.yml up -d"
echo "- If print agent not running: powershell -Command \"Start-Service -Name 'GuacamolePrintAgent'\""
echo "- Full rebuild: ./rebuild-guacamole-with-print.sh"
echo ""

print_status "INFO" "For detailed troubleshooting, see:"
echo "- TROUBLESHOOTING_QUICK_REFERENCE.md (5-minute guide)"
echo "- COMPREHENSIVE_TROUBLESHOOTING_GUIDE.md (detailed steps)"
echo ""

print_status "INFO" "Diagnostic complete!"
