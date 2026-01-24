#!/bin/bash
# Script to inject print agent JavaScript into Guacamole web interface

# Wait for Guacamole to start
sleep 10

# Create a custom entrypoint script that modifies the index.html
cat > /tmp/inject-print-agent.sh << 'EOF'
#!/bin/bash
# Inject print agent JavaScript into Guacamole index.html

GUACAMOLE_WAR="/opt/guacamole/webapp/guacamole.war"
WEBAPP_DIR="/opt/guacamole/tomcat/webapps/guacamole"

# Extract index.html from WAR
cd "$WEBAPP_DIR"
jar xf "$GUACAMOLE_WAR" index.html

# Backup original index.html
cp index.html index.html.backup

# Inject print agent script before the closing </body> tag
sed -i 's|</body>|<script src="/print-agent-client.js"></script></body>|' index.html

echo "✅ Print agent JavaScript injected into Guacamole"
EOF

chmod +x /tmp/inject-print-agent.sh
/tmp/inject-print-agent.sh
