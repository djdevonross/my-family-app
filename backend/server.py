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

class Contact(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    relation: str  # Mãe, Pai, Médico, Escola, etc.
    phone_number: str
    contact_type: str = "personal"  # personal, family
    is_favorite: bool = False
    is_sos_priority: bool = False
    user_id: str  # owner of the contact
    created_by_name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ContactCreate(BaseModel):
    name: str
    relation: str
    phone_number: str
    contact_type: str = "personal"
    is_favorite: bool = False
    is_sos_priority: bool = False

class ContactUpdate(BaseModel):
    name: Optional[str] = None
    relation: Optional[str] = None
    phone_number: Optional[str] = None
    contact_type: Optional[str] = None
    is_favorite: Optional[bool] = None
    is_sos_priority: Optional[bool] = None

class SOSAlert(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_name: str
    user_avatar: str
    date_time: datetime = Field(default_factory=datetime.utcnow)
    confirmed: bool = True
    status: str = "active"  # active, resolved, cancelled
    contacts_notified: List[dict] = []
    message: str = ""
    location: Optional[dict] = None  # {lat, lng, accuracy}
    device_id: Optional[str] = None
    reason: Optional[str] = None
    cancelled_at: Optional[datetime] = None

class SOSAlertCreate(BaseModel):
    message: Optional[str] = ""
    location: Optional[dict] = None
    device_id: Optional[str] = None
    reason: Optional[str] = None

class SOSAlertUpdate(BaseModel):
    status: Optional[str] = None
    message: Optional[str] = None

class Notification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    recipient_id: str  # user who receives the notification
    sender_id: Optional[str] = None  # user who triggered the notification (if applicable)
    sender_name: Optional[str] = None
    type: str  # calendar, chat, notes, tasks, sos, contacts, general
    title: str
    message: str
    icon: str = "🔔"  # emoji icon for the notification
    module_icon: str = "📱"  # icon of the originating module
    is_read: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    read_at: Optional[datetime] = None
    data: Optional[dict] = None  # additional data (e.g., event_id, task_id, etc.)

class NotificationCreate(BaseModel):
    recipient_id: Optional[str] = None  # if None, send to all family members
    sender_id: Optional[str] = None
    sender_name: Optional[str] = None
    type: str
    title: str
    message: str
    icon: str = "🔔"
    module_icon: str = "📱"
    data: Optional[dict] = None

class NotificationUpdate(BaseModel):
    is_read: Optional[bool] = None

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
    
    # Create notification for all family members
    try:
        notification_data = NotificationCreate(
            type="calendar",
            title="Novo evento no calendário",
            message=f"{current_user.name} criou o evento '{event.title}' para {event.date.strftime('%d/%m/%Y às %H:%M')}",
            icon="📅",
            module_icon="📅",
            sender_id=current_user.id,
            sender_name=current_user.name,
            data={"event_id": event.id, "event_title": event.title}
        )
        await create_notification(notification_data)
    except Exception as e:
        print(f"Error creating notification: {e}")
        # Continue execution even if notification fails
    
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
    
    # Create notification for all family members
    try:
        notification_data = NotificationCreate(
            type="notes",
            title="Nova nota partilhada",
            message=f"{current_user.name} adicionou uma nova nota: '{note.title}'",
            icon="📝",
            module_icon="📝",
            sender_id=current_user.id,
            sender_name=current_user.name,
            data={"note_id": note.id, "note_title": note.title}
        )
        await create_notification(notification_data)
    except Exception as e:
        print(f"Error creating note notification: {e}")
        # Continue execution even if notification fails
    
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
    
    # Create notification for all family members except the sender
    try:
        # Send notification to all users except the sender
        users = await db.users.find().to_list(5)
        for user_data in users:
            if user_data["id"] != current_user.id:  # Don't notify the sender
                notification = Notification(
                    recipient_id=user_data["id"],
                    type="chat",
                    title="Nova mensagem no chat",
                    message=f"{current_user.name}: {message.message[:50]}{'...' if len(message.message) > 50 else ''}",
                    icon="💬",
                    module_icon="💬",
                    sender_id=current_user.id,
                    sender_name=current_user.name,
                    data={"message_id": message.id}
                )
                await db.notifications.insert_one(notification.dict())
    except Exception as e:
        print(f"Error creating chat notification: {e}")
        # Continue execution even if notification fails
    
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
    
    # Create notification for all family members
    try:
        notification_data = NotificationCreate(
            type="tasks",
            title="Nova tarefa atribuída",
            message=f"{current_user.name} criou a tarefa '{task.title}' para {task.responsible_name}",
            icon="✅",
            module_icon="✅",
            sender_id=current_user.id,
            sender_name=current_user.name,
            data={"task_id": task.id, "task_title": task.title}
        )
        await create_notification(notification_data)
    except Exception as e:
        print(f"Error creating task notification: {e}")
        # Continue execution even if notification fails
    
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

# Contacts routes
@api_router.post("/contacts", response_model=Contact)
async def create_contact(contact_data: ContactCreate, current_user: User = Depends(get_current_user)):
    contact = Contact(
        **contact_data.dict(),
        user_id=current_user.id,
        created_by_name=current_user.name
    )
    await db.contacts.insert_one(contact.dict())
    return contact

@api_router.get("/contacts", response_model=List[Contact])
async def get_contacts(
    contact_type: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    # Get personal contacts + family contacts
    query = {
        "$or": [
            {"user_id": current_user.id},  # Personal contacts
            {"contact_type": "family"}     # Family contacts visible to all
        ]
    }
    
    if contact_type:
        query["contact_type"] = contact_type
    
    contacts = await db.contacts.find(query).sort([
        ("is_favorite", -1),      # Favorites first
        ("contact_type", 1),      # Family contacts first
        ("name", 1)               # Then alphabetical
    ]).to_list(1000)
    
    return [Contact(**contact) for contact in contacts]

@api_router.put("/contacts/{contact_id}", response_model=Contact)
async def update_contact(contact_id: str, contact_data: ContactUpdate, current_user: User = Depends(get_current_user)):
    # Check if user owns the contact or if it's a family contact and user is admin
    existing_contact = await db.contacts.find_one({"id": contact_id})
    if not existing_contact:
        raise HTTPException(status_code=404, detail="Contacto não encontrado")
    
    # Only owner or admin (for family contacts) can edit
    if existing_contact["user_id"] != current_user.id:
        if not (existing_contact["contact_type"] == "family" and current_user.is_admin):
            raise HTTPException(status_code=403, detail="Não tem permissão para editar este contacto")
    
    update_data = {k: v for k, v in contact_data.dict().items() if v is not None}
    await db.contacts.update_one({"id": contact_id}, {"$set": update_data})
    
    updated_contact = await db.contacts.find_one({"id": contact_id})
    return Contact(**updated_contact)

@api_router.delete("/contacts/{contact_id}")
async def delete_contact(contact_id: str, current_user: User = Depends(get_current_user)):
    # Check if user owns the contact or if it's a family contact and user is admin
    existing_contact = await db.contacts.find_one({"id": contact_id})
    if not existing_contact:
        raise HTTPException(status_code=404, detail="Contacto não encontrado")
    
    # Only owner or admin (for family contacts) can delete
    if existing_contact["user_id"] != current_user.id:
        if not (existing_contact["contact_type"] == "family" and current_user.is_admin):
            raise HTTPException(status_code=403, detail="Não tem permissão para eliminar este contacto")
    
    result = await db.contacts.delete_one({"id": contact_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contacto não encontrado")
    return {"message": "Contacto eliminado"}

@api_router.get("/contacts/sos")
async def get_sos_contacts(current_user: User = Depends(get_current_user)):
    # Get SOS priority contacts for current user and family
    query = {
        "$or": [
            {"user_id": current_user.id, "is_sos_priority": True},
            {"contact_type": "family", "is_sos_priority": True}
        ]
    }
    
    contacts = await db.contacts.find(query).sort("name", 1).to_list(100)
    return [Contact(**contact) for contact in contacts]

# SOS Emergency routes
@api_router.post("/sos/alert", response_model=SOSAlert)
async def create_sos_alert(alert_data: SOSAlertCreate, current_user: User = Depends(get_current_user)):
    # Create SOS alert
    sos_alert = SOSAlert(
        user_id=current_user.id,
        user_name=current_user.name,
        user_avatar=current_user.avatar,
        **alert_data.dict()
    )
    
    # Get SOS priority contacts
    sos_contacts_query = {
        "$or": [
            {"user_id": current_user.id, "is_sos_priority": True},
            {"contact_type": "family", "is_sos_priority": True}
        ]
    }
    sos_contacts = await db.contacts.find(sos_contacts_query).to_list(100)
    
    # Prepare contacts notification list
    contacts_notified = []
    for contact in sos_contacts:
        contacts_notified.append({
            "name": contact["name"],
            "phone_number": contact["phone_number"],
            "relation": contact["relation"],
            "notification_sent": True,  # In real implementation, this would depend on actual SMS/call success
            "method": "sms",
            "timestamp": datetime.utcnow().isoformat()
        })
    
    sos_alert.contacts_notified = contacts_notified
    
    # Save alert to database
    await db.sos_alerts.insert_one(sos_alert.dict())
    
    # Create automatic chat message
    emergency_message = {
        "message": f"🚨 Emergência – Preciso de ajuda! {current_user.name} acionou o SOS às {format(sos_alert.date_time, '%H:%M')}.",
        "created_by": "system",
        "created_by_name": "Sistema SOS",
        "created_by_avatar": "🚨",
        "created_at": datetime.utcnow()
    }
    
    # Insert emergency message into chat
    chat_message = ChatMessage(
        id=str(uuid.uuid4()),
        **emergency_message
    )
    await db.chat_messages.insert_one(chat_message.dict())
    
    return sos_alert

@api_router.put("/sos/alert/{alert_id}/cancel", response_model=SOSAlert)
async def cancel_sos_alert(alert_id: str, current_user: User = Depends(get_current_user)):
    # Find the alert
    existing_alert = await db.sos_alerts.find_one({"id": alert_id})
    if not existing_alert:
        raise HTTPException(status_code=404, detail="Alerta SOS não encontrado")
    
    # Check if user owns the alert
    if existing_alert["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Não tem permissão para cancelar este alerta")
    
    # Update alert status
    update_data = {
        "status": "cancelled",
        "cancelled_at": datetime.utcnow()
    }
    await db.sos_alerts.update_one({"id": alert_id}, {"$set": update_data})
    
    # Create cancellation message in chat
    cancellation_message = {
        "message": f"✅ Alerta SOS cancelado por {current_user.name} às {format(datetime.utcnow(), '%H:%M')}. Emergência resolvida.",
        "created_by": "system",
        "created_by_name": "Sistema SOS",
        "created_by_avatar": "✅",
        "created_at": datetime.utcnow()
    }
    
    chat_message = ChatMessage(
        id=str(uuid.uuid4()),
        **cancellation_message
    )
    await db.chat_messages.insert_one(chat_message.dict())
    
    # Return updated alert
    updated_alert = await db.sos_alerts.find_one({"id": alert_id})
    return SOSAlert(**updated_alert)

@api_router.get("/sos/alerts", response_model=List[SOSAlert])
async def get_sos_alerts(current_user: User = Depends(get_current_user)):
    # Get all SOS alerts (family can see all alerts for transparency)
    alerts = await db.sos_alerts.find().sort("date_time", -1).limit(50).to_list(50)
    return [SOSAlert(**alert) for alert in alerts]

@api_router.get("/sos/alerts/active", response_model=List[SOSAlert])
async def get_active_sos_alerts(current_user: User = Depends(get_current_user)):
    # Get only active SOS alerts
    alerts = await db.sos_alerts.find({"status": "active"}).sort("date_time", -1).to_list(10)
    return [SOSAlert(**alert) for alert in alerts]

@api_router.put("/sos/alert/{alert_id}/resolve", response_model=SOSAlert)
async def resolve_sos_alert(alert_id: str, current_user: User = Depends(get_current_user)):
    # Find the alert
    existing_alert = await db.sos_alerts.find_one({"id": alert_id})
    if not existing_alert:
        raise HTTPException(status_code=404, detail="Alerta SOS não encontrado")
    
    # Update alert status to resolved
    update_data = {
        "status": "resolved"
    }
    await db.sos_alerts.update_one({"id": alert_id}, {"$set": update_data})
    
    # Create resolution message in chat
    resolution_message = {
        "message": f"✅ Alerta SOS resolvido por {current_user.name} às {format(datetime.utcnow(), '%H:%M')}. Emergência atendida.",
        "created_by": "system", 
        "created_by_name": "Sistema SOS",
        "created_by_avatar": "✅",
        "created_at": datetime.utcnow()
    }
    
    chat_message = ChatMessage(
        id=str(uuid.uuid4()),
        **resolution_message
    )
    await db.chat_messages.insert_one(chat_message.dict())
    
    # Return updated alert
    updated_alert = await db.sos_alerts.find_one({"id": alert_id})
    return SOSAlert(**updated_alert)

# Helper function to create notifications
async def create_notification(notification_data: NotificationCreate):
    """Helper function to create notifications for family members"""
    if notification_data.recipient_id:
        # Send to specific user
        notification_dict = {
            "recipient_id": notification_data.recipient_id,
            "sender_id": notification_data.sender_id,
            "sender_name": notification_data.sender_name,
            "type": notification_data.type,
            "title": notification_data.title,
            "message": notification_data.message,
            "icon": notification_data.icon,
            "module_icon": notification_data.module_icon,
            "data": notification_data.data,
            "is_read": False,
            "created_at": datetime.utcnow()
        }
        notification = Notification(**notification_dict)
        await db.notifications.insert_one(notification.dict())
    else:
        # Send to all family members
        users = await db.users.find().to_list(5)
        for user_data in users:
            notification_dict = {
                "recipient_id": user_data["id"],
                "sender_id": notification_data.sender_id,
                "sender_name": notification_data.sender_name,
                "type": notification_data.type,
                "title": notification_data.title,
                "message": notification_data.message,
                "icon": notification_data.icon,
                "module_icon": notification_data.module_icon,
                "data": notification_data.data,
                "is_read": False,
                "created_at": datetime.utcnow()
            }
            notification = Notification(**notification_dict)
            await db.notifications.insert_one(notification.dict())

# Notifications routes
@api_router.post("/notifications", response_model=Notification)
async def create_notification_endpoint(notification_data: NotificationCreate, current_user: User = Depends(get_current_user)):
    await create_notification(notification_data)
    return {"message": "Notification created successfully"}

@api_router.get("/notifications", response_model=List[Notification])
async def get_notifications(
    type_filter: Optional[str] = None,
    is_read: Optional[bool] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    query = {"recipient_id": current_user.id}
    
    if type_filter:
        query["type"] = type_filter
    if is_read is not None:
        query["is_read"] = is_read
    
    notifications = await db.notifications.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    return [Notification(**notif) for notif in notifications]

@api_router.put("/notifications/{notification_id}/read", response_model=Notification)
async def mark_notification_as_read(notification_id: str, current_user: User = Depends(get_current_user)):
    # Check if user owns the notification
    existing_notification = await db.notifications.find_one({
        "id": notification_id, 
        "recipient_id": current_user.id
    })
    
    if not existing_notification:
        raise HTTPException(status_code=404, detail="Notificação não encontrada")
    
    # Mark as read
    await db.notifications.update_one(
        {"id": notification_id}, 
        {
            "$set": {
                "is_read": True,
                "read_at": datetime.utcnow()
            }
        }
    )
    
    updated_notification = await db.notifications.find_one({"id": notification_id})
    return Notification(**updated_notification)

@api_router.put("/notifications/mark-all-read")
async def mark_all_notifications_as_read(current_user: User = Depends(get_current_user)):
    result = await db.notifications.update_many(
        {"recipient_id": current_user.id, "is_read": False},
        {
            "$set": {
                "is_read": True,
                "read_at": datetime.utcnow()
            }
        }
    )
    return {"message": f"{result.modified_count} notificações marcadas como lidas"}

@api_router.delete("/notifications/clear-read")
async def clear_read_notifications(current_user: User = Depends(get_current_user)):
    result = await db.notifications.delete_many({
        "recipient_id": current_user.id,
        "is_read": True
    })
    return {"message": f"{result.deleted_count} notificações limpas"}

@api_router.get("/notifications/count")
async def get_unread_notifications_count(current_user: User = Depends(get_current_user)):
    unread_count = await db.notifications.count_documents({
        "recipient_id": current_user.id,
        "is_read": False
    })
    return {"unread_count": unread_count}

@api_router.get("/notifications/types")
async def get_notification_types():
    return {
        "types": [
            {"key": "calendar", "label": "Calendário", "icon": "📅"},
            {"key": "chat", "label": "Chat", "icon": "💬"},
            {"key": "notes", "label": "Notas", "icon": "📝"},
            {"key": "tasks", "label": "Tarefas", "icon": "✅"},
            {"key": "sos", "label": "SOS", "icon": "🚨"},
            {"key": "contacts", "label": "Contactos", "icon": "📞"},
            {"key": "general", "label": "Geral", "icon": "🔔"}
        ]
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