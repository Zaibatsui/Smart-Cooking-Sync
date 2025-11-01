# GitHub to Docker Deployment Guide

This guide walks you through deploying Smart Cooking Sync from GitHub to a Docker container.

## 🎯 Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- Git installed
- At least 2GB RAM
- Ports 3001, 8002, and 27017 available

## 📥 Step-by-Step Deployment

### 1. Clone the Repository

```bash
# Clone from GitHub
git clone https://github.com/Zaibatsui/smart-cooking-sync.git

# Navigate into the directory
cd smart-cooking-sync
```

### 2. Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit the environment file
nano .env
```

**Required changes in `.env`:**
```bash
# IMPORTANT: Set a strong password for MongoDB
MONGO_PASSWORD=your-secure-password-here

# Backend URL (use your server's IP or domain)
BACKEND_URL=http://your-server-ip:8002

# Database name (can leave as default)
DB_NAME=cooking_sync
```

**Security Note:** Never commit the `.env` file to Git! It's already in `.gitignore`.

### 3. Verify Docker Configuration

The repository comes with pre-configured Docker files:
- `docker-compose.yml` - Multi-container orchestration
- `Dockerfile.backend` - Backend container build
- `Dockerfile.frontend` - Frontend container build
- `nginx.conf` - Nginx web server configuration

**Default Ports:**
- Frontend: 3001
- Backend: 8002
- MongoDB: 27017 (internal only)

### 4. Build and Start Containers

```bash
# Build and start all services in detached mode
docker-compose up -d --build

# This will:
# - Build the backend Docker image (FastAPI + Python)
# - Build the frontend Docker image (React + Nginx)
# - Pull MongoDB 7.0 image
# - Create Docker network and volumes
# - Start all three containers
```

**Build time:** First build takes 5-10 minutes depending on your internet connection.

### 5. Verify Deployment

```bash
# Check all containers are running
docker-compose ps

# You should see:
# - cooking-sync-frontend (running)
# - cooking-sync-backend (running)
# - cooking-sync-db (running)
```

### 6. Test the Application

```bash
# Frontend health check
curl http://localhost:3001/health

# Backend health check
curl http://localhost:8002/api/

# API documentation (open in browser)
# http://localhost:8002/docs
```

### 7. Access the Application

Open your browser and navigate to:
- **Application**: http://localhost:3001
- **API Docs**: http://localhost:8002/docs

If deploying on a server, replace `localhost` with your server's IP address.

## 🔧 Common Commands

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f frontend
docker-compose logs -f backend
docker-compose logs -f mongodb
```

### Stop Services
```bash
# Stop all services (keeps data)
docker-compose stop

# Stop and remove containers (keeps data)
docker-compose down

# Stop and remove everything including volumes (⚠️ deletes data)
docker-compose down -v
```

### Restart Services
```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart backend
```

### Update from GitHub
```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose up -d --build
```

### Backup Database
```bash
# Export MongoDB data
docker-compose exec mongodb mongodump \
  --username admin \
  --password YOUR_MONGO_PASSWORD \
  --out /data/backup

# Copy backup to host
docker cp cooking-sync-db:/data/backup ./mongodb_backup
```

### Restore Database
```bash
# Copy backup to container
docker cp ./mongodb_backup cooking-sync-db:/data/backup

# Restore data
docker-compose exec mongodb mongorestore \
  --username admin \
  --password YOUR_MONGO_PASSWORD \
  /data/backup
```

## 🌐 Production Deployment

### For Internet-Facing Deployment

1. **Set up reverse proxy** (Nginx or Traefik)
2. **Configure SSL/TLS** (Let's Encrypt recommended)
3. **Set up firewall rules**
4. **Use strong passwords**
5. **Regular backups**

### Example Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name cooking.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ {
        proxy_pass http://localhost:8002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Then add SSL with:
```bash
sudo certbot --nginx -d cooking.yourdomain.com
```

## 🔒 Security Best Practices

1. **Change Default Passwords**
   - Never use the example password in production
   - Use strong, random passwords (minimum 20 characters)

2. **Environment Variables**
   - Never commit `.env` files to Git
   - Keep `.env.example` updated but without real values

3. **Network Security**
   - Only expose necessary ports (3001 for frontend)
   - Keep MongoDB port 27017 internal only
   - Use firewall rules to restrict access

4. **Regular Updates**
   ```bash
   git pull origin main
   docker-compose down
   docker-compose up -d --build
   ```

5. **Monitor Logs**
   ```bash
   docker-compose logs -f --tail=100
   ```

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Check what's using the port
sudo netstat -tlnp | grep 3001
sudo netstat -tlnp | grep 8002

# Stop conflicting service or change ports in docker-compose.yml
```

### Container Won't Start
```bash
# Check logs
docker-compose logs backend
docker-compose logs frontend

# Remove and rebuild
docker-compose down
docker-compose up -d --build
```

### MongoDB Connection Issues
```bash
# Verify MongoDB is running
docker-compose exec mongodb mongosh -u admin -p

# Check MongoDB logs
docker-compose logs mongodb

# Verify network connectivity
docker network inspect cooking-sync-network
```

### Frontend Can't Connect to Backend
1. Check `BACKEND_URL` in `.env`
2. Verify backend is running: `docker-compose ps`
3. Test backend directly: `curl http://localhost:8002/api/`
4. Check browser console for CORS errors

### Database Data Lost
- By default, MongoDB data persists in Docker volume `mongodb_data`
- Only deleted when running `docker-compose down -v`
- Regular backups recommended for production

## 📊 Resource Requirements

### Minimum
- **CPU**: 1 core
- **RAM**: 2GB
- **Disk**: 5GB

### Recommended (Production)
- **CPU**: 2+ cores
- **RAM**: 4GB
- **Disk**: 20GB (for logs and backups)

## 📝 Post-Deployment Checklist

- [ ] All containers running (`docker-compose ps`)
- [ ] Frontend accessible at http://localhost:3001
- [ ] Backend API responding at http://localhost:8002/api/
- [ ] Can add dishes successfully
- [ ] Cooking plan calculates correctly
- [ ] Timers work and persist across refreshes
- [ ] Data persists after container restart
- [ ] Backups configured
- [ ] SSL/TLS configured (production)
- [ ] Firewall rules set (production)
- [ ] Monitoring in place (production)

## 🆘 Getting Help

- **Issues**: https://github.com/Zaibatsui/smart-cooking-sync/issues
- **Discussions**: https://github.com/Zaibatsui/smart-cooking-sync/discussions
- **Documentation**: See README.md and DEPLOYMENT_GUIDE.md

---

**Deployment Complete! 🎉**

Your Smart Cooking Sync application should now be running in Docker containers, ready to help coordinate your cooking!
