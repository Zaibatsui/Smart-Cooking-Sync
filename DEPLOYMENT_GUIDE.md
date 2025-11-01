# 🔥 Smart Cooking Sync - Quick Deployment Guide

## 📦 What's Included

```
/app/
├── Dockerfile.frontend      # React app container
├── Dockerfile.backend       # FastAPI container  
├── docker-compose.yml       # Orchestration config
├── nginx.conf              # Frontend web server config
├── deploy.sh               # Easy deployment script
├── .env.example            # Environment template
└── README.Docker.md        # Full documentation
```

## 🚀 Quick Start (Copy & Paste)

### 1️⃣ On Your Proxmox Host/Container

```bash
# Install Docker (if not already installed)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Log out and back in, then continue
```

### 2️⃣ Deploy the App

```bash
# Copy project to your server
cd /opt
mkdir cooking-sync
# Upload files or git clone here

cd cooking-sync

# Create environment file
cp .env.example .env
nano .env  # Set MONGO_PASSWORD to something secure!

# Deploy with one command
chmod +x deploy.sh
./deploy.sh start
```

### 3️⃣ Access Your App

- **Frontend**: http://your-server-ip:3000
- **Backend API**: http://your-server-ip:8001/api
- **API Docs**: http://your-server-ip:8001/docs

## 🎯 Common Commands

```bash
./deploy.sh start     # Start all services
./deploy.sh stop      # Stop everything  
./deploy.sh restart   # Restart services
./deploy.sh logs      # View live logs
./deploy.sh status    # Check health & resources
./deploy.sh backup    # Backup database
./deploy.sh update    # Update to latest version
./deploy.sh clean     # Remove all (⚠️ deletes data)
```

## ⚙️ Configuration

### Environment Variables (.env)

```bash
# MongoDB password (CHANGE THIS!)
MONGO_PASSWORD=your-secure-password-here

# Backend URL (change if using reverse proxy)
BACKEND_URL=http://your-server-ip:8001

# Database name (can leave as is)
DB_NAME=cooking_sync
```

### Port Configuration

Default ports in `docker-compose.yml`:
- Frontend: 3000
- Backend: 8001  
- MongoDB: 27017 (internal only)

To change ports, edit `docker-compose.yml`:
```yaml
ports:
  - "YOUR_PORT:80"  # Frontend
  - "YOUR_PORT:8001"  # Backend
```

## 🔒 Production Setup

### 1. Use Reverse Proxy (Recommended)

Install Nginx or Traefik on your Proxmox host to:
- Add HTTPS/SSL
- Use domain names
- Improve security

Example Nginx config:
```nginx
server {
    listen 80;
    server_name cooking.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
    }
    
    location /api/ {
        proxy_pass http://localhost:8001;
    }
}
```

### 2. Firewall Rules

```bash
# Allow only necessary ports
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

### 3. Automatic Backups

Add to crontab:
```bash
# Daily backup at 2 AM
0 2 * * * cd /opt/cooking-sync && ./deploy.sh backup
```

## 🛠️ Troubleshooting

### Services won't start
```bash
# Check logs
docker compose logs -f

# Check if ports are in use
sudo netstat -tlnp | grep -E '3000|8001'

# Restart Docker
sudo systemctl restart docker
```

### Frontend can't reach backend
1. Check `.env` has correct BACKEND_URL
2. Ensure backend is running: `docker compose ps`
3. Test: `curl http://localhost:8001/api/`

### Database issues
```bash
# Check MongoDB logs
docker compose logs mongodb

# Access MongoDB shell
docker compose exec mongodb mongosh -u admin -p
```

### Out of space
```bash
# Clean up unused Docker resources
docker system prune -a

# Check disk usage
df -h
docker system df
```

## 📊 Monitoring

### View Resource Usage
```bash
docker stats
```

### Check Service Health
```bash
docker compose ps
./deploy.sh status
```

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend

# Last 100 lines
docker compose logs --tail=100
```

## 🔄 Updates

### Update Application
```bash
# Option 1: Use deploy script
./deploy.sh update

# Option 2: Manual
git pull  # or upload new files
docker compose down
docker compose up -d --build
```

### Update Docker Images
```bash
docker compose pull
docker compose up -d
```

## 💾 Backup & Restore

### Backup
```bash
# Automated backup
./deploy.sh backup

# Manual backup
docker compose exec mongodb mongodump --archive > backup.archive
```

### Restore
```bash
# Restore from backup
docker compose exec -T mongodb mongorestore --archive < backup.archive
```

## 📈 Resource Requirements

**Minimum:**
- CPU: 2 cores
- RAM: 2GB
- Storage: 10GB

**Recommended:**
- CPU: 4 cores  
- RAM: 4GB
- Storage: 20GB

## 🆘 Getting Help

1. Check logs: `./deploy.sh logs`
2. Check status: `./deploy.sh status`
3. Read full docs: `README.Docker.md`
4. Check Docker docs: https://docs.docker.com

## 🎉 That's It!

Your Smart Cooking Sync app is now running in Docker on Proxmox!

Access it at: **http://your-server-ip:3000**
