# RemindAR

A real-time face recognition system with AR overlays, designed to help people with memory challenges recognize and remember the people in their lives.

---

## Overview

RemindAR uses your webcam to detect faces, recognize identities, and display contextual information as floating labels. Think of it as a prototype for smart glasses that could help someone with dementia remember their family, caregivers, and friends.

**How it works:**
- Face detection runs in the browser using MediaPipe
- Face recognition uses InsightFace embeddings on the backend
- Data syncs between local SQLite and Firebase Firestore
- AR labels appear beside recognized faces with name, relation, and context

---

## Getting Started

### Requirements

- Python 3.9+
- Node.js 18+
- A webcam

### Backend Setup

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

On first run, the InsightFace model (~300MB) downloads automatically.

### Frontend Setup

```bash
cd frontend

npm install
npm run dev
```

Open `http://localhost:5173` and allow camera access.

---

## Features

**Face Detection**  
MediaPipe runs entirely in-browser for fast, low-latency detection.

**Face Recognition**  
InsightFace generates 512-dimensional embeddings. Faces are matched using cosine similarity against a local cache.

**Hybrid Storage**  
Firebase Firestore for cloud sync, SQLite for fast local reads. On startup, Firestore data syncs to SQLite, then loads into an in-memory cache.

**Voice Input**  
Local Whisper transcription for adding context via voice. No cloud API needed.

**Real-time Updates**  
WebSocket connection streams recognition results instantly. No polling.

---

## Registering Faces

When the system detects an unknown face, an "Add this person" button appears. Click it to open the registration form.

Fields:
- Name (required)
- Relation (e.g., Doctor, Friend, Daughter)
- Context (notes about the person, supports voice input)

After registration, the face is immediately recognized.

---

## Architecture

```
Frontend (React + TypeScript)
├── MediaPipe face detection
├── Face tracking with smoothing
├── WebSocket client for recognition
└── AR overlay with CSS positioning

Backend (FastAPI + Python)
├── WebSocket server
├── InsightFace recognition
├── SQLite + Firebase storage
└── Whisper transcription
```

---

## Project Structure

```
RemindAR/
├── backend/
│   ├── main.py              # FastAPI server
│   ├── face_recognition.py  # InsightFace integration
│   ├── database.py          # SQLite operations
│   ├── firebase_sync.py     # Firestore sync
│   ├── speech_to_text.py    # Whisper STT
│   └── models.py            # Data schemas
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Camera.tsx
│   │   │   ├── AROverlay.tsx
│   │   │   └── RegistrationModal.tsx
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts
│   │   │   ├── useFaceDetection.ts
│   │   │   └── useSpeechToText.ts
│   │   └── styles/
│   └── package.json
│
└── README.md
```

---

## Configuration

**Backend**

The server runs on port 8000 by default.

**Frontend**

Create `.env` in the frontend directory:

```env
VITE_WS_URL=ws://localhost:8000/ws
```

**Firebase**

Place your `firebase-credentials.json` in the backend directory. If not present, the system falls back to SQLite-only storage.

---

## Troubleshooting

**Camera not working**  
Check browser permissions. Try Chrome if using Safari.

**WebSocket disconnecting**  
Ensure the backend is running. Check the browser console for errors.

**Faces not recognized**  
Make sure faces are registered first. Good lighting helps.

**Recognition only updates after switching tabs**  
Refresh the browser to pick up the latest code changes.

---

## Tech Stack

- FastAPI
- MediaPipe
- InsightFace
- Firebase Firestore
- Faster-Whisper
- React
- TypeScript
- Vite

---

## License

MIT

---

Built for people with memory challenges and their caregivers.
