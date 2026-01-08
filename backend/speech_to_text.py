"""
Speech-to-Text module using faster-whisper.
Provides local transcription without cloud APIs.
"""

import tempfile
import os
from pathlib import Path
from typing import Optional

# Try to import faster-whisper
try:
    from faster_whisper import WhisperModel
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False
    print("[STT] faster-whisper not installed")


class SpeechToText:
    """Local Whisper-based speech-to-text."""
    
    def __init__(self, model_size: str = "base"):
        """
        Initialize Whisper model.
        Model sizes: tiny, base, small, medium, large
        Smaller = faster but less accurate
        """
        self.model = None
        self.model_size = model_size
        
        if WHISPER_AVAILABLE:
            self._load_model()
    
    def _load_model(self):
        """Load the Whisper model."""
        try:
            print(f"[STT] Loading Whisper model: {self.model_size}")
            # Use CPU, int8 quantization for speed
            self.model = WhisperModel(
                self.model_size,
                device="cpu",
                compute_type="int8"
            )
            print(f"[STT] Model loaded successfully")
        except Exception as e:
            print(f"[STT] Failed to load model: {e}")
            self.model = None
    
    def transcribe(self, audio_data: bytes, language: str = "en") -> Optional[str]:
        """
        Transcribe audio data to text.
        
        Args:
            audio_data: Raw audio bytes (WAV or MP3)
            language: Language code (e.g., "en", "es")
        
        Returns:
            Transcribed text or None if failed
        """
        if not self.model:
            return None
        
        # Write audio to temp file
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(audio_data)
            temp_path = f.name
        
        try:
            # Transcribe
            segments, info = self.model.transcribe(
                temp_path,
                language=language,
                beam_size=5,
                vad_filter=True,  # Voice activity detection
            )
            
            # Combine segments
            text = " ".join(segment.text.strip() for segment in segments)
            return text.strip()
            
        except Exception as e:
            print(f"[STT] Transcription error: {e}")
            return None
            
        finally:
            # Clean up temp file
            try:
                os.unlink(temp_path)
            except:
                pass


# Singleton instance
_stt: Optional[SpeechToText] = None


def get_stt() -> SpeechToText:
    """Get the singleton STT instance."""
    global _stt
    if _stt is None:
        _stt = SpeechToText(model_size="base")
    return _stt
