# Port Configuration Changes

## Summary
All Docker deployment ports have been updated by +1 to avoid conflicts with existing applications.

## Port Changes

| Service  | Old Port | New Port |
|----------|----------|----------|
| Frontend | 3000     | 3001     |
| Backend  | 8001     | 8002     |
| MongoDB  | 27017    | 27017 (unchanged - internal only) |

## Files Updated

### 1. Core Docker Configuration
- **docker-compose.yml**
  - Backend port mapping: `8001:8001` → `8002:8002`
  - Frontend port mapping: `3000:80` → `3001:80`
  - Backend health check: `/api/` endpoint now on port 8002
  - BACKEND_URL default: `http://localhost:8001` → `http://localhost:8002`

- **Dockerfile.backend**
  - EXPOSE port: 8001 → 8002
  - Uvicorn command: `--port 8001` → `--port 8002`
  - Added curl to system dependencies for health checks

- **nginx.conf**
  - Proxy pass to backend: `http://backend:8001` → `http://backend:8002`

### 2. Environment Configuration
- **.env.example**
  - BACKEND_URL: `http://localhost:8001` → `http://localhost:8002`

### 3. Documentation Files
- **README.Docker.md**
  - Prerequisites: Updated port requirements
  - Access URLs: Updated all references to new ports
  - Health check commands: Updated curl commands
  - Troubleshooting: Updated port checking commands

- **DEPLOYMENT_GUIDE.md**
  - Access URLs: Updated frontend and backend URLs
  - Port configuration section: Updated default ports
  - Environment variables: Updated BACKEND_URL example
  - Nginx reverse proxy config: Updated proxy_pass ports
  - Troubleshooting commands: Updated netstat port checks

- **deploy.sh**
  - Success message: Updated access URLs to new ports

## Important Notes

### For Docker Deployment
1. **Before deploying**, ensure ports 3001 and 8002 are available:
   ```bash
   sudo netstat -tlnp | grep -E '3001|8002'
   ```

2. **After deploying**, verify services are accessible:
   ```bash
   # Frontend
   curl http://localhost:3001/health
   
   # Backend
   curl http://localhost:8002/api/
   ```

### Development Environment
**Note**: The current development environment (supervisor) still uses the original ports:
- Frontend: 3000
- Backend: 8001
- REACT_APP_BACKEND_URL: Uses production external URL

These Docker port changes **only affect Docker deployments**, not the current development environment running on this platform.

### Nginx Reverse Proxy
If using Nginx as a reverse proxy in production, update your nginx config:
```nginx
location / {
    proxy_pass http://localhost:3001;  # Changed from 3000
}

location /api/ {
    proxy_pass http://localhost:8002;  # Changed from 8001
}
```

## Deployment Commands

### Quick Start
```bash
# Copy example env file
cp .env.example .env

# Edit and set your MONGO_PASSWORD
nano .env

# Start services
docker-compose up -d --build

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Access Application
- Frontend: http://localhost:3001
- Backend API: http://localhost:8002/api
- API Docs: http://localhost:8002/docs

## Rollback Instructions

If you need to revert to the original ports (3000 and 8001), reverse these changes in the files listed above.
