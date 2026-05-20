#!/bin/bash
# =========================================================================
# Proxmox VE Optimization & Diagnostic Checker
# =========================================================================
# This script runs on the Proxmox Host to verify that the optimizations,
# monitoring packages, and security settings are correctly active.
# =========================================================================

# Colors for modern terminal logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${CYAN}${BOLD}=================================================================${NC}"
echo -e "          PVE Host Optimization & Security Diagnostics           "
echo -e "${CYAN}${BOLD}=================================================================${NC}\n"

# 1. Check Root Access
if [ "$(id -u)" -ne 0 ]; then
    echo -e "${RED}[ERROR] This diagnostic script must be run as root.${NC}"
    exit 1
fi

# 2. Helper print function
print_status() {
    local label="$1"
    local status="$2"
    local info="$3"
    
    if [ "$status" = "OK" ]; then
        echo -e "${GREEN}[✔]${NC} ${BOLD}${label}${NC}: ${info}"
    elif [ "$status" = "WARN" ]; then
        echo -e "${YELLOW}[!]${NC} ${BOLD}${label}${NC}: ${info}"
    else
        echo -e "${RED}[✘]${NC} ${BOLD}${label}${NC}: ${info}"
    fi
}

# 3. Check Swappiness
SWAPPINESS=$(cat /proc/sys/vm/swappiness)
if [ "$SWAPPINESS" -le 15 ]; then
    print_status "Kernel Swappiness" "OK" "Configured to ${SWAPPINESS} (Optimal for hypervisor RAM stability)"
else
    print_status "Kernel Swappiness" "WARN" "Configured to ${SWAPPINESS} (Default 60 swaps aggressively, recommended: 10)"
fi

# 4. Check Fail2ban
if systemctl is-active fail2ban >/dev/null 2>&1; then
    JAIL_STATUS=$(fail2ban-client status sshd 2>/dev/null | grep "Banned IP list" | awk '{print $NF}' || echo "N/A")
    print_status "Fail2ban Service" "OK" "Active. SSH jail is running (banned list: ${JAIL_STATUS:-none})"
else
    print_status "Fail2ban Service" "FAIL" "Service is inactive. Host is unprotected from SSH brute-force."
fi

# 5. Check SSH Authorized Keys
if [ -f "/root/.ssh/authorized_keys" ] && [ -s "/root/.ssh/authorized_keys" ]; then
    KEY_COUNT=$(wc -l < /root/.ssh/authorized_keys)
    print_status "SSH Authorized Keys" "OK" "Found ${KEY_COUNT} public keys for root passwordless login."
else
    print_status "SSH Authorized Keys" "WARN" "No public keys found in /root/.ssh/authorized_keys."
fi

# 6. Check CPU Scaling Governor & Driver
GOVERNOR=$(cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor 2>/dev/null || echo "Unknown")
DRIVER=$(cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_driver 2>/dev/null || echo "Unknown")
if [ "$GOVERNOR" = "performance" ]; then
    print_status "CPU scaling" "OK" "Using '${DRIVER}' in '${GOVERNOR}' mode (lowest VM scheduling latency)"
else
    print_status "CPU scaling" "WARN" "Using '${DRIVER}' in '${GOVERNOR}' mode (recommended: performance)"
fi

# 7. Check SSD Trim Timer
if systemctl is-active fstrim.timer >/dev/null 2>&1; then
    NEXT_RUN=$(systemctl status fstrim.timer | grep -i "trigger" | xargs || echo "active")
    print_status "SSD Trim Schedule" "OK" "fstrim.timer is active weekly (${NEXT_RUN})"
else
    print_status "SSD Trim Schedule" "WARN" "fstrim.timer is inactive. SSDs may experience write slowdowns over time."
fi

# 8. Check IOMMU / Hardware Passthrough
if dmesg | grep -qE -i "dmar|iommu"; then
    print_status "PCI/GPU Passthrough" "OK" "IOMMU virtualization support enabled in BIOS & Kernel"
else
    print_status "PCI/GPU Passthrough" "WARN" "IOMMU not detected. Check vt-d/AMD-Vi settings in BIOS if GPU passthrough is needed."
fi

# 9. Check Packages
echo -e "\n${BOLD}Installed Diagnostics Packages:${NC}"
for pkg in htop btop iotop tmux lm-sensors nvme-cli git smartmontools; do
    if dpkg -s "$pkg" >/dev/null 2>&1; then
        echo -e "  ${GREEN}•${NC} ${pkg} (Installed)"
    else
        echo -e "  ${RED}•${NC} ${pkg} (Missing)"
    fi
done

echo -e "\n${CYAN}${BOLD}=================================================================${NC}"
