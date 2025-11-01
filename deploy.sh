#!/bin/bash

# Smart Cooking Sync - Docker Deployment Script
# For use in Proxmox containers/VMs

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Smart Cooking Sync - Docker Deploy   ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker is not installed${NC}"
    echo -e "${YELLOW}Installing Docker...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    echo -e "${GREEN}✓ Docker installed${NC}"
    echo -e "${YELLOW}Please log out and back in, then run this script again${NC}"
    exit 0
fi

# Check if Docker Compose is available
if ! docker compose version &> /dev/null; then
    echo -e "${RED}✗ Docker Compose is not installed${NC}"
    echo -e "${YELLOW}Installing Docker Compose plugin...${NC}"
    sudo apt-get update
    sudo apt-get install -y docker-compose-plugin
    echo -e "${GREEN}✓ Docker Compose installed${NC}"
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}! .env file not found${NC}"
    echo -e "${YELLOW}Creating .env from template...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓ .env file created${NC}"
    echo ""
    echo -e "${YELLOW}⚠ IMPORTANT: Edit .env file and set secure passwords!${NC}"
    echo -e "${YELLOW}Run: nano .env${NC}"
    echo ""
    read -p "Press Enter after editing .env to continue..."
fi

# Parse command
COMMAND=${1:-start}

case $COMMAND in
    start)
        echo -e "${GREEN}Starting Smart Cooking Sync...${NC}"
        docker compose up -d --build
        echo ""
        echo -e "${GREEN}✓ Services started!${NC}"
        echo ""
        echo "Access your app at:"
        echo -e "${GREEN}  Frontend: http://localhost:3000${NC}"
        echo -e "${GREEN}  Backend API: http://localhost:8001/api${NC}"
        echo -e "${GREEN}  API Docs: http://localhost:8001/docs${NC}"
        echo ""
        echo "View logs with: docker compose logs -f"
        ;;
        
    stop)
        echo -e "${YELLOW}Stopping Smart Cooking Sync...${NC}"
        docker compose down
        echo -e "${GREEN}✓ Services stopped${NC}"
        ;;
        
    restart)
        echo -e "${YELLOW}Restarting Smart Cooking Sync...${NC}"
        docker compose restart
        echo -e "${GREEN}✓ Services restarted${NC}"
        ;;
        
    logs)
        docker compose logs -f
        ;;
        
    status)
        echo -e "${GREEN}Service Status:${NC}"
        docker compose ps
        echo ""
        echo -e "${GREEN}Resource Usage:${NC}"
        docker stats --no-stream
        ;;
        
    update)
        echo -e "${GREEN}Updating Smart Cooking Sync...${NC}"
        docker compose down
        docker compose pull
        docker compose up -d --build
        echo -e "${GREEN}✓ Update complete${NC}"
        ;;
        
    backup)
        BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$BACKUP_DIR"
        echo -e "${GREEN}Creating backup in $BACKUP_DIR${NC}"
        docker compose exec -T mongodb mongodump --archive > "$BACKUP_DIR/mongodb.archive"
        echo -e "${GREEN}✓ Backup complete${NC}"
        ;;
        
    clean)
        echo -e "${RED}⚠ WARNING: This will remove all containers and volumes!${NC}"
        read -p "Are you sure? (yes/no): " -r
        if [[ $REPLY == "yes" ]]; then
            docker compose down -v
            echo -e "${GREEN}✓ Cleanup complete${NC}"
        else
            echo -e "${YELLOW}Cleanup cancelled${NC}"
        fi
        ;;
        
    *)
        echo "Usage: $0 {start|stop|restart|logs|status|update|backup|clean}"
        echo ""
        echo "Commands:"
        echo "  start   - Build and start all services"
        echo "  stop    - Stop all services"
        echo "  restart - Restart all services"
        echo "  logs    - View live logs"
        echo "  status  - Check service status and resource usage"
        echo "  update  - Pull latest changes and rebuild"
        echo "  backup  - Backup MongoDB database"
        echo "  clean   - Remove all containers and volumes (WARNING: deletes data)"
        exit 1
        ;;
esac
