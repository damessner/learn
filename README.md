# LearnFlow 🎓
An interactive, high-performance web-based learning and worksheet system designed specifically for schools. Optimized for touch-first iPad layouts, with seamless guest logins and optional Microsoft Teams Assignment integration.

## Features
- **6 Core Interactive Exercises**:
  - **Vocabulary & Writing**: Text list editor (paste or file import) with autocorrect, autocapitalize, autocomplete and spellcheck disabled. Students work through a dynamic practice loop (re-queueing mistakes) and can download a certificate detailing time spent, words learned, and the 5 most difficult words.
  - **Gap Filling**: Auto-scoring fill-in-the-blanks with typo tolerance.
  - **Drag-and-Drop**: Dual-mode drag-and-drop with tap-to-select fallbacks for iPad touch screens.
  - **Multiple & Single Choice**: Choice grids with clear correct/incorrect highlights.
  - **Matching / Connect**: SVG canvas rendering connection lines between items.
  - **Rich Media**: In-line audio widgets and expandable zoom lightboxes for images.
- **Authentication Flexibility**: Choice of Local Credentials (username/password) or Microsoft Entra ID (SSO) login.
- **Admin Dashboard Settings**: Full User Account Roster (register, edit, change password, delete), real-time authentication mode selection, and **AI Generation Integrations** to dynamically configure local LLM settings.
- **Teams Sync**: Push grades directly into Microsoft Teams assignments.
- **Guest / Code Login**: Fallback mode allowing students to join with an assignment code and name (no MSAL tenant required).
- **Auto-Save**: Automatic draft saving to SQLite database every 20 seconds.
- **AI Worksheet Drafting**: Generate compact worksheet JSON drafts in the builder via **Gemini API** or **Ollama** (Ollama URL and model name are configurable via Settings in the Admin UI).
- **Worksheet Preview Mode**: Reuses the interactive player components allowing teachers to solve and preview worksheet scoring dynamically without database submissions.
- **Structured Courses (Option B)**: Teachers can group worksheets into sequential courses and assign them to classes. Students proceed through worksheets in order, with subsequent assignments remaining locked until pre-requisite worksheets are completed.

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
│   ├── setup-lxc.sh  # Automated Proxmox LXC installer script
│   └── create-lxc.sh # Direct Proxmox host container creator script
└── README.md


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

If you want AI worksheet generation in the teacher builder, set at least one provider:
```env
# Gemini
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-2.5-flash

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
```

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

We provide three deployment options for hosting LearnFlow on your Proxmox VE hypervisor (`https://172.16.1.54:8006`).

### Option A: Automated SSH-Based Local Deployment (Recommended)
If you have configured local SSH access to your Proxmox server (`pve`), you can deploy LearnFlow directly from your development machine.

1. Configure your local SSH client for Proxmox using our PowerShell setup script:
   ```powershell
   powershell -File pve/setup_ssh.ps1
   ```
   *Note: This maps `ssh pve` directly to `root@172.16.1.54` using your Proxmox private key.*

2. Run the automated deployment script from your workstation:
   - This creates a lightweight archive `learnflow.tar.gz`.
   - Transfers the archive to Proxmox `/tmp`.
   - Automates the container creation (CT `100`), system packages install, file extraction, static builds, and Nginx reverse proxy configuration.
   
   To run this on the Proxmox host:
   ```bash
   scp learnflow.tar.gz pve:/tmp/learnflow.tar.gz
   scp pve/deploy_lxc.sh pve:/tmp/deploy_lxc.sh
   ssh pve "bash /tmp/deploy_lxc.sh"
   ```

---

### Option B: Direct Proxmox Hypervisor Script (Recommended for Clean Installs)
This script is run directly on your Proxmox VE host node. It automates template updates, downloads Debian 12 standard, prompts you for container details, builds the network bridge, clones the repo, and runs the entire setup inside the LXC.

1. SSH into your Proxmox VE host (as root).
2. Run the one-liner command:
   ```bash
   bash -c "$(curl -sSL -H "Cache-Control: no-cache" https://raw.githubusercontent.com/damessner/learn/main/deployment/create-lxc.sh)"
   ```
3. Follow the prompts (or press `Enter` to accept the defaults). The script will:
   - Check if the chosen Container ID exists and prompt you if it needs to be recreated.
   - Set the default container root login password to **`LearnFlow`**.
   - Automatically configure a secure random 32-byte hex `JWT_SECRET`.
   - Automatically discover the container IP and bind it to the `BASE_URL` env variable.
   - Output the LAN IP address once complete.

---

### Option C: Manual LXC Container Creation
If you prefer to configure your LXC container manually:

1. Open your Proxmox VE Web UI.
2. Download a **Debian 12** container template.
3. Click "Create CT":
   - **Hostname**: `learnflow`
   - **Template**: Choose the downloaded Debian template
   - **Disk**: 8 GB+
   - **CPU**: 2 Cores
   - **Memory**: 1024 MB RAM
   - **Network**: DHCP (bridged to your LAN)
4. Start the container, log in via console as `root`, and run:
   ```bash
   git clone https://github.com/damessner/learn.git /opt/learnflow
   cd /opt/learnflow
   sudo bash deployment/setup-lxc.sh
   ```
   *(Note: The setup script will automatically handle `.env` creation, dynamic LAN IP binding, Node.js installation, Nginx site config, and PM2 background manager setup.)*

---

### 🔄 Updating LearnFlow in the LXC Container

If you already have LearnFlow running inside a container, you can update it to the latest version.

#### Option 1: From the Proxmox Host Node (Recommended)
You can run this command directly from your Proxmox VE hypervisor host to update container `100` (replace `100` with your actual Container ID):
```bash
pct exec 100 -- bash -c "cd /opt/learnflow && git pull && bash deployment/setup-lxc.sh"
```

#### Option 2: From Inside the LXC Container Console
If you are logged into the container console as `root`, run:
```bash
cd /opt/learnflow
git pull
bash deployment/setup-lxc.sh
```

*(Note: The update script preserves your SQLite database, custom uploaded student files, and environment configuration in `/var/www/learnflow/backend/.env` while rebuilding the frontend bundle and restarting the PM2 service.)*

---


## 🏆 Microsoft Entra ID & Teams Integration Setup
To enable Microsoft Teams Assignment sync and SSO, a school Microsoft Entra ID (Azure AD) Tenant Administrator must register the application.

### Step 1: Register the Application
1. Sign in to the [Microsoft Entra Admin Center](https://entra.microsoft.com) as an Administrator.
2. Navigate to **Identity** > **Applications** > **App registrations** > **New registration**.
3. Configure settings:
   - **Name**: `LearnFlow`
   - **Supported account types**: "Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant)"
   - **Redirect URI**: Select **Single-page application (SPA)** and add your client redirect URL:
     - Production: `https://<your-domain>/login`
     - Development: `http://localhost:5173/login`
4. Click **Register**.

### Step 2: Request API Permissions
The backend service accesses Microsoft Graph using client credentials.
1. In your registered app, go to **API permissions** > **Add a permission** > **Microsoft Graph**.
2. Select **Application permissions** (not Delegated).
3. Check the following permissions:
   - `EducationAssignments.ReadWrite.All` - Allows LearnFlow to create, update, and publish assignments in Teams classes.
   - `EducationClasses.Read.All` - Allows teachers to select and link their Teams classes.
   - `User.Read.All` - Matches student submissions to Entra user profiles by email/MSID.
4. Click **Add permissions**.
5. Click **Grant admin consent for <your-organization>** and approve the prompt.

### Step 3: Create a Client Secret
1. Go to **Certificates & secrets** > **Client secrets** > **New client secret**.
2. Add a description, set an expiration period, and click **Add**.
3. **Important**: Copy the Secret **Value** (not ID) immediately. It will be hidden permanently once you reload the page.

### Step 4: Configure LearnFlow Environmental Variables
Open `/var/www/learnflow/backend/.env` (or `/opt/learnflow/backend/.env`) in the LXC container:
```env
MS_CLIENT_ID=your-application-client-id
MS_CLIENT_SECRET=your-copied-client-secret-value
MS_TENANT_ID=your-directory-tenant-id
BASE_URL=http://<your-lxc-container-ip> # or https://learnflow.your-school.edu
```
Save the file and restart PM2 inside the container:
```bash
pm2 restart learnflow-backend
```


---

## 🧪 Testing the Seeded Demo
LearnFlow comes pre-seeded with admin credentials and a sample student assignment:

### 1. Teacher & Admin Dashboard
- **URL**: `http://<lxc-container-ip>/login` (or select "Teacher Portal")
- **Username**: `admin`
- **Password**: `admin123`
- *Note: Log in with these credentials to explore the new **User accounts roster** and switch authentication settings between local credentials and Microsoft SSO.*

### 2. Interactive Student Worksheet
- **URL**: `http://<lxc-container-ip>`
- Choose the **Guest/Code Login**
- Enter Name: **Marie Meier**
- Enter Assignment Code: **5a1b-c3d4**
- Click **Start Assignment** to practice, auto-save drafts, and review grade scoring!
