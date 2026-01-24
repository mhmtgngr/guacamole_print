#!/bin/bash

# ==================== GUACAMOLE WITH PRINT AGENT STARTER SCRIPT ====================
# Easy startup script for Guacamole with integrated print agent

echo "🚀 Starting Guacamole with Print Agent..."
echo "================================================"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose > /dev/null 2>&1 && ! docker compose version > /dev/null 2>&1; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose and try again."
    exit 1
fi

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down..."
    if [ ! -z "$COMPOSE_PID" ]; then
        kill $COMPOSE_PID 2>/dev/null
    fi
    exit 0
}

# Trap signals
trap cleanup SIGTERM SIGINT

echo "🔧 Building and starting containers..."

# Use docker compose or docker-compose
if command -v docker-compose > /dev/null 2>&1; then
    docker-compose up --build -d
else
    docker compose up --build -d
fi

if [ $? -eq 0 ]; then
    echo "✅ Containers started successfully!"
    echo ""
    echo "🌐 Access URLs:"
    echo "   - Guacamole: http://localhost:8080/guacamole"
    echo "   - Print Agent Health: http://localhost:8182/health"
    echo ""
    echo "📊 Print Agent WebSocket: ws://localhost:8182/ws"
    echo ""
    echo "🔍 To check status: docker-compose ps"
    echo "📝 To view logs: docker-compose logs -f"
    echo "🛑 To stop: docker-compose down"
    echo ""
    echo "🎯 Your print agent should now show GREEN connected status!"
    echo ""
    
    # Wait for user input to stop
    echo "Press Ctrl+C to stop all containers..."
    while true; do
        sleep 1
    done
else
    echo "❌ Failed to start containers!"
    exit 1
fi