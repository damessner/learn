# Proxmox VE 8/9 Notifications Configuration Guide

Proxmox VE 8.1+ features a built-in notification system that allows sending alerts (for backup jobs, replication, high disk usage, SMART failures, etc.) to external targets.

You can configure these notifications directly via the Web GUI or by editing `/etc/pve/notifications.cfg` on the Proxmox host.

---

## Method 1: Web GUI Configuration (Recommended)

1. Log into your Proxmox Web GUI at `https://172.16.1.54:8006`.
2. Navigate to **Datacenter** (in the left-hand menu) → **Notifications**.
3. Under **Notification Targets**, click **Add** and select your target type (SMTP, Gotify, Sendmail).

---

## Method 2: Command Line Configuration (via `/etc/pve/notifications.cfg`)

Below are config templates you can append to `/etc/pve/notifications.cfg` using SSH.

### 1. SMTP Email Alerts (using a custom SMTP relay)
Add the following to `/etc/pve/notifications.cfg`:
```ini
smtp: email-alert
    server smtp.example.com
    port 587
    mode starttls
    username pve-alerts@example.com
    password YOUR_SMTP_PASSWORD
    from-address pve-alerts@example.com
    mailto root@localhost
    comment Send alerts via SMTP relay
```

### 2. Gotify (Self-hosted push notifications)
If you have a Gotify instance running on your network:
```ini
gotify: gotify-alert
    server http://your-gotify-ip:port
    token YOUR_GOTIFY_APP_TOKEN
    comment Send alerts to Gotify push server
```

### 3. Pushover (Mobile push notifications)
```ini
pushover: pushover-alert
    user YOUR_USER_KEY
    token YOUR_APP_TOKEN
    comment Send alerts to Pushover mobile app
```

---

## Routing Notifications to Targets

After creating a target (e.g., `email-alert`), you must map it to a **Matcher** to determine which events get sent.

By default, Proxmox has a matcher named `default-matcher` that routes alerts to the local root mail target (`mail-to-root`). You can modify it or add a new matcher:

```ini
matcher: default-matcher
    target email-alert
    min-severity warning
```
This ensures that any alert of `warning` severity or higher is immediately forwarded to your configured target.

To test your notification targets, run:
```bash
proxmox-chroot-tool notification test <target-name>
```
*(or click the **Test** button in the Web GUI)*.
