#!/bin/sh
# Keep only the last 50 downloaded files, delete oldest
# Run via cron or systemd timer

DOWNLOAD_DIR="/tmp/guac-drive/Download"
MAX_FILES=50

# Ensure download directory exists
if [ ! -d "$DOWNLOAD_DIR" ]; then
    exit 0
fi

# Count files in download directory
FILE_COUNT=$(find "$DOWNLOAD_DIR" -type f 2>/dev/null | wc -l)

# If we exceed max files, delete oldest (sorted by modification time)
if [ "$FILE_COUNT" -gt "$MAX_FILES" ]; then
    DELETE_COUNT=$((FILE_COUNT - MAX_FILES))
    DELETED=$(find "$DOWNLOAD_DIR" -type f -printf '%T@ %p\n' 2>/dev/null | \
        sort -n | head -n "$DELETE_COUNT" | cut -d' ' -f2- | \
        xargs -r rm -f)
    echo "$(date) - Deleted $DELETE_COUNT old files (kept $MAX_FILES total)"
fi
