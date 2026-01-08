# RemindAR

A real-time face recognition system with AR overlays, designed to help people with memory challenges recognize and remember the people in their lives.

---

## Overview

RemindAR uses your webcam to detect faces, recognize identities, and display contextual information as floating labels. Think of it as a prototype for smart glasses that could help someone with dementia remember their family, caregivers, and friends.

**How it works:**
- Face detection runs in the browser using MediaPipe
- Face recognition uses InsightFace embeddings on the backend
- Voice input with Whisper + Phi-3 for natural registration
- Data syncs between local SQLite and Firebase Firestore

---

## Getting Started

### Requirements

- Python 3.9+
- Node.js 18+
- Ollama (for local LLM)
- A webcam

### 1. Install Ollama

Download from https://ollama.com/download and pull the Phi-3 model:

```bash
ollama pull phi3
```

### 2. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the server
python main.py
```

On first run, InsightFace (~300MB) and Whisper (~150MB) models download automatically.

### 3. Frontend Setup

```bash
cd frontend

npm install
npm run dev
```

Open `http://localhost:5173` and allow camera access.

---

## Features

**Face Detection**  
MediaPipe runs in-browser for fast detection.

**Face Recognition**  
InsightFace embeddings matched using cosine similarity.

**Voice Registration**  
Speak naturally: "That's Aditya, my friend, we met for coffee"  
Whisper transcribes, Phi-3 extracts structured data, form auto-fills.

**Hybrid Storage**  
Firestore for cloud sync, SQLite for local reads, in-memory cache for speed.

---

## Registering Faces

1. Click "Add this person" on an unknown face
2. Click "Speak" and say something like: "That's Sarah, my doctor, she prescribed medication"
3. Form auto-fills with extracted info
4. Click Save

---

## Architecture

```
Frontend (React + TypeScript)
├── MediaPipe face detection
├── WebSocket for recognition
└── AR overlay with CSS

Backend (FastAPI + Python)
├── InsightFace recognition
├── Whisper transcription
├── Phi-3 extraction (via Ollama)
└── SQLite + Firebase storage
```

---

## Project Structure

```
RemindAR/
├── backend/
│   ├── main.py              # FastAPI server
│   ├── face_recognition.py  # InsightFace
│   ├── speech_to_text.py    # Whisper
│   ├── llm_extraction.py    # Phi-3 via Ollama
│   ├── database.py          # SQLite
│   └── firebase_sync.py     # Firestore
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   └── hooks/
│   └── package.json
│
└── README.md
```

---

## Configuration

**Backend**: Runs on port 8000

**Frontend**: Create `.env`:
```env
VITE_WS_URL=ws://localhost:8000/ws
```

**Firebase**: Place `firebase-credentials.json` in backend directory. Falls back to SQLite-only if not present.

**Ollama**: Must be running for voice extraction to work.

---

## Troubleshooting

**Voice extraction returns null**  
Make sure Ollama is running: `ollama serve`

**Camera not working**  
Check browser permissions. Try Chrome.

**Faces not recognized**  
Register faces first. Good lighting helps.

---

## Tech Stack

- FastAPI
- MediaPipe
- InsightFace
- Whisper (faster-whisper)
- Phi-3 (via Ollama)
- Firebase Firestore
- React / TypeScript / Vite

---

## License

MIT

---

Built for people with memory challenges and their caregivers.
