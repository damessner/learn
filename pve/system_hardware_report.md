# Proxmox Host System & Hardware Configuration Report

This report summarizes the hardware characteristics and the active performance and security optimizations on the Proxmox VE host (`mint-weissenbach`).

---

## 1. Hardware Summary
* **Host Name**: `mint-weissenbach`
* **PVE Version**: `pve-manager/9.1.1`
* **Kernel version**: `6.17.2-1-pve`
* **Processor (CPU)**: AMD processor with 16 logical cores
* **Root Storage**: 94 GB ext4 volume group on LVM (`/dev/mapper/pve-root`), 7% disk space usage (84 GB free).

---

## 2. Active System Optimizations

### ⚡ CPU Governor & Latency Management
* **Driver**: `amd-pstate-epp`
* **Governor**: `performance`
* **Impact**: The processor is configured to stay in high-frequency, low-latency states. This eliminates scheduling latency when VMs and LXC containers demand sudden CPU cycles, providing maximum responsiveness.

### 🧠 Swappiness Tuning
* **Setting**: `vm.swappiness=10` (located in `/etc/sysctl.d/99-pve.conf`)
* **Impact**: The default Linux swappiness is `60`, which forces active RAM pages to swap to disk too early. Reducing it to `10` ensures that RAM is fully utilized and prevents premature disk writes, improving container disk-I/O overhead.

### 🧹 SSD Maintenance (Trim/Discard)
* **Status**: `fstrim.timer` is enabled and active.
* **Impact**: Discards unused blocks on the SSD once a week. This maintains high write performance on the storage pool and extends the lifespan of the underlying flash memory.

### 🖥️ PCI/GPU Passthrough (IOMMU)
* **Status**: IOMMU virtualization is active (`AMD-Vi: IOMMU performance counters supported`).
* **Impact**: Host PCIe devices (such as graphics cards, network interface controllers, or NVMe disks) can be assigned directly to virtual machines with native, bare-metal performance.

---

## 3. Implemented Security Controls

### 🔑 SSH Key-Based Authentication
* **Status**: Generated an **ED25519** SSH keypair.
  * Public key is appended to `/root/.ssh/authorized_keys` on Proxmox.
  * Private key is stored locally in the workspace folder (`id_ed25519`) and excluded from Git commits via `.gitignore`.
* **Impact**: Allows secure, passwordless SSH command execution, preventing credential leakage in logs or scripts.

### 🛡️ Brute-Force Defense (`fail2ban`)
* **Status**: Installed and active. Configured the `sshd` jail in `/etc/fail2ban/jail.local` utilizing the `systemd` logging backend.
* **Impact**: Automatically blocks any IP address that attempts multiple failed SSH logins within a 10-minute window, neutralizing brute-force dictionary attacks.
