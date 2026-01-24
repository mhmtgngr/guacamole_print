# Development Work

This folder contains development files for the Guacamole Print Solution.

## Files

- `aggressive-intercept.js` - ZIP file repair feature with client-side corruption detection
- `Dockerfile` - Docker build configuration for development
- `docker-compose.yml` - Docker Compose configuration for development

## ZIP Repair Feature

The ZIP repair function in `aggressive-intercept.js` fixes corrupted ZIP files (XLSX, DOCX, PPTX) that occur when exported through Guacamole RDP:

1. Detects corrupted ZIP structure by validating End-of-Central-Directory (EOCD) record
2. Scans for local file headers (PK\x03\x04 signature)
3. Rebuilds central directory from detected file entries
4. Creates valid EOCD record at end of file
5. Automatically sends repaired files to local print agent

## Usage

```bash
# Build and run
docker-compose build
docker-compose up
```

## Branch

Work in this folder should be done on the `dev` branch.
