from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import bcrypt
from jose import JWTError, jwt
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Secret
JWT_SECRET = "my_family_secret_key_2025"
JWT_ALGORITHM = "HS256"

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Define Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    name: str
    avatar: str  # base64 encoded image
    password_hash: str
    is_admin: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserCreate(BaseModel):
    username: str
    name: str
    avatar: str
    password: str
    is_admin: bool = False

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    name: str
    avatar: str
    is_admin: bool

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class Event(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    date: datetime
    created_by: str  # user_id
    created_by_name: str
    color: str
    alert_minutes: int = 30  # minutes before event to alert
    created_at: datetime = Field(default_factory=datetime.utcnow)

class EventCreate(BaseModel):
    title: str
    description: str
    date: datetime
    color: str
    alert_minutes: int = 30

class Note(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    content: str
    images: List[str] = []  # base64 encoded images
    created_by: str  # user_id
    created_by_name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class NoteCreate(BaseModel):
    title: str
    content: str
    images: List[str] = []

class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    message: str
    created_by: str  # user_id
    created_by_name: str
    created_by_avatar: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ChatMessageCreate(BaseModel):
    message: str

class Task(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str = ""
    responsible_id: str  # user_id
    responsible_name: str
    responsible_avatar: str
    due_date: Optional[datetime] = None
    status: str = "por_fazer"  # por_fazer, em_progresso, concluida
    created_by: str  # user_id
    created_by_name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None

class TaskCreate(BaseModel):
    title: str
    description: str = ""
    responsible_id: str
    due_date: Optional[datetime] = None
    status: str = "por_fazer"

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    responsible_id: Optional[str] = None
    due_date: Optional[datetime] = None
    status: Optional[str] = None

# Basic route
@api_router.get("/")
async def root():
    return {"message": "My Family API - Bem-vindos!", "status": "running"}

# Helper functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=24)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await db.users.find_one({"id": user_id})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user)

# Initialize family users
@app.on_event("startup")
async def init_family_users():
    # Check if users exist
    user_count = await db.users.count_documents({})
    if user_count == 0:
        # Create 5 default family users with avatars
        default_users = [
            {"username": "pai", "name": "Pai", "password": "familia123", "is_admin": True, "avatar": "👨"},
            {"username": "mae", "name": "Mãe", "password": "familia123", "is_admin": True, "avatar": "👩"},
            {"username": "filho1", "name": "João", "password": "familia123", "is_admin": False, "avatar": "👦"},
            {"username": "filha1", "name": "Maria", "password": "familia123", "is_admin": False, "avatar": "👧"},
            {"username": "avo", "name": "Avó", "password": "familia123", "is_admin": False, "avatar": "👵"}
        ]
        
        for user_data in default_users:
            user = User(
                username=user_data["username"],
                name=user_data["name"],
                avatar=user_data["avatar"],
                password_hash=hash_password(user_data["password"]),
                is_admin=user_data["is_admin"]
            )
            await db.users.insert_one(user.dict())
        
        logging.info("Initialized 5 family users")

# Authentication routes
@api_router.post("/auth/login", response_model=TokenResponse)
async def login(user_login: UserLogin):
    user_data = await db.users.find_one({"username": user_login.username})
    if not user_data or not verify_password(user_login.password, user_data["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    
    user = User(**user_data)
    access_token = create_access_token(data={"sub": user.id})
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            username=user.username, 
            name=user.name,
            avatar=user.avatar,
            is_admin=user.is_admin
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        name=current_user.name,
        avatar=current_user.avatar,
        is_admin=current_user.is_admin
    )

@api_router.get("/users", response_model=List[UserResponse])
async def get_all_users(current_user: User = Depends(get_current_user)):
    users = await db.users.find().to_list(5)
    return [UserResponse(
        id=user["id"],
        username=user["username"],
        name=user["name"],
        avatar=user["avatar"],
        is_admin=user["is_admin"]
    ) for user in users]

# Events routes
@api_router.post("/events", response_model=Event)
async def create_event(event_data: EventCreate, current_user: User = Depends(get_current_user)):
    event = Event(
        **event_data.dict(),
        created_by=current_user.id,
        created_by_name=current_user.name
    )
    await db.events.insert_one(event.dict())
    return event

@api_router.get("/events", response_model=List[Event])
async def get_events(current_user: User = Depends(get_current_user)):
    events = await db.events.find().sort("date", 1).to_list(1000)
    return [Event(**event) for event in events]

@api_router.delete("/events/{event_id}")
async def delete_event(event_id: str, current_user: User = Depends(get_current_user)):
    result = await db.events.delete_one({"id": event_id, "created_by": current_user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    return {"message": "Evento eliminado"}

# Notes routes
@api_router.post("/notes", response_model=Note)
async def create_note(note_data: NoteCreate, current_user: User = Depends(get_current_user)):
    note = Note(
        **note_data.dict(),
        created_by=current_user.id,
        created_by_name=current_user.name
    )
    await db.notes.insert_one(note.dict())
    return note

@api_router.get("/notes", response_model=List[Note])
async def get_notes(current_user: User = Depends(get_current_user)):
    notes = await db.notes.find().sort("created_at", -1).to_list(1000)
    return [Note(**note) for note in notes]

# Chat routes
@api_router.get("/chat/messages", response_model=List[ChatMessage])
async def get_chat_messages(current_user: User = Depends(get_current_user)):
    messages = await db.chat_messages.find().sort("created_at", 1).limit(100).to_list(100)
    return [ChatMessage(**message) for message in messages]

@api_router.post("/chat/messages", response_model=ChatMessage)
async def create_chat_message(message_data: ChatMessageCreate, current_user: User = Depends(get_current_user)):
    message = ChatMessage(
        message=message_data.message,
        created_by=current_user.id,
        created_by_name=current_user.name,
        created_by_avatar=current_user.avatar
    )
    await db.chat_messages.insert_one(message.dict())
    return message

# Tasks routes
@api_router.post("/tasks", response_model=Task)
async def create_task(task_data: TaskCreate, current_user: User = Depends(get_current_user)):
    # Get responsible user info
    responsible_user = await db.users.find_one({"id": task_data.responsible_id})
    if not responsible_user:
        raise HTTPException(status_code=404, detail="Utilizador responsável não encontrado")
    
    task = Task(
        **task_data.dict(),
        responsible_name=responsible_user["name"],
        responsible_avatar=responsible_user["avatar"],
        created_by=current_user.id,
        created_by_name=current_user.name
    )
    await db.tasks.insert_one(task.dict())
    return task

@api_router.get("/tasks", response_model=List[Task])
async def get_tasks(
    status: Optional[str] = None,
    responsible_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = {}
    if status:
        query["status"] = status
    if responsible_id:
        query["responsible_id"] = responsible_id
    
    tasks = await db.tasks.find(query).sort("created_at", -1).to_list(1000)
    return [Task(**task) for task in tasks]

@api_router.put("/tasks/{task_id}", response_model=Task)
async def update_task(task_id: str, task_data: TaskUpdate, current_user: User = Depends(get_current_user)):
    # Find existing task
    existing_task = await db.tasks.find_one({"id": task_id})
    if not existing_task:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")
    
    update_data = {k: v for k, v in task_data.dict().items() if v is not None}
    
    # If responsible_id is being updated, get new user info
    if "responsible_id" in update_data:
        responsible_user = await db.users.find_one({"id": update_data["responsible_id"]})
        if not responsible_user:
            raise HTTPException(status_code=404, detail="Utilizador responsável não encontrado")
        update_data["responsible_name"] = responsible_user["name"]
        update_data["responsible_avatar"] = responsible_user["avatar"]
    
    # If status is being updated to completed, set completed_at
    if update_data.get("status") == "concluida":
        update_data["completed_at"] = datetime.utcnow()
    elif "status" in update_data and update_data["status"] != "concluida":
        update_data["completed_at"] = None
    
    await db.tasks.update_one({"id": task_id}, {"$set": update_data})
    
    # Return updated task
    updated_task = await db.tasks.find_one({"id": task_id})
    return Task(**updated_task)

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, current_user: User = Depends(get_current_user)):
    result = await db.tasks.delete_one({"id": task_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")
    return {"message": "Tarefa eliminada"}

@api_router.get("/tasks/stats")
async def get_task_stats(current_user: User = Depends(get_current_user)):
    total_tasks = await db.tasks.count_documents({})
    completed_tasks = await db.tasks.count_documents({"status": "concluida"})
    in_progress_tasks = await db.tasks.count_documents({"status": "em_progresso"})
    pending_tasks = await db.tasks.count_documents({"status": "por_fazer"})
    
    return {
        "total": total_tasks,
        "completed": completed_tasks,
        "in_progress": in_progress_tasks,
        "pending": pending_tasks,
        "all_completed": total_tasks > 0 and completed_tasks == total_tasks
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)