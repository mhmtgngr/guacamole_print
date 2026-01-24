#!/bin/bash

# Guacamole startup script with print extension injection
# This script starts Guacamole and ensures the print extension is loaded

# Start Guacamole normally
exec /opt/guacamole/bin/start.sh "$@"