# LearnFlow 🎓
An interactive, high-performance web-based learning and worksheet system designed specifically for schools. Optimized for touch-first iPad layouts, with seamless guest logins and optional Microsoft Teams Assignment integration.

## Features
- **5 Core Interactive Exercises**:
  - **Gap Filling**: Auto-scoring fill-in-the-blanks with typo tolerance.
  - **Drag-and-Drop**: Dual-mode drag-and-drop with tap-to-select fallbacks for iPad touch screens.
  - **Multiple & Single Choice**: Choice grids with clear correct/incorrect highlights.
  - **Matching / Connect**: SVG canvas rendering connection lines between items.
  - **Rich Media**: In-line audio widgets and expandable zoom lightboxes for images.
- **Teams Sync & SSO**: Login using Microsoft credentials and push grades directly into Teams assignments.
- **Guest / Code Login**: Fallback mode allowing students to join with an assignment code and name (no MSAL tenant required).
- **Auto-Save**: Automatic draft saving to SQLite database every 20 seconds.

---

## Folder Structure
```
learn/
├── backend/          # Node.js Express REST API
│   ├── db/           # Database initialization and seeding scripts
│   ├── routes/       # API endpoints (Auth, Worksheets, Submissions, Media, Teams)
│   └── server.js     # Server entry point
├── frontend/         # Vue 3 Single Page Application (Vite, HSL variables)
│   ├── src/
│   │   ├── components/  # Core exercise blocks (GapFill, Matching, etc.)
│   │   ├── views/       # Dashboard and worksheet builders/players
│   │   └── router/      # Vue Router config with JWT route guards
├── deployment/       # Production hosting scripts
│   ├── nginx.conf    # Nginx reverse proxy server block
│   ├── ecosystem.config.js # PM2 backend runner configuration
│   └── setup-lxc.sh  # Automated Proxmox LXC installer script
```

---

## 🚀 Local Development

### 1. Prerequisite Setup
Make sure you have Node.js 18+ and SQLite installed.

### 2. Configure Environment variables
Copy the `.env.example` in backend:
```bash
cp backend/.env.example backend/.env
```
Edit the `.env` file with your credentials and configuration.

### 3. Install & Start Backend
```bash
cd backend
npm install
node db/init.js
node db/seed.js
npm run dev # or node server.js
```
The backend server runs on `http://localhost:3001`.

### 4. Install & Start Frontend
```bash
cd ../frontend
npm install
npm run dev
```
The frontend dev server runs on `http://localhost:5173`.

---

## 🌐 Production Deployment (Proxmox VE LXC)

We provide an automated setup script that installs Node.js, PM2, SQLite3, Nginx, initializes the database, builds frontend production assets, and starts the system on a clean Debian/Ubuntu container.

### Step 1: Create a Proxmox LXC Container
1. Open your Proxmox VE Web UI.
2. Download a **Debian 12** or **Ubuntu 22.04/24.04** container template.
3. Click "Create CT":
   - **Hostname**: `learnflow`
   - **Password**: Secure password
   - **Template**: Choose the downloaded Debian/Ubuntu template
   - **Disk**: 8 GB+
   - **CPU**: 1 or 2 Cores
   - **Memory**: 1024 MB or 2048 MB RAM
   - **Network**: DHCP (bridged to your LAN)
4. Start the container and log in via the console or SSH as `root`.

### Step 2: Download & Run Installer
Inside the LXC container terminal:
```bash
# Clone the repository (replace with your git URL)
git clone https://github.com/learnflow/learn.git /var/www/learnflow
cd /var/www/learnflow

# Run the automated installation script
sudo bash deployment/setup-lxc.sh
```

### Step 3: Configure Domain and Azure Credentials
If you are linking Microsoft Teams, update `/var/www/learnflow/backend/.env` with your Azure credentials:
```env
MS_CLIENT_ID=your-client-id
MS_CLIENT_SECRET=your-client-secret
MS_TENANT_ID=your-school-tenant-id
BASE_URL=https://learnflow.your-school.edu
```
Then restart the backend using PM2:
```bash
pm2 restart learnflow-backend
```

---

## 🧪 Testing the Seeded Demo
A sample English worksheet containing all 5 exercise types is pre-seeded with code **`5a1b-c3d4`**.
- Go to `http://<lxc-container-ip>`
- Choose the **Guest/Code Login**
- Enter Name: **Marie Meier**
- Enter Assignment Code: **5a1b-c3d4**
- Click **Start Assignment** to play, auto-save, and grade the interactive worksheet!
