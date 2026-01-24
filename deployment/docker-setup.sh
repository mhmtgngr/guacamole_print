#!/bin/bash

# Guacamole Print Solution - Docker Deployment Script
# Sets up complete Guacamole environment with file transfer support

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_status() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Script header
echo "================================================"
echo "Guacamole Print Solution - Docker Setup"
echo "Version 1.0.0"
echo "================================================"
echo

# Check if Docker is installed
print_info "Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed or not in PATH"
    echo "Please install Docker from https://docs.docker.com/get-docker/"
    exit 1
fi
print_status "Docker is installed"

if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed or not in PATH"
    echo "Please install Docker Compose from https://docs.docker.com/compose/install/"
    exit 1
fi
print_status "Docker Compose is installed"

# Check if Docker is running
if ! docker info &> /dev/null; then
    print_error "Docker daemon is not running"
    echo "Please start Docker daemon"
    exit 1
fi
print_status "Docker daemon is running"

echo

# Set variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCKER_DIR="$PROJECT_ROOT/docker-guacamole"
USER_DOWNLOADS_DIR="$PROJECT_ROOT/user-downloads"
USER_RECORDINGS_DIR="$PROJECT_ROOT/user-recordings"
BACKUP_DIR="$PROJECT_ROOT/backups"

# Create necessary directories
print_info "Creating directory structure..."
mkdir -p "$USER_DOWNLOADS_DIR"
mkdir -p "$USER_RECORDINGS_DIR"
mkdir -p "$BACKUP_DIR"
print_status "Directory structure created"

# Generate SSL certificates
print_info "Generating SSL certificates..."
cd "$DOCKER_DIR"
if [ ! -f "nginx/ssl/guacamole.crt" ]; then
    chmod +x generate-ssl-certs.sh
    ./generate-ssl-certs.sh
    print_status "SSL certificates generated"
else
    print_warning "SSL certificates already exist, skipping generation"
fi

# Setup user directories
print_info "Setting up multi-user directories..."
chmod +x setup-multi-user.sh
./setup-multi-user.sh

# Create sample users if users.txt doesn't exist
if [ ! -f "../config/users.txt" ]; then
    print_info "Creating sample user configuration..."
    mkdir -p ../config
    cat > ../config/users.txt << EOF
# Guacamole Users Configuration
# Add one username per line
# Lines starting with # are ignored

# Sample users
demo1
demo2
demo3

# Add your users here:
# john.doe
# jane.smith
EOF
    print_status "Sample user configuration created"
fi

# Create environment file
print_info "Creating environment configuration..."
cat > .env << EOF
# Guacamole Print Solution Environment Configuration

# Database Configuration
POSTGRES_DB=guacamole_db
POSTGRES_USER=guacamole_user
POSTGRES_PASSWORD=guacamole_secure_password_$(date +%s)

# Guacamole Configuration
GUACD_LOG_LEVEL=info
GUACAMOLE_HOME=/etc/guacamole

# File Transfer Configuration
MAX_FILE_SIZE=52428800
USER_QUOTA_SIZE=524288000
SESSION_QUOTA_FILES=100
RETENTION_DAYS=7

# Performance Tuning
MAX_CONNECTIONS=100
CLEANUP_INTERVAL_MINUTES=60

# Security
ENABLE_RATE_LIMITING=true
MAX_REQUESTS_PER_MINUTE=60

# Logging
LOG_LEVEL=INFO
EOF
print_status "Environment configuration created"

echo

# Build and start services
print_info "Building and starting Docker services..."
docker-compose down --remove-orphans 2>/dev/null || true
docker-compose build --no-cache
docker-compose up -d

# Wait for services to be ready
print_info "Waiting for services to be ready..."
sleep 10

# Check service health
print_info "Checking service health..."

# Check database
if docker-compose exec -T guacamole-db pg_isready -U guacamole_user -d guacamole_db &>/dev/null; then
    print_status "Database is ready"
else
    print_error "Database is not responding"
    docker-compose logs guacamole-db
    exit 1
fi

# Check Guacamole server
if curl -f http://localhost:8080/guacamole &>/dev/null; then
    print_status "Guacamole server is ready"
else
    print_warning "Guacamole server may still be starting"
fi

# Check Nginx
if curl -f https://localhost/guacamole -k &>/dev/null; then
    print_status "Nginx proxy is ready"
else
    print_warning "Nginx proxy may still be starting"
fi

echo

# Display URLs and access information
echo "================================================"
echo "Installation Complete!"
echo "================================================"
echo
echo "Access URLs:"
echo "  HTTP:  http://localhost/guacamole"
echo "  HTTPS: https://localhost/guacamole"
echo "  Admin: http://localhost:8080/guacamole"
echo
echo "Default Login:"
echo "  Username: guacadmin"
echo "  Password: guacadmin"
echo "  (Change immediately after first login!)"
echo
echo "Services Status:"
docker-compose ps
echo
echo "Directory Structure:"
echo "  User Downloads: $USER_DOWNLOADS_DIR"
echo "  User Recordings: $USER_RECORDINGS_DIR"
echo "  Backups: $BACKUP_DIR"
echo "  Configuration: $DOCKER_DIR/.env"
echo
echo "Management Commands:"
echo "  View logs:       docker-compose logs -f [service]"
echo "  Restart:         docker-compose restart [service]"
echo "  Stop:            docker-compose down"
echo "  Update users:     ./setup-multi-user.sh"
echo "  Backup data:      ./backup-data.sh"
echo "  Monitor quotas:   ./scripts/monitor-user-quotas.sh"
echo
echo "File Transfer Configuration:"
echo "  Max File Size:   50MB per file"
echo "  User Quota:      500MB per user"
echo "  Session Files:    100 per session"
echo "  Retention:       7 days"
echo

# Create management scripts
print_info "Creating management scripts..."

# Backup script
cat > backup-data.sh << 'EOF'
#!/bin/bash

# Guacamole Print Solution - Data Backup Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_ROOT/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="guacamole_backup_$TIMESTAMP.tar.gz"

echo "Starting backup..."
mkdir -p "$BACKUP_DIR"

# Create backup
cd "$PROJECT_ROOT"
tar -czf "$BACKUP_DIR/$BACKUP_FILE" \
    user-downloads/ \
    user-recordings/ \
    docker-guacamole/.env \
    config/

echo "Backup completed: $BACKUP_DIR/$BACKUP_FILE"

# Cleanup old backups (keep last 7)
find "$BACKUP_DIR" -name "guacamole_backup_*.tar.gz" -type f -mtime +7 -delete

echo "Backup cleanup completed"
EOF

chmod +x backup-data.sh

# Monitoring script
cat > monitor-services.sh << 'EOF'
#!/bin/bash

# Guacamole Print Solution - Service Monitoring Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Guacamole Print Solution Service Status ==="
echo

# Check Docker containers
echo "Docker Containers:"
docker-compose ps
echo

# Check disk usage
echo "Disk Usage:"
du -sh user-downloads/ user-recordings/ backups/ 2>/dev/null || echo "No data directories found"
echo

# Check user quotas
if [ -f "scripts/monitor-user-quotas.sh" ]; then
    echo "User Quotas:"
    ./scripts/monitor-user-quotas.sh
    echo
fi

# Check system resources
echo "System Resources:"
echo "Memory: $(free -h | grep '^Mem:' | awk '{print $3"/"$2}')"
echo "Disk: $(df -h . | tail -1 | awk '{print $3"/"$2}')"
echo "Load: $(uptime | awk -F'load average:' '{print $2}' | sed 's/^ *//')"
echo
EOF

chmod +x monitor-services.sh

# Update script
cat > update-services.sh << 'EOF'
#!/bin/bash

# Guacamole Print Solution - Services Update Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Updating Guacamole Print Solution..."

# Backup current data
echo "Creating backup..."
./backup-data.sh

# Pull latest images
echo "Pulling latest Docker images..."
docker-compose pull

# Recreate services
echo "Updating services..."
docker-compose down
docker-compose up -d --force-recreate

echo "Update completed!"
echo "Please run './monitor-services.sh' to check status"
EOF

chmod +x update-services.sh

print_status "Management scripts created"

echo
echo "================================================"
echo "Next Steps:"
echo "================================================"
echo
echo "1. Install Local Print Agent on client machines:"
echo "   - Copy local-print-agent to Windows clients"
echo "   - Run: .\Scripts\install-service.ps1"
echo
echo "2. Install Browser Extension:"
echo "   - Open Chrome/Edge"
echo "   - Load extension from guacamole-extension/ folder"
echo
echo "3. Configure Users:"
echo "   - Edit config/users.txt with actual usernames"
echo "   - Run: ./setup-multi-user.sh"
echo
echo "4. Test File Transfer:"
echo "   - Log into Guacamole as test user"
echo "   - Print or download a file"
echo "   - Verify browser extension intercepts the action"
echo
echo "For troubleshooting, check:"
echo "  - Service logs: docker-compose logs [service-name]"
echo "  - User directories: ls -la user-downloads/"
echo "  - Monitoring script: ./monitor-services.sh"
echo
echo "Documentation: README.md"
echo "Support: https://github.com/guacamole-print-solution/issues"
echo