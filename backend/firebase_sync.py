"""
Firebase sync module for RemindAR.
Handles real-time sync with Firestore including embeddings.
"""

import firebase_admin
from firebase_admin import credentials, firestore
from pathlib import Path
from typing import Optional, Callable, Dict, Any, List
import numpy as np

# Path to credentials
CRED_PATH = Path(__file__).parent / "firebase-credentials.json"

# Global state
_firebase_app: Optional[firebase_admin.App] = None
_db: Optional[firestore.Client] = None
_listeners: list[Callable[[str, Dict[str, Any]], None]] = []
_initialized = False


def init_firebase() -> bool:
    """Initialize Firebase Admin SDK."""
    global _firebase_app, _db, _initialized
    
    if _initialized:
        return True
    
    if not CRED_PATH.exists():
        print("[Firebase] Credentials file not found, running without sync")
        return False
    
    try:
        cred = credentials.Certificate(str(CRED_PATH))
        _firebase_app = firebase_admin.initialize_app(cred)
        _db = firestore.client()
        _initialized = True
        print("[Firebase] Initialized successfully")
        return True
    except Exception as e:
        print(f"[Firebase] Initialization failed: {e}")
        return False


def is_initialized() -> bool:
    """Check if Firebase is initialized."""
    return _initialized


def get_db() -> Optional[firestore.Client]:
    """Get Firestore client."""
    return _db


def add_update_listener(callback: Callable[[str, Dict[str, Any]], None]):
    """Add a listener for database updates."""
    _listeners.append(callback)


def notify_update(event_type: str, data: Dict[str, Any]):
    """Notify all listeners of an update."""
    for listener in _listeners:
        try:
            listener(event_type, data)
        except Exception as e:
            print(f"[Firebase] Listener error: {e}")


def sync_person_to_firebase(person_data: Dict[str, Any], embedding: Optional[np.ndarray] = None):
    """
    Sync a person record to Firebase Firestore.
    Optionally includes embedding for storage.
    """
    if not _initialized or not _db:
        return
    
    try:
        person_id = person_data.get("id")
        if not person_id:
            return
        
        # Create Firestore document
        doc_data = {
            "name": person_data.get("name", ""),
            "relation": person_data.get("relation", ""),
            "last_met": person_data.get("last_met", ""),
            "context": person_data.get("context", ""),
            "has_embedding": embedding is not None,
            "updated_at": firestore.SERVER_TIMESTAMP,  # Sentinel for Firestore
        }
        
        # Store embedding as list of floats
        if embedding is not None:
            doc_data["embedding"] = embedding.tolist()
        
        # Write to Firestore
        _db.collection("people").document(person_id).set(doc_data, merge=True)
        print(f"[Firebase] Synced person: {person_id}")
        
        # Notify listeners - use serializable data only (no Sentinel!)
        from datetime import datetime
        notify_data = {
            "id": person_id,
            "name": person_data.get("name", ""),
            "relation": person_data.get("relation", ""),
            "last_met": person_data.get("last_met", ""),
            "context": person_data.get("context", ""),
            "updated_at": datetime.now().isoformat(),
        }
        notify_update("person_updated", notify_data)
        
    except Exception as e:
        print(f"[Firebase] Sync error: {e}")


def sync_embedding_to_firebase(person_id: str, embedding: np.ndarray):
    """Store face embedding in Firestore."""
    if not _initialized or not _db:
        return
    
    try:
        _db.collection("people").document(person_id).update({
            "embedding": embedding.tolist(),
            "has_embedding": True,
            "updated_at": firestore.SERVER_TIMESTAMP,
        })
        print(f"[Firebase] Stored embedding for: {person_id}")
        
        notify_update("embedding_added", {
            "id": person_id,
            "has_embedding": True
        })
        
    except Exception as e:
        print(f"[Firebase] Embedding sync error: {e}")


def delete_person_from_firebase(person_id: str):
    """Delete a person from Firebase."""
    if not _initialized or not _db:
        return
    
    try:
        _db.collection("people").document(person_id).delete()
        print(f"[Firebase] Deleted person: {person_id}")
        notify_update("person_deleted", {"id": person_id})
    except Exception as e:
        print(f"[Firebase] Delete error: {e}")


def get_all_people_from_firebase() -> List[Dict[str, Any]]:
    """
    Fetch all people with embeddings from Firestore.
    Returns list of (person_dict, embedding) tuples.
    """
    if not _initialized or not _db:
        return []
    
    try:
        docs = _db.collection("people").where("has_embedding", "==", True).stream()
        people = []
        
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            
            # Convert embedding list back to numpy array
            if "embedding" in data and data["embedding"]:
                data["embedding_array"] = np.array(data["embedding"], dtype=np.float32)
            else:
                data["embedding_array"] = None
                
            people.append(data)
        
        print(f"[Firebase] Loaded {len(people)} people with embeddings")
        return people
        
    except Exception as e:
        print(f"[Firebase] Fetch error: {e}")
        return []
