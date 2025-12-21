from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from jose import JWTError, jwt
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# JWT Configuration
JWT_SECRET = os.getenv('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')
JWT_EXPIRATION_HOURS = int(os.getenv('JWT_EXPIRATION_HOURS', '720'))

# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET')

# Security
security = HTTPBearer()

# JWT Helper Functions
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

# Dependency to get current user from JWT
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    payload = verify_token(token)
    return payload

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Cooking Sync Models
class Instruction(BaseModel):
    label: str
    afterMinutes: int  # Minutes after dish starts cooking

class DishCreate(BaseModel):
    name: str
    cookingMethod: str = "Oven"  # Oven, Air Fryer, or Microwave
    temperature: Optional[float] = None  # Temperature in Celsius (not needed for Microwave)
    unit: str = "C"  # Original unit (C or F)
    cookingTime: int  # Cooking time in minutes
    ovenType: Optional[str] = None  # Fan, Electric, Gas (not needed for Microwave)
    instructions: List[Instruction] = []  # Optional cooking instructions
    convertedFromOven: bool = False  # For Air Fryer: was it converted from oven settings
    originalOvenTemp: Optional[float] = None  # Original oven temp if converted
    originalOvenTime: Optional[int] = None  # Original oven time if converted
    sourceOvenType: Optional[str] = None  # Source oven type when converting to Air Fryer (Fan, Electric, Gas)
    # userId will be added by the backend from the JWT token


class Dish(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    userId: str  # Owner of this dish
    name: str
    cookingMethod: str = "Oven"
    temperature: Optional[float] = None
    unit: str = "C"
    cookingTime: int
    ovenType: Optional[str] = None
    instructions: List[Instruction] = []
    convertedFromOven: bool = False
    originalOvenTemp: Optional[float] = None
    originalOvenTime: Optional[int] = None
    sourceOvenType: Optional[str] = None  # Source oven type when converting to Air Fryer (Fan, Electric, Gas)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Task Models
class TaskCreate(BaseModel):
    name: str
    duration: Optional[int] = None  # Duration in minutes (for duration tasks)
    afterMinutes: Optional[int] = None  # Trigger time in minutes (for trigger tasks)
    taskType: str = "duration"  # "duration" or "trigger"
    instructions: List[Instruction] = []
    # userId will be added by the backend from the JWT token

class Task(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    userId: str  # Owner of this task
    name: str
    duration: Optional[int] = None
    afterMinutes: Optional[int] = None
    taskType: str = "duration"
    instructions: List[Instruction] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CookingPlanRequest(BaseModel):
    user_oven_type: str  # The user's actual oven type


class AdjustedDish(BaseModel):
    id: str
    name: str
    originalTemp: Optional[float]  # None for Microwave
    adjustedTemp: Optional[float]  # None for Microwave
    originalTime: int
    adjustedTime: int
    order: int

class TimelineItem(BaseModel):
    id: str
    type: str  # "dish" or "instruction"
    name: str
    parentDishId: Optional[str] = None  # For instructions, reference to parent dish
    adjustedTime: int  # Time when this should trigger
    startDelay: int  # When to start countdown (for dishes) or when to trigger (for instructions)
    originalTime: Optional[int] = None
    order: int

class CookingPlanResponse(BaseModel):
    optimal_temp: float  # Main/oven temp for backwards compatibility
    optimal_oven_temp: Optional[float] = None  # Specific oven temp
    optimal_airfryer_temp: Optional[float] = None  # Specific air fryer temp
    adjusted_dishes: List[AdjustedDish]
    timeline: List[TimelineItem]  # Expanded timeline with dishes and instructions
    total_time: int

class StatusCheckCreate(BaseModel):
    client_name: str


# Helper functions for temperature conversion and adjustment
def normalize_to_fan(temp_celsius: float, oven_type: str) -> float:
    """Normalize temperature to Fan oven equivalent"""
    if oven_type == "Fan":
        return temp_celsius
    elif oven_type == "Electric":
        return temp_celsius - 20
    elif oven_type == "Gas":
        # Approximate conversion from gas marks to Celsius, then to Fan
        return temp_celsius - 20
    return temp_celsius


def adjust_cooking_time(original_time: int, original_temp: float, new_temp: float) -> int:
    """Adjust cooking time based on temperature difference"""
    if original_temp == 0:
        return original_time
    
    # Time adjustment is inversely proportional to temperature
    # Higher temp = shorter time, lower temp = longer time
    time_factor = original_temp / new_temp if new_temp != 0 else 1
    adjusted_time = int(original_time * time_factor)
    
    return max(1, adjusted_time)  # Ensure at least 1 minute


def round_to_nearest_ten(value: float) -> float:
    """Round to nearest 10"""
    return round(value / 10) * 10


# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Smart Cooking Sync API"}


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks


# Dishes CRUD endpoints
@api_router.post("/dishes", response_model=Dish)
async def create_dish(dish_data: DishCreate):
    """Add a new dish"""
    dish_obj = Dish(**dish_data.model_dump())
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = dish_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.dishes.insert_one(doc)
    return dish_obj


@api_router.get("/dishes", response_model=List[Dish])
async def get_dishes():
    """Retrieve all dishes"""
    dishes = await db.dishes.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for dish in dishes:
        if isinstance(dish.get('created_at'), str):
            dish['created_at'] = datetime.fromisoformat(dish['created_at'])
    
    return dishes


@api_router.delete("/dishes/{dish_id}")
async def delete_dish(dish_id: str):
    """Delete a specific dish"""
    result = await db.dishes.delete_one({"id": dish_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Dish not found")
    
    return {"message": "Dish deleted successfully", "id": dish_id}


@api_router.patch("/dishes/{dish_id}")
async def update_dish_time(dish_id: str, cookingTime: int):
    """Update the cooking time for a specific dish"""
    if cookingTime < 1:
        raise HTTPException(status_code=400, detail="Cooking time must be at least 1 minute")
    
    result = await db.dishes.update_one(
        {"id": dish_id},
        {"$set": {"cookingTime": cookingTime}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Dish not found")
    
    # Fetch the updated dish
    dish = await db.dishes.find_one({"id": dish_id}, {"_id": 0})
    if dish and isinstance(dish.get('created_at'), str):
        dish['created_at'] = datetime.fromisoformat(dish['created_at'])
    
    return dish


@api_router.delete("/dishes")
async def clear_all_dishes():
    """Clear all dishes and tasks"""
    dishes_result = await db.dishes.delete_many({})
    tasks_result = await db.tasks.delete_many({})
    return {
        "message": "All dishes and tasks cleared", 
        "dishes_deleted": dishes_result.deleted_count,
        "tasks_deleted": tasks_result.deleted_count
    }


# Task Endpoints
@api_router.post("/tasks", response_model=Task)
async def create_task(task: TaskCreate):
    """Create a new task"""
    task_dict = task.model_dump()
    task_dict['id'] = str(uuid.uuid4())
    task_dict['created_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.tasks.insert_one(task_dict)
    return Task(**task_dict)

@api_router.get("/tasks", response_model=List[Task])
async def get_all_tasks():
    """Get all tasks"""
    tasks = await db.tasks.find({}, {"_id": 0}).to_list(1000)
    return [Task(**task) for task in tasks]

@api_router.get("/tasks/{task_id}", response_model=Task)
async def get_task(task_id: str):
    """Get a specific task"""
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return Task(**task)

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
    """Delete a specific task"""
    result = await db.tasks.delete_one({"id": task_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted successfully"}

@api_router.delete("/tasks")
async def clear_all_tasks():
    """Clear all tasks"""
    result = await db.tasks.delete_many({})
    return {"message": "All tasks cleared", "deleted_count": result.deleted_count}


@api_router.post("/cooking-plan/calculate", response_model=CookingPlanResponse)
async def calculate_cooking_plan(request: CookingPlanRequest):
    """Calculate optimal cooking plan based on user's oven type and multiple cooking methods"""
    
    # Fetch all dishes
    dishes = await db.dishes.find({}, {"_id": 0}).to_list(1000)
    
    if not dishes:
        raise HTTPException(status_code=400, detail="No dishes found")
    
    # Separate dishes by cooking method
    oven_dishes = [d for d in dishes if d.get('cookingMethod', 'Oven') == 'Oven']
    airfryer_dishes = [d for d in dishes if d.get('cookingMethod') == 'Air Fryer']
    microwave_dishes = [d for d in dishes if d.get('cookingMethod') == 'Microwave']
    
    # Calculate optimal temperature for OVEN dishes
    optimal_oven_temp = None
    if oven_dishes:
        normalized_temps = []
        for dish in oven_dishes:
            normalized_temp = normalize_to_fan(dish['temperature'], dish.get('ovenType', 'Fan'))
            normalized_temps.append(normalized_temp)
        
        avg_temp = sum(normalized_temps) / len(normalized_temps)
        optimal_fan_temp = round_to_nearest_ten(avg_temp)
        
        # Convert to user's oven type
        user_oven_type = request.user_oven_type
        if user_oven_type == "Fan":
            optimal_oven_temp = optimal_fan_temp
        elif user_oven_type in ["Electric", "Gas"]:
            optimal_oven_temp = optimal_fan_temp + 20
        else:
            optimal_oven_temp = optimal_fan_temp
        
        optimal_oven_temp = round_to_nearest_ten(optimal_oven_temp)
    
    # Calculate optimal temperature for AIR FRYER dishes
    optimal_airfryer_temp = None
    if airfryer_dishes:
        temps = [d['temperature'] for d in airfryer_dishes if d.get('temperature')]
        if temps:
            avg_airfryer_temp = sum(temps) / len(temps)
            optimal_airfryer_temp = round_to_nearest_ten(avg_airfryer_temp)
    
    # Use oven temp as the main optimal temp (for backwards compatibility)
    optimal_temp = optimal_oven_temp or optimal_airfryer_temp or 180
    
    # Calculate adjusted times and order dishes
    adjusted_dishes = []
    
    # Process oven dishes
    for dish in oven_dishes:
        original_temp = dish['temperature']
        original_time = dish['cookingTime']
        adjusted_time = adjust_cooking_time(original_time, original_temp, optimal_oven_temp) if optimal_oven_temp else original_time
        
        adjusted_dishes.append({
            "id": dish['id'],
            "name": dish['name'],
            "originalTemp": original_temp,
            "adjustedTemp": optimal_oven_temp,
            "originalTime": original_time,
            "adjustedTime": adjusted_time,
            "order": len(adjusted_dishes) + 1
        })
    
    # Process air fryer dishes
    for dish in airfryer_dishes:
        original_temp = dish.get('temperature', 180)
        original_time = dish['cookingTime']
        adjusted_time = adjust_cooking_time(original_time, original_temp, optimal_airfryer_temp) if optimal_airfryer_temp else original_time
        
        adjusted_dishes.append({
            "id": dish['id'],
            "name": dish['name'],
            "originalTemp": original_temp,
            "adjustedTemp": optimal_airfryer_temp,
            "originalTime": original_time,
            "adjustedTime": adjusted_time,
            "order": len(adjusted_dishes) + 1
        })
    
    # Process microwave dishes (no temp adjustment)
    for dish in microwave_dishes:
        adjusted_dishes.append({
            "id": dish['id'],
            "name": dish['name'],
            "originalTemp": None,
            "adjustedTemp": None,
            "originalTime": dish['cookingTime'],
            "adjustedTime": dish['cookingTime'],
            "order": len(adjusted_dishes) + 1
        })
    
    # Sort by adjusted time (longest first)
    adjusted_dishes.sort(key=lambda x: x['adjustedTime'], reverse=True)
    
    # Update order after sorting
    for idx, dish in enumerate(adjusted_dishes):
        dish['order'] = idx + 1
    
    total_time = max(d['adjustedTime'] for d in adjusted_dishes) if adjusted_dishes else 0
    
    # Build timeline with dishes and instructions
    timeline = []
    timeline_order = 1
    
    for dish_data in adjusted_dishes:
        dish_id = dish_data['id']
        adjusted_time = dish_data['adjustedTime']
        start_delay = total_time - adjusted_time
        
        # Find original dish to get instructions
        original_dish = next((d for d in dishes if d['id'] == dish_id), None)
        
        # Add dish to timeline
        timeline.append({
            "id": dish_id,
            "type": "dish",
            "name": dish_data['name'],
            "parentDishId": None,
            "adjustedTime": adjusted_time,
            "startDelay": start_delay,
            "originalTime": dish_data['originalTime'],
            "order": timeline_order
        })
        timeline_order += 1
        
        # Add instructions for this dish
        if original_dish and original_dish.get('instructions'):
            dish_name = original_dish.get('name', 'Dish')
            dish_finish_time = start_delay + adjusted_time  # When the parent dish finishes cooking
            
            for instruction in original_dish['instructions']:
                # Instruction triggers at: dish_start_time + instruction.afterMinutes
                # In timeline: instruction_delay = start_delay + instruction.afterMinutes
                instruction_delay = start_delay + instruction['afterMinutes']
                
                # Instruction timer should count until parent dish finishes
                instruction_time = dish_finish_time - instruction_delay
                
                timeline.append({
                    "id": f"{dish_id}_instruction_{instruction['afterMinutes']}",
                    "type": "instruction",
                    "name": f"{dish_name} - {instruction['label']}",
                    "parentDishId": dish_id,
                    "parentName": dish_name,
                    "adjustedTime": instruction_time if instruction_time > 0 else 0,
                    "startDelay": instruction_delay,
                    "originalTime": None,
                    "order": timeline_order
                })
                timeline_order += 1
    
    # Sort timeline by startDelay (earliest first)
    timeline.sort(key=lambda x: x['startDelay'])
    
    # Update order after sorting
    for idx, item in enumerate(timeline):
        item['order'] = idx + 1
    
    return {
        "optimal_temp": optimal_temp,
        "optimal_oven_temp": optimal_oven_temp,
        "optimal_airfryer_temp": optimal_airfryer_temp,
        "adjusted_dishes": adjusted_dishes,
        "timeline": timeline,
        "total_time": total_time
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()