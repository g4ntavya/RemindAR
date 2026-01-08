"""
Face recognition module for RemindAR.
Uses InsightFace for embeddings - session-only cache from Firestore.
"""

import numpy as np
import cv2
import base64
from typing import Optional, Tuple, Dict
from io import BytesIO
from PIL import Image
import warnings

# Suppress the FutureWarning from insightface
warnings.filterwarnings("ignore", category=FutureWarning)

# InsightFace imports
try:
    from insightface.app import FaceAnalysis
    INSIGHTFACE_AVAILABLE = True
except ImportError:
    INSIGHTFACE_AVAILABLE = False
    print("[WARN] InsightFace not installed")


class FaceRecognizer:
    """
    Face recognition with session-only cache.
    Loads from Firestore on startup, clears on shutdown.
    """
    
    SIMILARITY_THRESHOLD = 0.55  # 55% for lenient matching
    
    def __init__(self):
        self.model = None
        self._cache: Dict[str, Tuple[dict, np.ndarray]] = {}
        self._initialize_model()
    
    def _initialize_model(self):
        """Initialize InsightFace model."""
        if not INSIGHTFACE_AVAILABLE:
            print("[FaceRec] InsightFace not available")
            return
        
        try:
            self.model = FaceAnalysis(
                name="buffalo_l",
                providers=["CPUExecutionProvider"]
            )
            self.model.prepare(ctx_id=0, det_size=(320, 320))
            print("[FaceRec] Model initialized")
        except Exception as e:
            print(f"[FaceRec] Init failed: {e}")
            self.model = None
    
    def load_cache_from_firestore(self):
        """Load embeddings from Firestore into session cache."""
        try:
            from firebase_sync import get_all_people_from_firebase, is_initialized
            
            if not is_initialized():
                print("[FaceRec] Firebase not initialized, loading from SQLite")
                self.load_cache_from_database()
                return
            
            people = get_all_people_from_firebase()
            self._cache.clear()
            
            for person_data in people:
                person_id = person_data.get("id")
                embedding = person_data.get("embedding_array")
                
                if person_id and embedding is not None:
                    # Create person dict without embedding array
                    person = {
                        "id": person_id,
                        "name": person_data.get("name", ""),
                        "relation": person_data.get("relation", ""),
                        "context": person_data.get("context", ""),
                        "last_met": person_data.get("last_met", ""),
                    }
                    self._cache[person_id] = (person, embedding)
            
            print(f"[FaceRec] Loaded {len(self._cache)} faces from Firestore")
            
        except Exception as e:
            print(f"[FaceRec] Firestore load error: {e}")
            self.load_cache_from_database()
    
    def load_cache_from_database(self):
        """Fallback: load from SQLite."""
        try:
            from database import get_all_people_with_embeddings
            
            known_people = get_all_people_with_embeddings()
            self._cache.clear()
            
            for person, embedding in known_people:
                if embedding is not None:
                    self._cache[person['id']] = (person, embedding)
            
            print(f"[FaceRec] Loaded {len(self._cache)} faces from SQLite")
        except Exception as e:
            print(f"[FaceRec] SQLite load error: {e}")
    
    def clear_cache(self):
        """Clear session cache."""
        count = len(self._cache)
        self._cache.clear()
        print(f"[FaceRec] Cache cleared ({count} entries)")
    
    def add_to_cache(self, person_id: str, person_data: dict, embedding: np.ndarray):
        """Add newly registered face to cache."""
        self._cache[person_id] = (person_data, embedding)
        print(f"[FaceRec] Added to cache: {person_data.get('name')} (total: {len(self._cache)})")
    
    def remove_from_cache(self, person_id: str):
        """Remove from cache."""
        if person_id in self._cache:
            del self._cache[person_id]
    
    def get_cache_count(self) -> int:
        return len(self._cache)
    
    def decode_image(self, image_base64: str) -> Optional[np.ndarray]:
        """Decode base64 to OpenCV image."""
        try:
            if "," in image_base64:
                image_base64 = image_base64.split(",")[1]
            
            image_bytes = base64.b64decode(image_base64)
            pil_image = Image.open(BytesIO(image_bytes))
            return cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
        except Exception as e:
            print(f"[FaceRec] Decode error: {e}")
            return None
    
    def get_embedding(self, image: np.ndarray) -> Optional[np.ndarray]:
        """Generate face embedding."""
        if self.model is None:
            return np.random.randn(512).astype(np.float32)
        
        try:
            faces = self.model.get(image)
            if len(faces) == 0:
                return None
            return faces[0].normed_embedding
        except Exception as e:
            print(f"[FaceRec] Embedding error: {e}")
            return None
    
    def get_embedding_from_base64(self, image_base64: str) -> Optional[np.ndarray]:
        """Generate embedding from base64 image."""
        image = self.decode_image(image_base64)
        if image is None:
            return None
        return self.get_embedding(image)
    
    def compute_similarity(self, emb1: np.ndarray, emb2: np.ndarray) -> float:
        """Cosine similarity between embeddings."""
        emb1_norm = emb1 / (np.linalg.norm(emb1) + 1e-8)
        emb2_norm = emb2 / (np.linalg.norm(emb2) + 1e-8)
        return float(np.dot(emb1_norm, emb2_norm))
    
    def find_match(self, query_embedding: np.ndarray) -> Tuple[Optional[dict], float]:
        """Find best match from cache."""
        if not self._cache:
            return None, 0.0
        
        best_match = None
        best_score = -1.0
        
        for person_id, (person, embedding) in self._cache.items():
            score = self.compute_similarity(query_embedding, embedding)
            if score > best_score:
                best_score = score
                if score >= self.SIMILARITY_THRESHOLD:
                    best_match = person
        
        return best_match, best_score
    
    def recognize(self, image_base64: str) -> Tuple[Optional[dict], float, Optional[np.ndarray]]:
        """Full recognition pipeline."""
        embedding = self.get_embedding_from_base64(image_base64)
        if embedding is None:
            return None, 0.0, None
        
        person, score = self.find_match(embedding)
        return person, score, embedding


# Singleton
_recognizer: Optional[FaceRecognizer] = None

def get_recognizer() -> FaceRecognizer:
    global _recognizer
    if _recognizer is None:
        _recognizer = FaceRecognizer()
    return _recognizer
