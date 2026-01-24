#!/bin/bash

echo "🔧 Rebuilding Guacamole with Print Extension"
echo "============================================="

# Stop existing containers
echo "1. Stopping existing containers..."
docker stop guacamole-with-print-extension-fixed 2>/dev/null || true
docker rm guacamole-with-print-extension-fixed 2>/dev/null || true

# Build new image with fixed Dockerfile
echo "2. Building new image with print extension..."
docker build -f Dockerfile.guacamole-fixed -t guacamole-with-print-extension:fixed .

# Start new container
echo "3. Starting new container..."
docker run -d \
  --name guacamole-with-print-extension-fixed \
  -p 8080:8080 \
  --link guacamole-db:guacamole-db \
  --link guacamole-server:guacamole-server \
  -e GUACD_HOSTNAME=guacamole-server \
  -e POSTGRESQL_HOSTNAME=guacamole-db \
  -e POSTGRESQL_DATABASE=guacamole_db \
  -e POSTGRESQL_USER=guacamole_user \
  -e POSTGRESQL_PASSWORD=guacamole_pass \
  guacamole-with-print-extension:fixed

echo ""
echo "4. Waiting for container to start..."
sleep 10

echo ""
echo "5. Verifying installation..."
./verify-print-extension.sh

echo ""
echo "🎉 Rebuild complete!"
echo "Access Guacamole at: http://localhost:8080/guacamole"
echo ""
echo "Expected results:"
echo "- You should see '🖨️ PRINT AGENT LOADED' badge in top-left corner"
echo "- Console should show: '🚀 Guacamole Print Agent: Initializing client-side JavaScript'"
echo "- When you download files, you should get print options modal"
