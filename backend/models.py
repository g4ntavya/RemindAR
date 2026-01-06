"""
Pydantic models for RemindAR backend.
Defines data structures for API communication.
"""

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class Person(BaseModel):
    """
    Represents a known person in the memory store.
    Contains identity and memory context for AR overlay display.
    """
    id: str
    name: str
    relation: str
    last_met: str
    context: str
    
    class Config:
        from_attributes = True


class PersonCreate(BaseModel):
    """Input model for creating a new person."""
    name: str
    relation: str
    last_met: str
    context: str


class FaceData(BaseModel):
    """
    Incoming face crop data from frontend.
    Contains base64-encoded image and tracking ID.
    """
    # Unique tracking ID for this face in the current session
    # Helps correlate faces across frames
    track_id: str
    
    # Base64-encoded JPEG image of the cropped face
    image_base64: str
    
    # Bounding box in normalized coordinates (0-1)
    bbox: Optional[dict] = None
    
    # Timestamp for latency tracking
    timestamp: Optional[float] = None


class RecognitionResult(BaseModel):
    """
    Outgoing identity response to frontend.
    Contains matched person info or unknown indicator.
    """
    # Same track_id as input for correlation
    track_id: str
    
    # Whether a known person was matched
    is_known: bool
    
    # Confidence score of the match (0-1)
    confidence: float
    
    # Person details if known, None if unknown
    person: Optional[Person] = None
    
    # Display lines for AR overlay (max 3)
    # Pre-formatted for direct display
    display_lines: List[str]


class WebSocketMessage(BaseModel):
    """
    Generic WebSocket message wrapper.
    Supports different message types for extensibility.
    """
    type: str  # "face_data", "recognition_result", "ping", "pong"
    data: Optional[dict] = None
