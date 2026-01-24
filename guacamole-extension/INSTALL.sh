#!/bin/bash
echo "========================================"
echo "Guacamole Print Agent - Quick Installer"
echo "========================================"
echo

# Check if Node.js is installed
echo "[1/4] Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js first:"
    echo "   https://nodejs.org/"
    exit 1
fi
echo "✅ Node.js found"

# Install dependencies
echo
echo "[2/4] Installing dependencies..."
if ! npm install; then
    echo "❌ Failed to install dependencies"
    exit 1
fi
echo "✅ Dependencies installed"

# Start local print agent in background
echo
echo "[3/4] Starting local print agent..."
nohup node server/websocket-server.js > guacamole-agent.log 2>&1 &
AGENT_PID=$!
echo "✅ Local agent started (PID: $AGENT_PID)"

# Wait a moment for the agent to start
sleep 2

# Browser extension installation instructions
echo
echo "[4/4] Browser Extension Installation:"
echo
echo "CHROME/EDGE INSTRUCTIONS:"
echo "1. Open chrome://extensions/ or edge://extensions/"
echo "2. Enable \"Developer mode\" (top right toggle)"
echo "3. Click \"Load unpacked extension\""
echo "4. Select this folder: $(pwd)"
echo "5. Enable the extension"
echo
echo "FIREFOX INSTRUCTIONS:"
echo "1. Open about:debugging"
echo "2. Click \"This Firefox\""
echo "3. Click \"Load Temporary Add-on\""
echo "4. Select the manifest.json file in this folder"
echo

echo "========================================"
echo "INSTALLATION INSTRUCTIONS SENT!"
echo "========================================"
echo
echo "Next: Open your browser and follow the extension installation steps above"
echo
echo "After installation, visit your Guacamole web interface and look for:"
echo "- Purple print button (top-right)"
echo "- Green \"Connected\" status (top-left)"
echo

# Create stop script
echo "Creating stop script..."
cat > stop-agent.sh << 'EOF'
#!/bin/bash
echo "Stopping Guacamole Print Agent..."
pkill -f "websocket-server.js"
echo "✅ Agent stopped"
EOF
chmod +x stop-agent.sh

echo
echo "✅ Setup complete! Your browser extension is ready to install."
echo
echo "Agent PID: $AGENT_PID"
echo "Log file: $(pwd)/guacamole-agent.log"
echo "Stop agent with: ./stop-agent.sh"
echo
echo "For troubleshooting, check:"
echo "- Agent logs: tail -f guacamole-agent.log"
echo "- Browser console (F12) for extension errors"
echo "- Port 8181 availability: netstat -tlnp | grep 8181"
echo

# Optional: Open the folder
if command -v xdg-open &> /dev/null; then
    echo "Press Enter to open this folder in file manager..."
    read -r
    xdg-open .
elif command -v open &> /dev/null; then
    echo "Press Enter to open this folder in Finder..."
    read -r
    open .
fi