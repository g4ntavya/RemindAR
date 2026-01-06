"""
Face recognition module for RemindAR.
Uses InsightFace for generating embeddings and matching identities.
"""

import numpy as np
import cv2
import base64
from typing import Optional, Tuple, List
from io import BytesIO
from PIL import Image

# InsightFace imports
try:
    from insightface.app import FaceAnalysis
    INSIGHTFACE_AVAILABLE = True
except ImportError:
    INSIGHTFACE_AVAILABLE = False
    print("[WARN] InsightFace not installed. Face recognition will be disabled.")

from database import get_all_people_with_embeddings


class FaceRecognizer:
    """
    Face recognition engine using InsightFace.
    Generates embeddings and matches against known identities.
    """
    
    # Similarity threshold for considering a match
    # Higher = stricter matching, fewer false positives
    # Lower = more lenient, may have false positives
    SIMILARITY_THRESHOLD = 0.45
    
    def __init__(self):
        """Initialize the face recognition model."""
        self.model = None
        self._initialize_model()
    
    def _initialize_model(self):
        """
        Initialize InsightFace model.
        Downloads model on first run (~300MB).
        """
        if not INSIGHTFACE_AVAILABLE:
            print("[FaceRec] InsightFace not available, using mock mode")
            return
        
        try:
            # Use buffalo_l model - good balance of speed and accuracy
            # det_size controls detection resolution
            self.model = FaceAnalysis(
                name="buffalo_l",
                providers=["CPUExecutionProvider"]  # Use CPU for compatibility
            )
            self.model.prepare(ctx_id=0, det_size=(640, 640))
            print("[FaceRec] InsightFace model initialized")
        except Exception as e:
            print(f"[FaceRec] Failed to initialize model: {e}")
            self.model = None
    
    def decode_image(self, image_base64: str) -> Optional[np.ndarray]:
        """
        Decode base64 image to OpenCV format (BGR).
        Handles both with and without data URL prefix.
        """
        try:
            # Remove data URL prefix if present
            if "," in image_base64:
                image_base64 = image_base64.split(",")[1]
            
            # Decode base64 to bytes
            image_bytes = base64.b64decode(image_base64)
            
            # Convert to PIL Image
            pil_image = Image.open(BytesIO(image_bytes))
            
            # Convert to OpenCV format (BGR)
            cv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
            
            return cv_image
        except Exception as e:
            print(f"[FaceRec] Image decode error: {e}")
            return None
    
    def get_embedding(self, image: np.ndarray) -> Optional[np.ndarray]:
        """
        Generate face embedding from an image.
        Returns 512-dimensional embedding vector or None if no face found.
        """
        if self.model is None:
            # Mock mode: return random embedding for testing
            return np.random.randn(512).astype(np.float32)
        
        try:
            # Run face analysis
            faces = self.model.get(image)
            
            if len(faces) == 0:
                print("[FaceRec] No face detected in crop")
                return None
            
            # Return embedding of first (largest) face
            # normed_embedding is L2-normalized for cosine similarity
            return faces[0].normed_embedding
            
        except Exception as e:
            print(f"[FaceRec] Embedding error: {e}")
            return None
    
    def get_embedding_from_base64(self, image_base64: str) -> Optional[np.ndarray]:
        """
        Generate embedding directly from base64 image.
        Convenience method combining decode + embedding.
        """
        image = self.decode_image(image_base64)
        if image is None:
            return None
        return self.get_embedding(image)
    
    def compute_similarity(self, emb1: np.ndarray, emb2: np.ndarray) -> float:
        """
        Compute cosine similarity between two embeddings.
        Returns value between -1 (opposite) and 1 (identical).
        For normalized embeddings, this is just the dot product.
        """
        # Ensure normalized
        emb1_norm = emb1 / (np.linalg.norm(emb1) + 1e-8)
        emb2_norm = emb2 / (np.linalg.norm(emb2) + 1e-8)
        
        # Cosine similarity via dot product
        return float(np.dot(emb1_norm, emb2_norm))
    
    def find_match(
        self, 
        query_embedding: np.ndarray
    ) -> Tuple[Optional[dict], float]:
        """
        Find the best matching person for a query embedding.
        
        Returns:
            (person_dict, similarity_score) if match found
            (None, best_score) if no match above threshold
        """
        # Get all known people with embeddings
        known_people = get_all_people_with_embeddings()
        
        if not known_people:
            return None, 0.0
        
        best_match = None
        best_score = -1.0
        
        for person, embedding in known_people:
            if embedding is None:
                continue
            
            score = self.compute_similarity(query_embedding, embedding)
            
            if score > best_score:
                best_score = score
                if score >= self.SIMILARITY_THRESHOLD:
                    best_match = person
        
        return best_match, best_score
    
    def recognize(
        self, 
        image_base64: str
    ) -> Tuple[Optional[dict], float, Optional[np.ndarray]]:
        """
        Full recognition pipeline: decode -> embed -> match.
        
        Returns:
            (matched_person, confidence, embedding)
            matched_person is None if no match found
        """
        # Generate embedding
        embedding = self.get_embedding_from_base64(image_base64)
        
        if embedding is None:
            return None, 0.0, None
        
        # Find match
        person, score = self.find_match(embedding)
        
        return person, score, embedding


# Singleton instance
_recognizer: Optional[FaceRecognizer] = None


def get_recognizer() -> FaceRecognizer:
    """Get the singleton FaceRecognizer instance."""
    global _recognizer
    if _recognizer is None:
        _recognizer = FaceRecognizer()
    return _recognizer
