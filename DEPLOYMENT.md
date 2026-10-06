# Photopodra Permanent Central Server Deployment Guide 🚀

This guide provides end-to-end instructions for deploying Photopodra as a permanent, always-on central photo server accessible securely from anywhere in the world on iOS, Android, macOS, and Windows.

---

## Architecture Overview

```
                      ┌───────────────────────────────────────┐
                      │  Remote Clients (iOS, Android, etc.)   │
                      └──────────────────┬────────────────────┘
                                         │
                                         ▼ HTTPS
                      ┌───────────────────────────────────────┐
                      │    Cloudflare Edge Anycast Network    │
                      │     (Free SSL, DDoS protection)       │
                      └──────────────────┬────────────────────┘
                                         │
                              Encrypted Tunnel (No open ports)
                                         │
                                         ▼
                      ┌───────────────────────────────────────┐
                      │    Host Server (cloudflared daemon)   │
                      │                   │                   │
                      │                   ▼ http://localhost  │
                      │   Photopodra Backend (Port 3001)      │
                      │   - Express API & Frontend SPA        │
                      │   - Sharp 256/1024 WebP Thumbnails    │
                      │   - Local CLIP AI Vector Search       │
                      │   - SQLite (photos.db + embeddings)   │
                      └───────────────────────────────────────┘
```

---

## Option 1: Docker Compose Deployment (Recommended)

Docker provides an isolated, reproducible environment bundled with all C++ native dependencies (`better-sqlite3`, `sharp`, `libvips`) and pre-cached CLIP ONNX models.

### Prerequisites
- Docker Engine & Docker Compose v2 ([docs.docker.com](https://docs.docker.com/engine/install/))

### Steps

1. **Verify or Edit `docker-compose.yml`**:
   The provided `docker-compose.yml` configures persistent volume mounts for your photos, database, and thumbnails:
   ```yaml
   services:
     photopodra:
       build:
         context: .
         dockerfile: Dockerfile
       image: photopodra:latest
       container_name: photopodra-server
       restart: unless-stopped
       ports:
         - "3001:3001"
       environment:
         - NODE_ENV=production
         - PORT=3001
         - MEDIA_DIR=/app/media
         - DATA_DIR=/app/data
         - THUMBNAILS_DIR=/app/thumbnails
         - DB_PATH=/app/data/photos.db
         - ALLOWED_ORIGINS=*
       volumes:
         - ./media:/app/media
         - ./data:/app/data
         - ./thumbnails:/app/thumbnails
   ```

2. **Build and Launch the Container**:
   ```bash
   docker compose up -d --build
   ```

3. **Check Container Status and Logs**:
   ```bash
   # Check running status & health
   docker compose ps

   # View server logs in real-time
   docker compose logs -f photopodra
   ```

4. **Verify Health Check**:
   ```bash
   curl http://localhost:3001/api/health
   # Returns: {"status":"ok","service":"photopodra-backend",...}
   ```

---

## Option 2: Linux Native Deployment with Systemd

For bare-metal Linux servers, Raspberry Pis, or VPS instances (Ubuntu/Debian/Fedora).

### 1. Build Production Frontend
From the Photopodra root directory:
```bash
npm run build:frontend
```

### 2. Configure Systemd Service
The repository includes a ready-to-use systemd unit file at [`photopodra.service`](./photopodra.service).

Copy it to the systemd directory:
```bash
sudo cp photopodra.service /etc/systemd/system/photopodra.service
```

If your project is not installed in `/opt/photopodra`, edit the unit file to point to your actual path and user:
```ini
[Service]
User=your_username
Group=your_username
WorkingDirectory=/home/your_username/Photopodra
ExecStart=/usr/bin/node backend/src/index.js
```

### 3. Enable and Start on Boot
```bash
# Reload systemd daemon
sudo systemctl daemon-reload

# Enable service to start on every boot
sudo systemctl enable photopodra

# Start service immediately
sudo systemctl start photopodra

# Check status
sudo systemctl status photopodra

# Stream logs
sudo journalctl -u photopodra -f
```

---

## Option 3: Windows Native Deployment with PM2

For running Photopodra as a permanent background service on a Windows host or Home Media PC.

### 1. Build Production Frontend
In PowerShell or Command Prompt:
```powershell
npm run build:frontend
```

### 2. Run the Automated Setup Script
Run the automated script as **Administrator**:
- **Batch script**: Right-click `deploy/setup-windows-pm2.bat` and click **Run as administrator**.
- **PowerShell**:
  ```powershell
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
  .\deploy\setup-windows-pm2.ps1
  ```

### 3. Manual Steps (if preferred)
```powershell
# 1. Install PM2 and Windows startup helper globally
npm install -g pm2 pm2-windows-startup

# 2. Register startup handler in Windows Registry
pm2-startup install

# 3. Start Photopodra using the ecosystem config
pm2 start ecosystem.config.cjs

# 4. Save state so PM2 resurrects the server after Windows reboots
pm2 save
```

### Management Commands:
```powershell
pm2 status photopodra-server
pm2 logs photopodra-server
pm2 restart photopodra-server
pm2 stop photopodra-server
```

---

## Secure Public Access: Free Cloudflare Tunnel (`cloudflared`)

A Cloudflare Tunnel connects your local server outbound to Cloudflare's global edge without opening any router ports or configuring port forwarding. It operates seamlessly behind residential CGNAT, firewalls, and dynamic IP addresses.

### Benefits
- **Zero Open Router Ports**: No NAT port-forwarding or public IP required.
- **Free Automatic SSL/TLS**: Cloudflare provisions and auto-renews wildcard SSL certificates.
- **DDoS & Web Application Firewall**: Free edge security.
- **Custom Domain**: Connects directly to `https://photos.yourdomain.com`.

---

### Setup Instructions

#### Step 1: Install `cloudflared` CLI

- **Linux (Debian/Ubuntu)**:
  ```bash
  curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
  sudo dpkg -i cloudflared.deb
  ```
- **macOS (Homebrew)**:
  ```bash
  brew install cloudflared
  ```
- **Windows (Winget or Scoop)**:
  ```powershell
  winget install --id Cloudflare.cloudflared
  ```

#### Step 2: Authenticate with Cloudflare
```bash
cloudflared tunnel login
```
This opens a browser window prompting you to log into your Cloudflare account and authorize your domain (e.g. `yourdomain.com`).

#### Step 3: Create the Tunnel
```bash
cloudflared tunnel create photopodra-tunnel
```
Output will display a Tunnel UUID and credentials file location:
```
Tunnel credentials written to /Users/you/.cloudflared/12345678-abcd-1234-abcd-1234567890ab.json
Created tunnel photopodra-tunnel with id 12345678-abcd-1234-abcd-1234567890ab
```

#### Step 4: Configure the Tunnel
Create a configuration file at `~/.cloudflared/config.yml` (Linux/macOS) or `%USERPROFILE%\.cloudflared\config.yml` (Windows):

```yaml
tunnel: 12345678-abcd-1234-abcd-1234567890ab
credentials-file: /home/you/.cloudflared/12345678-abcd-1234-abcd-1234567890ab.json

ingress:
  - hostname: photos.yourdomain.com
    service: http://localhost:3001
    originRequest:
      connectTimeout: 30s
      noTLSVerify: true
  - service: http_status:404
```

#### Step 5: Route DNS Traffic
Create a DNS CNAME record routing your subdomain to the tunnel:
```bash
cloudflared tunnel route dns photopodra-tunnel photos.yourdomain.com
```

#### Step 6: Test the Tunnel
```bash
cloudflared tunnel run photopodra-tunnel
```
Now visit `https://photos.yourdomain.com` in your browser. Your local Photopodra instance will load securely with full HTTPS!

#### Step 7: Install `cloudflared` as a System Service (Auto-start on Boot)

- **Linux (Systemd)**:
  ```bash
  sudo cloudflared service install
  sudo systemctl enable cloudflared
  sudo systemctl start cloudflared
  ```
- **Windows (Service)**:
  ```powershell
  cloudflared service install
  net start cloudflared
  ```

---

### Alternative: Dockerized Cloudflare Tunnel

If you prefer managing everything in Docker, you can run `cloudflared` directly through Docker Compose:

1. Obtain your **Tunnel Token** from the [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/) (**Networks &rarr; Tunnels &rarr; Add a Tunnel &rarr; Select Cloudflared &rarr; Copy Token**).
2. Set the environment variable:
   ```bash
   export CLOUDFLARE_TUNNEL_TOKEN="eyJhIjoi..."
   ```
   Or place it in a `.env` file in the root directory:
   ```env
   CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoi...
   ```
3. Start Photopodra with the tunnel profile:
   ```bash
   docker compose --profile tunnel up -d
   ```

---

## Connecting Mobile and Desktop Apps to Your Central Server

Once your central server is accessible at `https://photos.yourdomain.com`:

1. Open the **Photopodra app** on your Android, iOS, Windows, or macOS device.
2. Click or tap the **Settings gear icon (⚙)** in the top navigation header.
3. In the **Server Connection Settings** modal:
   - Enter your public domain: `https://photos.yourdomain.com`
   - Click **Test Connection**.
   - You will see a green **Connected (~ms)** confirmation badge.
4. Click **Save Endpoint**.

The app will instantly reload and sync your photo library and AI vector search directly from your central server!
