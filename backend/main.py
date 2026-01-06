"""
RemindAR Backend - FastAPI Server
Main entry point for the AR memory assistant backend.

Handles:
- WebSocket connections for real-time face data
- Face recognition pipeline
- Identity + memory context responses
"""

import json
import asyncio
from typing import Dict, Set
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from models import (
    Person, 
    PersonCreate, 
    FaceData, 
    RecognitionResult,
    WebSocketMessage
)
from database import (
    init_database, 
    seed_demo_data, 
    add_person, 
    get_all_people,
    get_person,
    update_embedding,
    delete_person
)
from face_recognition import get_recognizer


# ============================================================================
# Application Lifecycle
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application startup and shutdown handler.
    Initializes database and face recognition model.
    """
    print("[Server] Starting RemindAR backend...")
    
    # Initialize database (already done on import, but explicit is good)
    init_database()
    
    # Seed demo data if needed
    people = get_all_people()
    if len(people) == 0:
        print("[Server] No people found, seeding demo data...")
        seed_demo_data()
    else:
        print(f"[Server] Found {len(people)} people in database")
    
    # Pre-initialize face recognizer (triggers model download if needed)
    print("[Server] Initializing face recognition model...")
    recognizer = get_recognizer()
    print("[Server] Backend ready!")
    
    yield
    
    print("[Server] Shutting down...")


# ============================================================================
# FastAPI Application
# ============================================================================

app = FastAPI(
    title="RemindAR API",
    description="AI-powered AR memory assistant backend",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for hackathon
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# WebSocket Connection Manager
# ============================================================================

class ConnectionManager:
    """
    Manages active WebSocket connections.
    Supports multiple simultaneous clients (e.g., multiple AR glasses).
    """
    
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        print(f"[WS] Client connected. Total: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        print(f"[WS] Client disconnected. Total: {len(self.active_connections)}")
    
    async def send_json(self, websocket: WebSocket, data: dict):
        try:
            await websocket.send_json(data)
        except Exception as e:
            print(f"[WS] Send error: {e}")


manager = ConnectionManager()


# ============================================================================
# Helper Functions
# ============================================================================

def format_display_lines(person: dict, is_known: bool, confidence: float) -> list:
    """
    Format the display lines for AR overlay.
    Maximum 3 lines, calm and clear formatting.
    """
    if not is_known:
        return [
            "New Person",
            "Not yet recognized",
            ""
        ]
    
    # Format for known person
    lines = [
        person.get("name", "Unknown"),
        person.get("relation", ""),
        person.get("context", "")[:50]  # Truncate long context
    ]
    
    return lines


def build_recognition_result(
    track_id: str,
    person: dict | None,
    confidence: float
) -> dict:
    """Build the recognition result response."""
    is_known = person is not None
    
    result = RecognitionResult(
        track_id=track_id,
        is_known=is_known,
        confidence=confidence,
        person=Person(**person) if person else None,
        display_lines=format_display_lines(person, is_known, confidence)
    )
    
    return result.model_dump()


# ============================================================================
# WebSocket Endpoint
# ============================================================================

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Main WebSocket endpoint for real-time face recognition.
    
    Protocol:
    - Client sends: {"type": "face_data", "data": {...}}
    - Server responds: {"type": "recognition_result", "data": {...}}
    """
    await manager.connect(websocket)
    recognizer = get_recognizer()
    
    try:
        while True:
            # Receive message
            raw_message = await websocket.receive_text()
            
            try:
                message = json.loads(raw_message)
            except json.JSONDecodeError:
                continue
            
            msg_type = message.get("type")
            data = message.get("data", {})
            
            # Handle different message types
            if msg_type == "ping":
                await manager.send_json(websocket, {"type": "pong"})
                
            elif msg_type == "face_data":
                # Process face recognition
                track_id = data.get("track_id", "unknown")
                image_base64 = data.get("image_base64", "")
                
                if not image_base64:
                    continue
                
                # Run recognition
                person, confidence, embedding = recognizer.recognize(image_base64)
                
                # Build and send result
                result = build_recognition_result(track_id, person, confidence)
                
                await manager.send_json(websocket, {
                    "type": "recognition_result",
                    "data": result
                })
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"[WS] Error: {e}")
        manager.disconnect(websocket)


# ============================================================================
# REST API Endpoints
# ============================================================================

@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "RemindAR API"}


@app.get("/health")
async def health():
    """Detailed health check."""
    recognizer = get_recognizer()
    return {
        "status": "healthy",
        "model_loaded": recognizer.model is not None,
        "people_count": len(get_all_people())
    }


@app.get("/people", response_model=list[Person])
async def list_people():
    """Get all known people."""
    return get_all_people()


@app.get("/people/{person_id}", response_model=Person)
async def get_person_by_id(person_id: str):
    """Get a specific person by ID."""
    person = get_person(person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    return person


@app.post("/people", response_model=Person)
async def create_person(person: PersonCreate):
    """
    Create a new person entry.
    Note: Embedding must be added separately via /register-face endpoint.
    """
    import uuid
    person_id = f"person_{uuid.uuid4().hex[:8]}"
    
    success = add_person(
        person_id=person_id,
        name=person.name,
        relation=person.relation,
        last_met=person.last_met,
        context=person.context
    )
    
    if not success:
        raise HTTPException(status_code=400, detail="Failed to create person")
    
    return get_person(person_id)


@app.post("/register-face/{person_id}")
async def register_face(person_id: str, face_data: FaceData):
    """
    Register a face embedding for an existing person.
    Used to add face recognition capability for a person.
    """
    person = get_person(person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    
    recognizer = get_recognizer()
    embedding = recognizer.get_embedding_from_base64(face_data.image_base64)
    
    if embedding is None:
        raise HTTPException(status_code=400, detail="Could not extract face embedding")
    
    success = update_embedding(person_id, embedding)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update embedding")
    
    return {"status": "success", "person_id": person_id}


@app.delete("/people/{person_id}")
async def remove_person(person_id: str):
    """Delete a person from the database."""
    success = delete_person(person_id)
    if not success:
        raise HTTPException(status_code=404, detail="Person not found")
    return {"status": "deleted", "person_id": person_id}


# ============================================================================
# Development Server
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
