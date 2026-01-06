/**
 * Type definitions for RemindAR frontend
 */

// Face detection bounding box
export interface BoundingBox {
    x: number;      // Normalized x position (0-1)
    y: number;      // Normalized y position (0-1)
    width: number;  // Normalized width (0-1)
    height: number; // Normalized height (0-1)
}

// Tracked face with smoothed position
export interface TrackedFace {
    id: string;           // Unique tracking ID
    bbox: BoundingBox;    // Current bounding box (smoothed)
    rawBbox: BoundingBox; // Raw bounding box from detector
    confidence: number;   // Detection confidence (0-1)
    lastSeen: number;     // Timestamp of last detection
    isVisible: boolean;   // Currently visible in frame
}

// Person identity from backend
export interface Person {
    id: string;
    name: string;
    relation: string;
    last_met: string;
    context: string;
}

// Recognition result from backend
export interface RecognitionResult {
    track_id: string;
    is_known: boolean;
    confidence: number;
    person: Person | null;
    display_lines: string[];
}

// Face data sent to backend
export interface FaceData {
    track_id: string;
    image_base64: string;
    bbox?: BoundingBox;
    timestamp?: number;
}

// WebSocket message types
export interface WebSocketMessage {
    type: 'face_data' | 'recognition_result' | 'ping' | 'pong';
    data?: Record<string, unknown>;
}

// AR overlay state for a face
export interface FaceOverlay {
    trackId: string;
    position: {
        x: number;
        y: number;
    };
    displayLines: string[];
    isKnown: boolean;
    confidence: number;
    opacity: number;  // For fade animation
    lastUpdated: number;
}

// App state
export interface AppState {
    isLoading: boolean;
    error: string | null;
    cameraReady: boolean;
    wsConnected: boolean;
    faces: Map<string, TrackedFace>;
    overlays: Map<string, FaceOverlay>;
}

// Camera configuration
export interface CameraConfig {
    width: number;
    height: number;
    facingMode: 'user' | 'environment';
}

// WebSocket connection status
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';
