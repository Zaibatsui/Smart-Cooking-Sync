# Quick Fix for Missing .env.example

If you cloned the repository and `.env.example` is missing, create it manually:

## Option 1: Create .env file directly

Run this command on your server:

```bash
cat > .env << 'EOF'
# MongoDB Configuration
MONGO_PASSWORD=changeme123

# Backend URL (used by frontend)
BACKEND_URL=http://localhost:8002

# Database Name
DB_NAME=cooking_sync

# Optional: If using external MongoDB
# MONGO_URL=mongodb://username:password@host:27017/cooking_sync?authSource=admin
EOF
```

## Option 2: Create with sed (set password directly)

Replace `YOUR_SECURE_PASSWORD` with your actual password:

```bash
cat > .env << 'EOF'
# MongoDB Configuration
MONGO_PASSWORD=YOUR_SECURE_PASSWORD

# Backend URL (used by frontend)
BACKEND_URL=http://localhost:8002

# Database Name
DB_NAME=cooking_sync
EOF
```

## Then proceed with deployment

```bash
# Verify .env exists
cat .env

# Build and start
docker-compose up -d --build

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

## Access your app

- Frontend: http://localhost:3001
- Backend: http://localhost:8002/api
- API Docs: http://localhost:8002/docs

## If using a server with IP address

Edit `.env` and change:
```bash
BACKEND_URL=http://YOUR_SERVER_IP:8002
```

Then rebuild:
```bash
docker-compose down
docker-compose up -d --build
```
