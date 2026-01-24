#!/bin/bash

echo "🔍 Guacamole Print Extension Verification Script"
echo "=============================================="

# Check if container is running
echo "1. Checking container status..."
if ! docker ps | grep -q guacamole; then
    echo "❌ No Guacamole container running"
    exit 1
fi

CONTAINER_NAME=$(docker ps | grep guacamole | head -1 | awk '{print $NF}')
echo "✅ Found container: $CONTAINER_NAME"

# Check if print agent files exist in container
echo ""
echo "2. Checking print agent files in container..."
FILES_EXISTS=$(docker exec $CONTAINER_NAME sh -c "test -f /home/guacamole/tomcat/webapps/guacamole/print-agent-client.js && echo 'YES' || echo 'NO'")
if [ "$FILES_EXISTS" = "YES" ]; then
    echo "✅ print-agent-client.js exists"
else
    echo "❌ print-agent-client.js MISSING"
fi

CSS_EXISTS=$(docker exec $CONTAINER_NAME sh -c "test -f /home/guacamole/tomcat/webapps/guacamole/print-agent.css && echo 'YES' || echo 'NO'")
if [ "$CSS_EXISTS" = "YES" ]; then
    echo "✅ print-agent.css exists"
else
    echo "❌ print-agent.css MISSING"
fi

# Check if index.html includes print agent
echo ""
echo "3. Checking if index.html includes print agent..."
INCLUDES_JS=$(docker exec $CONTAINER_NAME sh -c "grep -c 'print-agent-client.js' /home/guacamole/tomcat/webapps/guacamole/index.html || echo '0'")
INCLUDES_CSS=$(docker exec $CONTAINER_NAME sh -c "grep -c 'print-agent.css' /home/guacamole/tomcat/webapps/guacamole/index.html || echo '0'")

if [ "$INCLUDES_JS" -gt 0 ]; then
    echo "✅ index.html includes print-agent-client.js"
else
    echo "❌ index.html does NOT include print-agent-client.js"
fi

if [ "$INCLUDES_CSS" -gt 0 ]; then
    echo "✅ index.html includes print-agent.css"
else
    echo "❌ index.html does NOT include print-agent.css"
fi

# Test web access
echo ""
echo "4. Testing web access..."
if curl -s http://localhost:8080/guacamole/print-agent-client.js | grep -q "guacamolePrintAgent"; then
    echo "✅ print-agent-client.js is accessible via web"
else
    echo "❌ print-agent-client.js is NOT accessible via web"
fi

if curl -s http://localhost:8080/guacamole/print-agent.css | grep -q "guacamole-print-modal"; then
    echo "✅ print-agent.css is accessible via web"
else
    echo "❌ print-agent.css is NOT accessible via web"
fi

echo ""
echo "=============================================="
echo "🏁 Verification Complete"
echo ""
echo "Next steps:"
echo "1. Open http://localhost:8080/guacamole in browser"
echo "2. Press F12 to open Developer Tools"
echo "3. Check Console tab for: '🚀 Guacamole Print Agent: Initializing'"
echo "4. Check Network tab for print-agent-client.js and print-agent.css"
echo "5. Look for '🖨️ PRINT AGENT LOADED' badge in top-left corner"
