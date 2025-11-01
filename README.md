# 🔥 Smart Cooking Sync

**Multi-dish timer and temperature optimiser for perfect meal coordination**

Smart Cooking Sync helps you cook multiple dishes simultaneously by calculating the optimal oven temperature and adjusting cooking times, so everything finishes together perfectly.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![PWA](https://img.shields.io/badge/PWA-Enabled-green.svg)](https://web.dev/progressive-web-apps/)

---

## ✨ Features

### 🎯 Core Functionality
- **Multi-Dish Coordination** - Add multiple dishes with different temperatures and cooking times
- **Smart Temperature Optimisation** - Automatically calculates the optimal oven temperature (rounded to nearest 10°C)
- **Intelligent Time Adjustment** - Adjusts cooking times proportionally based on temperature differences
- **Oven Type Support** - Handles Fan, Electric, and Gas ovens with proper conversions
- **Cooking Timeline** - Visual step-by-step cooking plan showing when to start each dish

### ⏱️ Timer System
- **Individual Timers** - Start, pause, resume, and reset timers for each dish
- **Countdown Display** - Real-time countdown in MM:SS format
- **Progress Bars** - Visual progress indicators for each cooking item
- **Persistent Timers** - Timers survive page refreshes and continue accurately
- **Audio Alerts** - Continuous alarm when dishes are ready (8 beeps, high pitch, adjustable)
- **Stop Alarm Button** - Easy-to-access pulsing button to silence alarms

### 🎨 User Experience
- **Dark Mode** - Toggle between light and dark themes
- **Mobile Optimised** - Fully responsive design for phones and tablets
- **PWA Support** - Install as an app on your device's home screen
- **Offline Capable** - Works without internet connection once installed
- **Custom Icons** - Beautiful gradient flame logo for branding
- **British English** - Uses "optimise" and proper UK spelling

### 💾 Data Management
- **MongoDB Backend** - All dishes stored in database with full CRUD operations
- **Persistent Storage** - Dishes survive app closures and page refreshes
- **User Settings** - Theme, oven type, and alarm preferences saved locally
- **Clear All Function** - Quick reset for starting new cooking sessions

### 🌡️ Temperature Intelligence
- **Celsius/Fahrenheit** - Support for both temperature units
- **Oven Conversions** - Automatic conversion between Fan/Electric/Gas
  - Electric → Fan: -20°C
  - Gas → Fan: -20°C
- **Realistic Rounding** - Temperatures rounded to 10°C increments (how real ovens work)

---

## 🖼️ Screenshots

### Light Mode
The clean, intuitive interface for adding dishes and viewing your cooking plan:
- Add dishes with name, temperature, time, and oven type
- View optimised cooking plan with adjusted temperatures and times
- Start individual timers for each dish

### Dark Mode
Comfortable cooking interface for evening meal prep:
- Eye-friendly dark theme
- All features fully functional in dark mode
- Persistent theme preference

### Mobile View
Optimised for cooking with your phone or tablet:
- Touch-friendly buttons and controls
- Responsive layout adapts to screen size
- PWA installable on home screen

---

## 🛠️ Tech Stack

### Frontend
- **React 18** - Modern UI framework
- **Tailwind CSS** - Utility-first styling
- **Shadcn UI** - Beautiful component library
- **Axios** - HTTP client for API calls
- **Lucide React** - Icon library
- **React Router** - Navigation

### Backend
- **FastAPI** - High-performance Python API framework
- **Motor** - Async MongoDB driver
- **Pydantic** - Data validation and serialisation
- **Uvicorn** - ASGI server

### Database
- **MongoDB 7.0** - NoSQL database for dishes and cooking plans

### DevOps
- **Docker** - Containerisation
- **Docker Compose** - Multi-container orchestration
- **Nginx** - Reverse proxy and static file serving
- **Supervisor** - Process management (development)

---

## 🚀 Quick Start

### Prerequisites
- Docker Engine 20.10+
- Docker Compose 2.0+
- 2GB RAM available
- Ports 3001 and 8002 available

### Installation

**Option 1: Quick Deploy (Recommended)**

```bash
# Clone the repository
git clone https://github.com/Zaibatsui/smart-cooking-sync.git
cd smart-cooking-sync

# Run the quick deployment script
./quick-deploy.sh
```

The script will:
- Check Docker installation
- Create `.env` file if needed
- Verify port availability
- Build and start all containers
- Test the deployment

**Option 2: Manual Deploy**

1. **Clone the repository**
```bash
git clone https://github.com/Zaibatsui/smart-cooking-sync.git
cd smart-cooking-sync
```

2. **Create environment file**
```bash
cp .env.example .env
```

3. **Edit the environment file and set a secure MongoDB password**
```bash
nano .env
```

4. **Build and start all services**
```bash
docker-compose up -d --build
```

5. **Access the application**
- Frontend: http://localhost:3001
- Backend API: http://localhost:8002/api
- API Documentation: http://localhost:8002/docs

### Using the Deploy Script

For easier management, use the included deployment script:

```bash
# Start all services
./deploy.sh start

# View logs
./deploy.sh logs

# Check status
./deploy.sh status

# Stop services
./deploy.sh stop

# Backup database
./deploy.sh backup

# Full cleanup (⚠️ deletes data)
./deploy.sh clean
```

---

## 📖 Usage Guide

### Adding Dishes

1. Navigate to the **Add Dishes** tab
2. Fill in the form:
   - **Dish Name** (e.g., "Roast Chicken")
   - **Temperature** (e.g., 200)
   - **Unit** (°C or °F)
   - **Time** in minutes (e.g., 60)
   - **Oven Type** (Fan, Electric, or Gas)
3. Click **Add Dish**
4. Repeat for all dishes you're cooking

### Viewing the Cooking Plan

1. Click the **Cooking Plan** tab
2. View the optimised plan:
   - **Optimal Temperature** - The calculated oven temperature
   - **Total Time** - How long until everything is ready
   - **Dish Timeline** - Order and timing for each dish

### Starting Timers

1. In the **Cooking Plan** tab, find your dish
2. Click **Start Timer** when you put it in the oven
3. The timer counts down automatically
4. Use **Pause/Resume** if needed
5. Click **Reset** to clear the timer

### Managing Settings

1. Click the **Settings** icon (gear) in the top right
2. Adjust:
   - **User's Oven Type** - Your actual oven (affects calculations)
   - **Theme** - Light or Dark mode
   - **Enable Alarms** - Toggle audio alerts on/off

### Clearing Data

- **Remove Single Dish** - Click the trash icon next to a dish
- **Clear All** - Click the "Clear All" button to remove everything

---

## 🔌 API Documentation

### Dishes Endpoints

#### Create Dish
```http
POST /api/dishes
Content-Type: application/json

{
  "name": "Roast Chicken",
  "temperature": 200,
  "unit": "C",
  "cookingTime": 60,
  "ovenType": "Electric"
}
```

#### Get All Dishes
```http
GET /api/dishes
```

#### Delete Dish
```http
DELETE /api/dishes/{dish_id}
```

#### Clear All Dishes
```http
DELETE /api/dishes
```

### Cooking Plan Endpoint

#### Calculate Cooking Plan
```http
POST /api/cooking-plan/calculate
Content-Type: application/json

{
  "user_oven_type": "Fan"
}
```

**Response:**
```json
{
  "optimal_temp": 190,
  "adjusted_dishes": [
    {
      "id": "uuid",
      "name": "Roast Chicken",
      "originalTemp": 200,
      "adjustedTemp": 190,
      "originalTime": 60,
      "adjustedTime": 63,
      "order": 1
    }
  ],
  "total_time": 63
}
```

For detailed API documentation, visit: http://localhost:8002/docs

---

## 🐳 Docker Deployment

### Environment Variables

Create a `.env` file with:

```bash
# MongoDB password (REQUIRED - change this!)
MONGO_PASSWORD=your-secure-password-here

# Backend URL for frontend
BACKEND_URL=http://localhost:8002

# Database name
DB_NAME=cooking_sync
```

### Port Configuration

Default ports:
- **Frontend**: 3001
- **Backend**: 8002
- **MongoDB**: 27017 (internal only)

To change ports, edit `docker-compose.yml`:

```yaml
services:
  frontend:
    ports:
      - "YOUR_PORT:80"
  backend:
    ports:
      - "YOUR_PORT:8002"
```

### Health Checks

```bash
# Check all services
docker-compose ps

# Frontend health
curl http://localhost:3001/health

# Backend health
curl http://localhost:8002/api/
```

### Production Deployment

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed instructions on:
- Proxmox deployment
- Nginx reverse proxy setup
- SSL/HTTPS configuration
- Backup and restore procedures
- Monitoring and maintenance

---

## 🏗️ Development Setup

### Prerequisites
- Node.js 18+
- Python 3.11+
- MongoDB (local or Docker)
- Yarn package manager

### Frontend Development

```bash
cd frontend
yarn install
yarn start
```

The app will open at http://localhost:3000

### Backend Development

```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

API will be available at http://localhost:8001

### Environment Variables (Development)

**Backend** (`backend/.env`):
```bash
MONGO_URL=mongodb://localhost:27017
DB_NAME=cooking_sync
CORS_ORIGINS=*
```

**Frontend** (`frontend/.env`):
```bash
REACT_APP_BACKEND_URL=http://localhost:8001
```

---

## 📐 Project Structure

```
smart-cooking-sync/
├── backend/
│   ├── server.py              # FastAPI application
│   ├── requirements.txt       # Python dependencies
│   └── .env                   # Backend environment variables
├── frontend/
│   ├── public/
│   │   ├── index.html         # Main HTML file
│   │   ├── manifest.json      # PWA manifest
│   │   └── icon-*.png         # App icons
│   ├── src/
│   │   ├── App.js             # Main React component
│   │   ├── pages/
│   │   │   └── CookingSync.jsx  # Main app logic
│   │   ├── services/
│   │   │   └── api.js         # API client
│   │   ├── components/        # UI components (shadcn)
│   │   └── hooks/             # React hooks
│   ├── package.json           # Node dependencies
│   └── .env                   # Frontend environment variables
├── docker-compose.yml         # Multi-container setup
├── Dockerfile.backend         # Backend container build
├── Dockerfile.frontend        # Frontend container build
├── nginx.conf                 # Nginx configuration
├── deploy.sh                  # Deployment helper script
├── .env.example               # Environment template
├── README.md                  # This file
├── DEPLOYMENT_GUIDE.md        # Detailed deployment instructions
└── PORT_CHANGES.md            # Port configuration notes
```

---

## 🧪 Testing

The application includes comprehensive test coverage:

### Backend Tests
```bash
# Run backend tests (if test file exists)
cd backend
pytest
```

### Frontend Tests
```bash
cd frontend
yarn test
```

### End-to-End Testing
Manual E2E test scenarios are documented in `test_result.md`

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development Guidelines
- Follow existing code style
- Add comments for complex logic
- Update documentation for new features
- Test thoroughly before submitting
- Use British English spelling in UI text

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgements

- **React** - UI framework
- **FastAPI** - Backend framework
- **Shadcn UI** - Component library
- **Tailwind CSS** - Styling framework
- **MongoDB** - Database
- **Docker** - Containerisation platform

---

## 📧 Contact & Support

- **Issues**: [GitHub Issues](https://github.com/Zaibatsui/smart-cooking-sync/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Zaibatsui/smart-cooking-sync/discussions)

---

## 🗺️ Roadmap

Potential future features:
- [ ] Recipe integration (import from URLs)
- [ ] Multi-user support with accounts
- [ ] Meal planning calendar
- [ ] Ingredient shopping list generation
- [ ] Voice control integration
- [ ] Smart device integration (Alexa, Google Home)
- [ ] Recipe sharing community
- [ ] Nutrition information
- [ ] Cost estimation

---

## ⭐ Star History

If you find this project useful, please consider giving it a star on GitHub!

---

**Happy Cooking! 👨‍🍳👩‍🍳**

Made with ❤️ for home cooks who want perfectly coordinated meals.
