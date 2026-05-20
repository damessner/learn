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
echo -e "${GREEN}      LearnFlow Proxmox VE LXC Creation Helper      ${NC}"
echo -e "${BLUE}====================================================${NC}"

# Check if running on a Proxmox VE host
if [ ! -d "/etc/pve" ]; then
  echo -e "${RED}Error: This script must be run directly on the Proxmox VE hypervisor host.${NC}"
  echo -e "Please SSH into your Proxmox server (e.g. https://172.16.1.54:8006 under Shell) and run this script there."
  exit 1
fi

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: Please run this script as root.${NC}"
  exit 1
fi

# 1. Determine next available VM/CT ID
NEXT_ID=$(pvesh get /cluster/nextid)
read -p "Enter Container ID [Default: $NEXT_ID]: " CTID
CTID=${CTID:-$NEXT_ID}

# Check if container already exists
if pct status "$CTID" >/dev/null 2>&1; then
  echo -e "${YELLOW}Warning: Container $CTID already exists.${NC}"
  read -p "Do you want to stop and destroy container $CTID first? [y/N]: " CONFIRM_DESTROY
  if [[ "$CONFIRM_DESTROY" =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Stopping and destroying container $CTID...${NC}"
    pct stop "$CTID" || true
    pct destroy "$CTID"
  else
    echo -e "${RED}Error: Container $CTID already exists. Deployment aborted.${NC}"
    exit 1
  fi
fi

# 2. Hostname
read -p "Enter Hostname [Default: learnflow]: " HOSTNAME
HOSTNAME=${HOSTNAME:-learnflow}

# 3. Target Storage for Container Disk
echo -e "${BLUE}Scanning available storage pools...${NC}"
pvesm status
read -p "Enter Target Storage Pool (for disk volume) [Default: local-lvm]: " STORAGE
STORAGE=${STORAGE:-local-lvm}

# 4. Network Bridge
read -p "Enter Network Bridge [Default: vmbr0]: " BRIDGE
BRIDGE=${BRIDGE:-vmbr0}

# 5. IP Settings
read -p "Enter IP Settings (e.g. dhcp or 192.168.1.50/24) [Default: dhcp]: " IP_CFG
IP_CFG=${IP_CFG:-dhcp}

# 6. Gateway (optional, only needed if static IP)
GATEWAY=""
if [ "$IP_CFG" != "dhcp" ]; then
  read -p "Enter Gateway IP: " GATEWAY
fi

# 7. Check / Download template
TEMPLATE_STORAGE="local"
TEMPLATE_FILE="debian-12-standard_12.2-1_amd64.tar.zst"
TEMPLATE_PATH="/var/lib/vz/template/cache/${TEMPLATE_FILE}"

echo -e "${BLUE}Updating Proxmox template database...${NC}"
pveam update || true

if [ ! -f "$TEMPLATE_PATH" ]; then
  echo -e "${BLUE}Downloading Debian 12 standard LXC template...${NC}"
  pveam download "$TEMPLATE_STORAGE" "$TEMPLATE_FILE"
fi

# 8. Create the LXC Container
echo -e "${BLUE}Creating LXC container $CTID ($HOSTNAME)...${NC}"
NET_CFG="name=eth0,bridge=$BRIDGE,ip=$IP_CFG"
if [ -n "$GATEWAY" ]; then
  NET_CFG="$NET_CFG,gw=$GATEWAY"
fi

pct create "$CTID" "${TEMPLATE_STORAGE}:vztmpl/${TEMPLATE_FILE}" \
  -cores 2 \
  -memory 1024 \
  -swap 512 \
  -status \
  -storage "$STORAGE" \
  -ostype debian \
  -hostname "$HOSTNAME" \
  -net0 "$NET_CFG" \
  -onboot 1 \
  -unprivileged 1 \
  -features nesting=1

echo -e "${GREEN}✓ Container $CTID created successfully.${NC}"

# 9. Start Container
echo -e "${BLUE}Starting container $CTID...${NC}"
pct start "$CTID"

echo -e "${BLUE}Waiting 12 seconds for network configuration inside container...${NC}"
sleep 12

# 10. Clone and run installation inside the container
echo -e "${BLUE}Installing Git inside the container...${NC}"
pct exec "$CTID" -- apt-get update -y
pct exec "$CTID" -- apt-get install -y git

echo -e "${BLUE}Cloning LearnFlow repository inside the container...${NC}"
pct exec "$CTID" -- rm -rf /opt/learnflow
pct exec "$CTID" -- git clone https://github.com/damessner/learn.git /opt/learnflow

echo -e "${BLUE}Running automated LXC setup script...${NC}"
pct exec "$CTID" -- bash /opt/learnflow/deployment/setup-lxc.sh

# 11. Retrieve Container IP
IP_ADDR=$(pct exec "$CTID" -- ip -4 addr show eth0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -n 1 || true)
if [ -z "$IP_ADDR" ]; then
  IP_ADDR="<container-ip>"
fi

echo -e "${BLUE}====================================================${NC}"
echo -e "${GREEN}🎉 LearnFlow Proxmox VE Deployment Complete!${NC}"
echo -e "${BLUE}====================================================${NC}"
echo -e "You can access your LearnFlow instance at: ${YELLOW}http://${IP_ADDR}${NC}"
echo -e "Manage the container with Proxmox commands on the host:"
echo -e "  - Console access:   ${YELLOW}pct enter $CTID${NC}"
echo -e "  - Stop container:   ${YELLOW}pct stop $CTID${NC}"
echo -e "  - Start container:  ${YELLOW}pct start $CTID${NC}"
echo -e "===================================================="
