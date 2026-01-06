/**
 * RemindAR - Main Application Component
 * 
 * This is the core of the AR memory assistant. It orchestrates:
 * 1. Camera feed capture
 * 2. Face detection (MediaPipe)
 * 3. WebSocket communication with backend
 * 4. AR overlay rendering (Three.js)
 * 
 * Architecture:
 * - Video layer: Raw webcam feed (mirrored)
 * - Detection layer: Processes frames, extracts faces
 * - AR layer: Three.js canvas with floating labels
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { Camera } from './components/Camera';
import { AROverlay } from './components/AROverlay';
import { StatusIndicator } from './components/StatusIndicator';
import { useWebSocket } from './hooks/useWebSocket';
import { useFaceDetection } from './hooks/useFaceDetection';
import { cropFaceFromVideo, throttle } from './utils/faceUtils';
import { TrackedFace } from './types';

// How often to send face crops to backend (ms)
// Lower = more responsive, higher = less server load
const RECOGNITION_INTERVAL = 500;

function App() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [cameraReady, setCameraReady] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);

    // WebSocket connection for face recognition
    const { status: wsStatus, sendFaceData, results } = useWebSocket();

    // MediaPipe face detection
    const { faces, isModelLoaded, error: detectionError } = useFaceDetection(videoRef);

    // Track which faces we've already sent for recognition
    const sentFacesRef = useRef<Set<string>>(new Set());
    const lastSendTimeRef = useRef<Map<string, number>>(new Map());

    // Update container dimensions on resize
    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                setDimensions({
                    width: containerRef.current.clientWidth,
                    height: containerRef.current.clientHeight,
                });
            }
        };

        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    // Send face crops to backend for recognition
    const sendFaceForRecognition = useCallback(
        throttle((face: TrackedFace) => {
            if (!videoRef.current || !cameraReady || wsStatus !== 'connected') {
                return;
            }

            // Check if we've sent this face recently
            const lastSend = lastSendTimeRef.current.get(face.id) || 0;
            const now = Date.now();

            if (now - lastSend < RECOGNITION_INTERVAL) {
                return;
            }

            // Crop face from video
            const imageBase64 = cropFaceFromVideo(videoRef.current, face.bbox);

            if (imageBase64) {
                sendFaceData({
                    track_id: face.id,
                    image_base64: imageBase64,
                    bbox: face.bbox,
                    timestamp: now,
                });

                lastSendTimeRef.current.set(face.id, now);
                sentFacesRef.current.add(face.id);
            }
        }, 100),
        [cameraReady, wsStatus, sendFaceData]
    );

    // Process detected faces
    useEffect(() => {
        if (!cameraReady || !isModelLoaded) return;

        for (const [, face] of faces) {
            if (face.isVisible) {
                // Send for recognition if not already known or needs refresh
                const existingResult = results.get(face.id);
                const shouldSend = !existingResult ||
                    (Date.now() - (lastSendTimeRef.current.get(face.id) || 0) > RECOGNITION_INTERVAL * 2);

                if (shouldSend) {
                    sendFaceForRecognition(face);
                }
            }
        }

        // Clean up old face references
        for (const faceId of sentFacesRef.current) {
            if (!faces.has(faceId)) {
                sentFacesRef.current.delete(faceId);
                lastSendTimeRef.current.delete(faceId);
            }
        }
    }, [faces, cameraReady, isModelLoaded, results, sendFaceForRecognition]);

    // Handle camera ready
    const handleCameraReady = useCallback(() => {
        setCameraReady(true);
        console.log('[App] Camera ready');
    }, []);

    // Handle camera error
    const handleCameraError = useCallback((error: string) => {
        setCameraError(error);
        console.error('[App] Camera error:', error);
    }, []);

    // Only show error for camera issues - detection issues shown in status
    if (cameraError) {
        return (
            <div className="error-container">
                <div className="error-icon" />
                <h1 className="error-title">Camera Access Required</h1>
                <p className="error-message">
                    {cameraError}
                    <br /><br />
                    Please allow camera access and refresh the page.
                </p>
            </div>
        );
    }

    return (
        <div className="app-container" ref={containerRef}>
            {/* Status indicator - shows detection errors here instead of blocking */}
            <StatusIndicator
                connectionStatus={wsStatus}
                facesDetected={Array.from(faces.values()).filter(f => f.isVisible).length}
                isModelLoaded={isModelLoaded}
                detectionError={detectionError}
            />

            {/* Camera feed layer */}
            <Camera
                ref={videoRef}
                onReady={handleCameraReady}
                onError={handleCameraError}
            />

            {/* AR overlay layer */}
            {cameraReady && dimensions.width > 0 && (
                <AROverlay
                    faces={faces}
                    results={results}
                    containerWidth={dimensions.width}
                    containerHeight={dimensions.height}
                />
            )}
        </div>
    );
}

export default App;
