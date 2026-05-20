#!/usr/bin/env bash
set -e

echo "=== STARTING LEARNFLOW LXC DEPLOYMENT ON PROXMOX ==="

CTID=100
HOSTNAME="learnflow"
TEMPLATE_FILE="debian-12-standard_12.2-1_amd64.tar.zst"
TEMPLATE_PATH="/var/lib/vz/template/cache/${TEMPLATE_FILE}"
STORAGE="local-lvm"
BRIDGE="vmbr0"

# 1. Update templates and check if template exists
echo "Checking LXC template..."
pveam update || true
if [ ! -f "$TEMPLATE_PATH" ]; then
    echo "Downloading Debian 12 template..."
    pveam download local "$TEMPLATE_FILE"
fi

# 2. Check if container 100 already exists
if pct status "$CTID" >/dev/null 2>&1; then
    echo "Container $CTID already exists. Stopping and destroying it to ensure clean redeployment..."
    pct stop "$CTID" || true
    pct destroy "$CTID"
fi

# 3. Create LXC container
echo "Creating LXC container $CTID..."
pct create "$CTID" "local:vztmpl/${TEMPLATE_FILE}" \
  -cores 2 \
  -memory 1024 \
  -swap 512 \
  -status \
  -storage "$STORAGE" \
  -ostype debian \
  -hostname "$HOSTNAME" \
  -net0 "name=eth0,bridge=$BRIDGE,ip=dhcp" \
  -onboot 1 \
  -unprivileged 1 \
  -features nesting=1

# 4. Start LXC container
echo "Starting container $CTID..."
pct start "$CTID"

echo "Waiting 12 seconds for network configuration inside container..."
sleep 12

# 5. Install prerequisites
echo "Installing prerequisites inside container..."
pct exec "$CTID" -- apt-get update -y
pct exec "$CTID" -- apt-get install -y git tar curl build-essential sqlite3 nginx

# 6. Push local files archive and extract it
echo "Extracting project archive..."
pct exec "$CTID" -- mkdir -p /opt/learnflow
pct push "$CTID" /tmp/learnflow.tar.gz /opt/learnflow/learnflow.tar.gz
pct exec "$CTID" -- tar -xzf /opt/learnflow/learnflow.tar.gz -C /opt/learnflow
pct exec "$CTID" -- rm -f /opt/learnflow/learnflow.tar.gz

# 7. Run setup-lxc.sh
echo "Running setup-lxc.sh inside container..."
pct exec "$CTID" -- bash /opt/learnflow/deployment/setup-lxc.sh

# 8. Get container IP
IP_ADDR=$(pct exec "$CTID" -- ip -4 addr show eth0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -n 1 || true)
echo "===================================================="
echo "🎉 DEPLOYMENT COMPLETE!"
echo "LearnFlow is running at: http://${IP_ADDR}"
echo "===================================================="
