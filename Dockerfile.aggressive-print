FROM guacamole/guacamole:latest

# Switch to root for modifications
USER root

# Copy aggressive print interception JavaScript
COPY guacamole-extension-module/src/main/resources/js/aggressive-intercept.js /tmp/aggressive-intercept.js

# Inject aggressive print interception script into WAR file
RUN cd /tmp && \
    mkdir -p war-extract && \
    cd war-extract && \
    jar xf /opt/guacamole/webapp/guacamole.war index.html && \
    sed -i 's|</body>|<script src="aggressive-intercept.js"></script></body>|' index.html && \
    jar uf /opt/guacamole/webapp/guacamole.war index.html && \
    rm -f index.html && \
    cd .. && \
    rm -rf war-extract && \
    mv /tmp/aggressive-intercept.js /opt/guacamole/webapp/

# Copy startup script
COPY start-aggressive-print.sh /opt/guacamole/start-aggressive-print.sh

RUN chmod +x /opt/guacamole/start-aggressive-print.sh

# Switch back to guacamole user
USER guacamole

# Set custom entrypoint
ENTRYPOINT ["/opt/guacamole/start-aggressive-print.sh"]

# Expose port 8080
EXPOSE 8080
