#!/bin/bash

echo "💉 Manually Injecting Print Extension into Running Container"
echo "=========================================================="

CONTAINER_NAME="guacamole-with-print-extension-fixed"

# Copy files to container
echo "1. Copying print agent files to container..."
docker cp guacamole-extension-module/src/main/resources/js/print-agent-client.js $CONTAINER_NAME:/home/guacamole/tomcat/webapps/guacamole/
docker cp guacamole-extension-module/src/main/resources/css/print-agent.css $CONTAINER_NAME:/home/guacamole/tomcat/webapps/guacamole/

# Set permissions
echo "2. Setting correct permissions..."
docker exec $CONTAINER_NAME chown guacamole:guacamole /home/guacamole/tomcat/webapps/guacamole/print-agent-client.js
docker exec $CONTAINER_NAME chown guacamole:guacamole /home/guacamole/tomcat/webapps/guacamole/print-agent.css

# Backup and modify index.html
echo "3. Modifying index.html to include print agent..."
docker exec $CONTAINER_NAME cp /home/guacamole/tomcat/webapps/guacamole/index.html /home/guacamole/tomcat/webapps/guacamole/index.html.backup

# Create new index.html with print agent
docker exec $CONTAINER_NAME sh -c 'sed "s|<script src=\"app.js?b=.*</script>|<script src=\"print-agent-client.js\"></script>\n<link rel=\"stylesheet\" href=\"print-agent.css\">\n&|" /home/guacamole/tomcat/webapps/guacamole/index.html.backup > /home/guacamole/tomcat/webapps/guacamole/index.html'

# Restart container to apply changes
echo "4. Restarting container to apply changes..."
docker restart $CONTAINER_NAME

echo ""
echo "5. Waiting for container to start..."
sleep 15

echo ""
echo "6. Verifying injection..."
./verify-print-extension.sh

echo ""
echo "✅ Manual injection complete!"
echo "Access Guacamole at: http://localhost:8080/guacamole"
