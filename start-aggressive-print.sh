#!/bin/bash
# Guacamole startup script with aggressive print interception

# Start Guacamole with original entrypoint in background
/opt/guacamole/bin/entrypoint.sh &
TOMCAT_PID=$!

# Wait for webapp to be deployed
echo "Waiting for Guacamole to deploy..."
sleep 15

# Find deployed webapp directory
for CATALINA_BASE in /tmp/catalina-base.*; do
  if [ -f "$CATALINA_BASE/webapps/guacamole/index.html" ]; then
    echo "Found Guacamole webapp at: $CATALINA_BASE/webapps/guacamole"

    # Copy aggressive interception script if it doesn't exist
    if [ ! -f "$CATALINA_BASE/webapps/guacamole/aggressive-intercept.js" ]; then
      cp /opt/guacamole/webapp/aggressive-intercept.js "$CATALINA_BASE/webapps/guacamole/"
      echo "✅ Aggressive interception script copied"
    else
      echo "ℹ️ Aggressive interception script already exists"
    fi

    break
  fi
done

# Wait for Tomcat process
wait $TOMCAT_PID
