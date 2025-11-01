# Docker Rebuild Instructions - Smart Cooking Sync

## Quick Rebuild (After Git Pull)

### 1. Stop and Remove Everything
```bash
# Stop all running containers
docker-compose down

# Remove all containers, networks, and volumes
docker-compose down -v

# Remove all images (optional - saves disk space)
docker system prune -a --volumes
# Type 'y' when prompted
```

### 2. Pull Latest Code
```bash
# Navigate to project directory
cd /path/to/smart-cooking-sync

# Pull latest changes
git pull origin main
```

### 3. Rebuild and Start
```bash
# Build and start containers
docker-compose up --build -d

# View logs
docker-compose logs -f
```

---

## Detailed Step-by-Step Guide

### Option A: Quick Clean Rebuild
```bash
# 1. Stop everything
docker-compose down -v

# 2. Pull latest code
git pull origin main

# 3. Rebuild fresh
docker-compose build --no-cache
docker-compose up -d

# 4. Check status
docker-compose ps
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Option B: Nuclear Option (Complete Cleanup)
```bash
# 1. Stop all containers
docker stop $(docker ps -aq)

# 2. Remove all containers
docker rm $(docker ps -aq)

# 3. Remove all images
docker rmi $(docker images -q)

# 4. Remove all volumes
docker volume rm $(docker volume ls -q)

# 5. Remove all networks
docker network prune -f

# 6. Pull latest code
git pull origin main

# 7. Build fresh
docker-compose up --build -d
```

---

## Environment Setup

### 1. Create .env file (if not exists)
```bash
cat > .env << 'EOF'
# Server IP (your server's public IP or domain)
SERVER_IP=your.server.ip

# Backend URL
REACT_APP_BACKEND_URL=http://your.server.ip:8002

# MongoDB
MONGO_INITDB_ROOT_USERNAME=admin
MONGO_INITDB_ROOT_PASSWORD=your_secure_password_here
DB_NAME=cooking_sync

# Ports
FRONTEND_PORT=3001
BACKEND_PORT=8002
MONGO_PORT=27017
EOF
```

### 2. Update SERVER_IP
```bash
# Replace with your actual server IP
sed -i 's/your.server.ip/YOUR_ACTUAL_IP/g' .env
```

---

## Troubleshooting

### Issue: Port Already in Use
```bash
# Find what's using the port
sudo lsof -i :3001
sudo lsof -i :8002

# Kill the process
sudo kill -9 <PID>
```

### Issue: MongoDB Won't Start
```bash
# Remove MongoDB volume and restart
docker-compose down -v
docker volume rm smart-cooking-sync_mongodb_data
docker-compose up -d mongodb
```

### Issue: Frontend Build Fails
```bash
# Clear node_modules and rebuild
docker-compose down
docker-compose build --no-cache frontend
docker-compose up -d
```

### Issue: Backend Won't Connect to MongoDB
```bash
# Check MongoDB is running
docker-compose ps

# View MongoDB logs
docker-compose logs mongodb

# Restart backend
docker-compose restart backend
```

---

## Verify Deployment

### 1. Check All Services Running
```bash
docker-compose ps

# Should show:
# frontend  - Up
# backend   - Up  
# mongodb   - Up
```

### 2. Test Backend API
```bash
curl http://localhost:8002/api/dishes
# Should return: []
```

### 3. Test Frontend
```bash
curl http://localhost:3001
# Should return HTML
```

### 4. View Live Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongodb
```

---

## Maintenance Commands

### View Container Status
```bash
docker-compose ps
```

### Restart Specific Service
```bash
docker-compose restart frontend
docker-compose restart backend
docker-compose restart mongodb
```

### Stop Everything
```bash
docker-compose down
```

### Start Everything
```bash
docker-compose up -d
```

### View Resource Usage
```bash
docker stats
```

### Access Container Shell
```bash
# Backend
docker-compose exec backend bash

# Frontend
docker-compose exec frontend sh

# MongoDB
docker-compose exec mongodb mongosh
```

---

## Production Deployment Checklist

- [ ] Update SERVER_IP in .env file
- [ ] Set strong MONGO_INITDB_ROOT_PASSWORD
- [ ] Configure firewall (allow ports 3001, 8002)
- [ ] Set up SSL/TLS (nginx reverse proxy)
- [ ] Configure domain DNS
- [ ] Set up automated backups for MongoDB
- [ ] Enable Docker restart policies
- [ ] Set up monitoring/logging
- [ ] Test all functionality

---

## Backup & Restore

### Backup MongoDB Data
```bash
# Create backup
docker-compose exec mongodb mongodump --out=/backup
docker cp smart-cooking-sync_mongodb_1:/backup ./mongodb_backup_$(date +%Y%m%d)

# Or use volume backup
docker run --rm -v smart-cooking-sync_mongodb_data:/data -v $(pwd):/backup ubuntu tar czf /backup/mongodb_backup.tar.gz /data
```

### Restore MongoDB Data
```bash
# Restore from backup
docker cp ./mongodb_backup_20231101 smart-cooking-sync_mongodb_1:/backup
docker-compose exec mongodb mongorestore /backup
```

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `docker-compose up -d` | Start all services |
| `docker-compose down` | Stop all services |
| `docker-compose down -v` | Stop and remove volumes |
| `docker-compose build` | Rebuild images |
| `docker-compose logs -f` | View live logs |
| `docker-compose ps` | Check status |
| `docker-compose restart <service>` | Restart service |
| `docker system prune -a` | Clean everything |

---

## Need Help?

- View logs: `docker-compose logs -f`
- Check status: `docker-compose ps`
- Restart service: `docker-compose restart <service>`
- Full rebuild: `docker-compose down -v && docker-compose up --build -d`
