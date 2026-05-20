#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

# Colors for log output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================================${NC}"
echo -e "${GREEN}    LearnFlow Proxmox LXC Automated Setup Script    ${NC}"
echo -e "${BLUE}====================================================${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: Please run this script as root (sudo bash setup-lxc.sh).${NC}"
  exit 1
fi

# Detect system distribution
if [ -f /etc/debian_version ]; then
  echo -e "${BLUE}[1/7] Updating system package repositories...${NC}"
  apt-get update -y
  apt-get install -y curl git build-essential sqlite3 nginx
else
  echo -e "${RED}Error: This script is designed for Debian/Ubuntu-based LXC containers.${NC}"
  exit 1
fi

# Install Node.js (Version 22 LTS)
echo -e "${BLUE}[2/7] Installing Node.js 22 LTS...${NC}"
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# Verify installations
NODE_VER=$(node -v)
NPM_VER=$(npm -v)
echo -e "${GREEN}✓ Node.js installed: $NODE_VER${NC}"
echo -e "${GREEN}✓ npm installed: $NPM_VER${NC}"

# Install PM2 globally
echo -e "${BLUE}[3/7] Installing PM2 process manager...${NC}"
npm install -g pm2

# Setup Application Directory
echo -e "${BLUE}[4/7] Setting up application files at /var/www/learnflow...${NC}"
mkdir -p /var/www/learnflow

# Determine script directory to copy assets
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Copy project files (backend, frontend, db, deployment) to /var/www/learnflow
cp -r "$PROJECT_ROOT/backend" /var/www/learnflow/
cp -r "$PROJECT_ROOT/frontend" /var/www/learnflow/
cp -r "$PROJECT_ROOT/deployment" /var/www/learnflow/
mkdir -p /var/www/learnflow/db
mkdir -p /var/www/learnflow/backend/uploads

# Set correct ownership
chown -R www-data:www-data /var/www/learnflow

# Setup Backend
echo -e "${BLUE}[5/7] Installing backend dependencies & initializing database...${NC}"
cd /var/www/learnflow/backend

# Create .env from .env.example if it doesn't exist
if [ ! -f .env ]; then
  echo -e "${BLUE}Generating backend .env configuration...${NC}"
  cp .env.example .env
  
  # Generate secure random JWT_SECRET
  SECURE_JWT=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  sed -i "s/JWT_SECRET=change_this_to_a_long_random_string_minimum_32_chars/JWT_SECRET=$SECURE_JWT/" .env
  
  # Detect container IP to set BASE_URL
  IP_ADDR=$(ip -4 addr show eth0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -n 1 || echo "localhost")
  sed -i "s|BASE_URL=https://your-school-server.com|BASE_URL=http://$IP_ADDR|" .env
  
  chown www-data:www-data .env
  echo -e "${GREEN}✓ Generated secure .env file with container IP ($IP_ADDR) and random JWT_SECRET.${NC}"
fi

# Install production dependencies (avoiding devDependencies)
npm install --production --unsafe-perm

# Initialize Database & Seed Demo Data
echo -e "${BLUE}Initializing SQLite database...${NC}"
node db/init.js
node db/seed.js

# Setup Frontend
echo -e "${BLUE}[6/7] Installing frontend dependencies & building static assets...${NC}"
cd /var/www/learnflow/frontend
npm install
npm run build

# Configure Nginx
echo -e "${BLUE}[7/7] Configuring Nginx reverse proxy...${NC}"
# Copy configuration
cp /var/www/learnflow/deployment/nginx.conf /etc/nginx/sites-available/learnflow
# Enable site
ln -sf /etc/nginx/sites-available/learnflow /etc/nginx/sites-enabled/learnflow
# Disable default site if it exists to avoid port conflicts
rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
nginx -t
systemctl restart nginx
echo -e "${GREEN}✓ Nginx configured and restarted successfully.${NC}"

# Start Backend Service via PM2
echo -e "${BLUE}Starting backend service with PM2...${NC}"
cd /var/www/learnflow
pm2 start deployment/ecosystem.config.js

# Configure PM2 to start on boot
echo -e "${BLUE}Configuring PM2 startup script...${NC}"
pm2 startup systemd -u root --hp /root
pm2 save

echo -e "${BLUE}====================================================${NC}"
echo -e "${GREEN}🎉 LearnFlow Installation Complete!${NC}"
echo -e "${BLUE}====================================================${NC}"
echo -e "You can now access your server at: ${YELLOW}http://<your-lxc-ip>${NC}"
echo -e "Demo accounts created:"
echo -e "  - Teacher: ${YELLOW}teacher@school.local${NC} (Guest bypass or MS login)"
echo -e "  - Guest Assignment Code: ${YELLOW}5a1b-c3d4${NC} (Student: Marie Meier)"
echo -e "${BLUE}====================================================${NC}"
