# Docker Deployment Guide for Smart Cooking Sync

## Quick Start

### 1. Prerequisites
- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 2GB RAM available
- Ports 3001, 8002, and 27017 available (or modify in docker-compose.yml)

### 2. Setup

```bash
# Clone or copy the project
cd /path/to/smart-cooking-sync

# Create environment file
cp .env.example .env

# Edit .env and set secure passwords
nano .env
```

### 3. Build and Run

```bash
# Build and start all services
docker-compose up -d --build

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### 4. Access the Application

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:8002/api
- **API Docs**: http://localhost:8002/docs

## Production Deployment on Proxmox

### Option 1: Docker Compose (Recommended)

1. **Create LXC Container or VM in Proxmox**
   - Ubuntu 22.04 LTS or similar
   - 2 CPU cores
   - 4GB RAM minimum
   - 20GB storage

2. **Install Docker**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

3. **Install Docker Compose**
```bash
sudo apt-get update
sudo apt-get install docker-compose-plugin
```

4. **Deploy Application**
```bash
# Copy project files
scp -r . user@proxmox-host:/opt/cooking-sync/

# SSH into host
ssh user@proxmox-host
cd /opt/cooking-sync

# Configure environment
cp .env.example .env
nano .env

# Start services
docker-compose up -d --build
```

### Option 2: Using Reverse Proxy (Nginx/Traefik)

Update `docker-compose.yml` to use your domain:

```yaml
services:
  frontend:
    environment:
      - REACT_APP_BACKEND_URL=https://api.yourdomain.com
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.cooking-sync.rule=Host(`yourdomain.com`)"
```

## Management Commands

### Start/Stop Services
```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart a specific service
docker-compose restart backend
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100
```

### Database Backup
```bash
# Backup MongoDB
docker-compose exec mongodb mongodump --out /data/backup

# Copy backup to host
docker cp cooking-sync-db:/data/backup ./mongodb-backup-$(date +%Y%m%d)
```

### Database Restore
```bash
# Copy backup to container
docker cp ./mongodb-backup cooking-sync-db:/data/restore

# Restore
docker-compose exec mongodb mongorestore /data/restore
```

### Update Application
```bash
# Pull latest changes
git pull  # or copy new files

# Rebuild and restart
docker-compose down
docker-compose up -d --build
```

## Monitoring

### Health Checks
```bash
# Check all services health
docker-compose ps

# Frontend health
curl http://localhost:3001/health

# Backend health
curl http://localhost:8002/api/
```

### Resource Usage
```bash
# View resource usage
docker stats

# View disk usage
docker system df
```

## Security Best Practices

1. **Change Default Passwords**
   - Update MONGO_PASSWORD in .env
   - Use strong, unique passwords

2. **Use HTTPS in Production**
   - Set up SSL certificates (Let's Encrypt)
   - Configure reverse proxy (Nginx/Traefik)

3. **Restrict Network Access**
   - Use firewall rules
   - Only expose necessary ports
   - Consider using a VPN

4. **Regular Backups**
   - Automated daily backups
   - Store backups off-site
   - Test restore procedures

5. **Keep Images Updated**
```bash
docker-compose pull
docker-compose up -d
```

## Troubleshooting

### Service Won't Start
```bash
# Check logs
docker-compose logs service-name

# Check if port is in use
sudo netstat -tlnp | grep :3001

# Remove and recreate
docker-compose down -v
docker-compose up -d --build
```

### Database Connection Issues
```bash
# Test MongoDB connection
docker-compose exec mongodb mongosh -u admin -p

# Check MongoDB logs
docker-compose logs mongodb
```

### Frontend Can't Connect to Backend
1. Check REACT_APP_BACKEND_URL in .env
2. Ensure backend is running: `docker-compose ps`
3. Test backend API: `curl http://localhost:8002/api/`

## Performance Tuning

### For Production

Update `docker-compose.yml`:

```yaml
services:
  mongodb:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

## Support

For issues or questions:
1. Check logs: `docker-compose logs -f`
2. Review this documentation
3. Check Docker and application logs

## Cleanup

```bash
# Stop and remove containers
docker-compose down

# Remove containers and volumes (WARNING: deletes data)
docker-compose down -v

# Remove images
docker-compose down --rmi all
```