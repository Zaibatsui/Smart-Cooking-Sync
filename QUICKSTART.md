# ⚡ Quick Start Guide

Get Smart Cooking Sync running in under 5 minutes!

## 🚀 One-Command Deploy

```bash
# Clone and deploy
git clone https://github.com/Zaibatsui/smart-cooking-sync.git && \
cd smart-cooking-sync && \
./quick-deploy.sh
```

That's it! The script handles everything automatically.

## 📋 What You Need

- Docker installed
- Docker Compose installed
- Ports 3001 and 8002 free
- 2GB RAM available

## 🔐 Important First Step

When prompted, edit the `.env` file to set a secure MongoDB password:

```bash
nano .env
```

Change this line:
```
MONGO_PASSWORD=changeme123
```

To something secure:
```
MONGO_PASSWORD=your-super-secure-password-here
```

## 🌐 Access Your App

Once deployed, open your browser:

- **App**: http://localhost:3001
- **API**: http://localhost:8002/docs

## 📱 Start Cooking!

1. Click **Add Dishes** tab
2. Enter your first dish (e.g., "Roast Chicken", 200°C, 60 min)
3. Add more dishes
4. Click **Cooking Plan** tab to see the optimised plan
5. Click **Start Timer** when you put each dish in the oven

## 🛑 Stop/Restart

```bash
# Stop everything
docker-compose stop

# Start again
docker-compose start

# Remove everything (⚠️ deletes data)
docker-compose down -v
```

## ❓ Problems?

### Port Already in Use
```bash
# Change ports in docker-compose.yml
nano docker-compose.yml
# Edit lines with "3001" and "8002"
```

### Can't Access App
```bash
# Check if containers are running
docker-compose ps

# View logs
docker-compose logs -f
```

### Need Help?
- Full guide: [GITHUB_TO_DOCKER.md](./GITHUB_TO_DOCKER.md)
- Issues: https://github.com/Zaibatsui/smart-cooking-sync/issues

---

**That's all! Happy cooking! 👨‍🍳👩‍🍳**
