#!/bin/bash

# Smart Cooking Sync - Quick Deployment Script
# This script automates the deployment process from GitHub to Docker

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════╗"
echo "║   Smart Cooking Sync Deployment     ║"
echo "║        From GitHub to Docker         ║"
echo "╚═══════════════════════════════════════╝"
echo -e "${NC}"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker is installed${NC}"
echo -e "${GREEN}✓ Docker Compose is installed${NC}"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from .env.example...${NC}"
    
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}✓ .env file created${NC}"
        echo ""
        echo -e "${YELLOW}📝 IMPORTANT: Edit .env file to set your MongoDB password!${NC}"
        echo -e "${YELLOW}   Run: nano .env${NC}"
        echo ""
        read -p "Press Enter after you've updated the .env file with your password..."
    else
        echo -e "${RED}❌ .env.example not found. Creating .env manually...${NC}"
        cat > .env << 'ENVEOF'
# MongoDB Configuration
MONGO_PASSWORD=changeme123

# Backend URL (used by frontend)
BACKEND_URL=http://localhost:8002

# Database Name
DB_NAME=cooking_sync
ENVEOF
        echo -e "${GREEN}✓ .env file created with defaults${NC}"
        echo ""
        echo -e "${YELLOW}📝 CRITICAL: Edit .env file to set a secure MongoDB password!${NC}"
        echo -e "${YELLOW}   Run: nano .env${NC}"
        echo -e "${YELLOW}   Change MONGO_PASSWORD from 'changeme123' to something secure${NC}"
        echo ""
        read -p "Press Enter after you've updated the .env file with your password..."
    fi
else
    echo -e "${GREEN}✓ .env file exists${NC}"
fi

# Check if default password is still in use
if grep -q "MONGO_PASSWORD=changeme123" .env; then
    echo -e "${RED}❌ WARNING: You're using the default MongoDB password!${NC}"
    echo -e "${YELLOW}   This is insecure. Please change it in .env file.${NC}"
    read -p "Do you want to continue anyway? (not recommended) [y/N]: " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Deployment cancelled. Please update your .env file.${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${BLUE}🔍 Checking port availability...${NC}"

# Check if ports are available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo -e "${RED}❌ Port $port is already in use${NC}"
        return 1
    else
        echo -e "${GREEN}✓ Port $port is available${NC}"
        return 0
    fi
}

PORTS_OK=true
check_port 3001 || PORTS_OK=false
check_port 8002 || PORTS_OK=false

if [ "$PORTS_OK" = false ]; then
    echo -e "${RED}❌ Required ports are in use. Please free them or modify docker-compose.yml${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🐳 Building and starting Docker containers...${NC}"
echo -e "${YELLOW}   This may take 5-10 minutes on first run...${NC}"
echo ""

# Build and start containers
docker-compose up -d --build

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ Docker containers started successfully!${NC}"
    echo ""
    
    # Wait a bit for services to start
    echo -e "${BLUE}⏳ Waiting for services to initialize...${NC}"
    sleep 5
    
    # Check container status
    echo ""
    echo -e "${BLUE}📊 Container Status:${NC}"
    docker-compose ps
    
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════${NC}"
    echo -e "${GREEN}   🎉 Deployment Successful!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════${NC}"
    echo ""
    echo -e "${BLUE}🌐 Access your application:${NC}"
    echo -e "   ${GREEN}Frontend:${NC}  http://localhost:3001"
    echo -e "   ${GREEN}Backend:${NC}   http://localhost:8002/api"
    echo -e "   ${GREEN}API Docs:${NC}  http://localhost:8002/docs"
    echo ""
    echo -e "${BLUE}📚 Useful commands:${NC}"
    echo -e "   View logs:       ${YELLOW}docker-compose logs -f${NC}"
    echo -e "   Stop services:   ${YELLOW}docker-compose stop${NC}"
    echo -e "   Restart:         ${YELLOW}docker-compose restart${NC}"
    echo -e "   Remove all:      ${YELLOW}docker-compose down${NC}"
    echo ""
    
    # Test frontend
    echo -e "${BLUE}🧪 Testing frontend...${NC}"
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Frontend is responding${NC}"
    else
        echo -e "${YELLOW}⚠️  Frontend not responding yet (may need more time)${NC}"
    fi
    
    # Test backend
    echo -e "${BLUE}🧪 Testing backend...${NC}"
    if curl -s http://localhost:8002/api/ > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend is responding${NC}"
    else
        echo -e "${YELLOW}⚠️  Backend not responding yet (may need more time)${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}Happy cooking! 👨‍🍳👩‍🍳${NC}"
    
else
    echo ""
    echo -e "${RED}❌ Deployment failed!${NC}"
    echo -e "${YELLOW}Check the logs with: docker-compose logs${NC}"
    exit 1
fi
