# RemindAR - AI-Powered AR Memory Assistant

An emotional, demo-ready AR memory assistant that helps people with memory loss recognize faces and remember important context about the people in their lives.

![RemindAR Demo](https://via.placeholder.com/800x400/0a0a0f/ffffff?text=RemindAR+-+AR+Memory+Assistant)

## 🎯 What It Does

RemindAR uses your webcam to simulate AR glasses:
1. **Detects faces** in real-time using MediaPipe (in-browser)
2. **Recognizes identities** using InsightFace deep learning embeddings
3. **Displays floating AR labels** with name, relationship, and context
4. **Smooth, calm animations** designed for accessibility

## ✨ Features

- 🎥 **Real-time face detection** - MediaPipe running entirely in-browser
- 🧠 **AI-powered recognition** - InsightFace generates face embeddings for matching
- 🎭 **Smooth AR overlays** - Three.js renders floating text labels
- 💾 **Persistent memory** - SQLite stores identities and context
- 🌐 **WebSocket communication** - Low-latency real-time updates
- ♿ **Accessibility-first** - Large fonts, soft glow, minimal motion

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.9+** (for backend)
- **Node.js 18+** (for frontend)
- **Webcam** with browser access permissions

### 1. Clone the Repository

```bash
cd /path/to/RemindAR
```

### 2. Start the Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the server
python main.py
```

The backend will:
- Initialize the SQLite database
- Download InsightFace model (~300MB on first run)
- Start WebSocket server on `ws://localhost:8000/ws`

### 3. Start the Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Open `http://localhost:5173` in your browser.

### 4. Allow Camera Access

When prompted, allow camera access to see the AR overlay in action.

---

## 📋 Demo Flow

1. **Start both servers** (backend and frontend)
2. **Open the frontend** in your browser
3. **Allow camera access** when prompted
4. **Show a face** - You'll see "Analyzing..." then either:
   - **Known person**: Name, relation, and context appear
   - **Unknown person**: "New Person" label appears

### Pre-loaded Demo Identities

The database comes seeded with 4 demo identities:
- **Sarah** - Daughter
- **Dr. Patel** - Doctor
- **Mike** - Neighbor
- **Emma** - Granddaughter

> **Note**: These identities need face photos to be registered before recognition works. See [Registering Faces](#registering-faces) below.

---

## 🖼️ Registering Faces

To register a face for a known identity:

### Option 1: REST API

```bash
# Register a face for an existing person
curl -X POST "http://localhost:8000/register-face/demo_001" \
  -H "Content-Type: application/json" \
  -d '{"track_id": "sarah_1", "image_base64": "<base64-encoded-face-image>"}'
```

### Option 2: Add New Person

```bash
# Create a new person
curl -X POST "http://localhost:8000/people" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John",
    "relation": "Son",
    "last_met": "Today",
    "context": "Brought groceries"
  }'
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                            │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │  Camera  │→ │  MediaPipe   │→ │  Face Tracking +      │  │
│  │  (WebRTC)│  │  Detection   │  │  Bounding Box Smooth  │  │
│  └──────────┘  └──────────────┘  └───────────────────────┘  │
│                                            │                │
│                                    ┌───────▼───────┐        │
│                                    │  WebSocket    │        │
│                                    │  (face crops) │        │
│                                    └───────┬───────┘        │
│  ┌──────────────────────────────┐          │                │
│  │  Three.js AR Overlay         │←─────────┘                │
│  │  (floating text labels)      │    (identity + context)   │
│  └──────────────────────────────┘                           │
└─────────────────────────────────────────────────────────────┘
                              │
                     WebSocket Connection
                              │
┌─────────────────────────────────────────────────────────────┐
│                         BACKEND                             │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │  FastAPI │→ │  InsightFace │→ │  Embedding Matching   │  │
│  │  Server  │  │  (buffalo_l) │  │  (cosine similarity)  │  │
│  └──────────┘  └──────────────┘  └───────────────────────┘  │
│                                            │                │
│                                    ┌───────▼───────┐        │
│                                    │    SQLite     │        │
│                                    │  (identities) │        │
│                                    └───────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
RemindAR/
├── backend/
│   ├── main.py              # FastAPI server + WebSocket
│   ├── face_recognition.py  # InsightFace integration
│   ├── database.py          # SQLite operations
│   ├── models.py            # Pydantic schemas
│   └── requirements.txt     # Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                  # Main application
│   │   ├── components/
│   │   │   ├── Camera.tsx           # Webcam capture
│   │   │   ├── AROverlay.tsx        # Three.js overlay
│   │   │   ├── PersonLabel.tsx      # Individual labels
│   │   │   └── StatusIndicator.tsx  # Connection status
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts      # WebSocket connection
│   │   │   └── useFaceDetection.ts  # MediaPipe detection
│   │   ├── utils/
│   │   │   └── faceUtils.ts         # Helper functions
│   │   ├── types/
│   │   │   └── index.ts             # TypeScript types
│   │   └── styles/
│   │       └── index.css            # Global styles
│   ├── package.json
│   └── vite.config.ts
│
└── README.md
```

---

## 🔧 Configuration

### Backend Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Server host |
| `PORT` | `8000` | Server port |

### Frontend Environment

Create `.env` in `frontend/`:

```env
VITE_WS_URL=ws://localhost:8000/ws
```

---

## 🎨 UI Design Philosophy

- **Text-only overlays** - No cards, boxes, or distracting UI
- **Maximum 3 lines** - Name, relation, and context
- **Soft white glow** - Readable on any background
- **Gentle animations** - Fade in/out, subtle float
- **Accessibility-first** - Large fonts, reduced motion support

---

## 🔮 Future Expansion Points

The following features are stubbed for future implementation:

```typescript
// TODO: Caregiver dashboard for managing identities
// TODO: Voice-based memory capture
// TODO: Long-term conversation memory with ChromaDB
// TODO: Mobile AR (ARCore/ARKit) integration
// TODO: Speaker diarization for multi-person conversations
```

---

## 🐛 Troubleshooting

### Camera not working
- Ensure browser has camera permissions
- Try a different browser (Chrome recommended)
- Check if another app is using the camera

### WebSocket disconnected
- Verify backend is running on port 8000
- Check browser console for errors
- Ensure no firewall blocking WebSocket

### Faces not recognized
- Register faces via the API first
- Ensure good lighting and face visibility
- Try adjusting similarity threshold in `face_recognition.py`

### Slow performance
- Close other camera-using applications
- Reduce browser tab count
- Try lowering detection resolution

---

## 📄 License

MIT License - Feel free to use for hackathons and personal projects.

---

## 🙏 Acknowledgments

- [MediaPipe](https://mediapipe.dev/) - In-browser face detection
- [InsightFace](https://github.com/deepinsight/insightface) - Face recognition embeddings
- [Three.js](https://threejs.org/) - 3D WebGL rendering
- [FastAPI](https://fastapi.tiangolo.com/) - Python web framework

---

Built with ❤️ for people with memory loss and their caregivers.
