/**
 * RemindAR - Main Application
 * Simplified and cleaned up version
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { LandingPage } from './components/LandingPage';
import { Camera } from './components/Camera';
import { AROverlay } from './components/AROverlay';
import { StatusIndicator } from './components/StatusIndicator';
import { RegistrationModal, RegistrationData } from './components/RegistrationModal';
import { useWebSocket } from './hooks/useWebSocket';
import { useFaceDetection } from './hooks/useFaceDetection';
import { cropFaceFromVideo } from './utils/faceUtils';

const RECOGNITION_INTERVAL = 500;

function App() {
    const [isDemoActive, setIsDemoActive] = useState(false);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [cameraReady, setCameraReady] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);

    // Registration modal state
    const [showRegistration, setShowRegistration] = useState(false);
    const [registrationTrackId, setRegistrationTrackId] = useState('');
    const [registrationFaceImage, setRegistrationFaceImage] = useState('');

    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const lastSendTimeRef = useRef<Map<string, number>>(new Map());

    // Hooks
    const { status: wsStatus, sendFaceData, results, clearResult, updateCounter } = useWebSocket();
    const { faces, isModelLoaded, error: detectionError } = useFaceDetection(videoRef);

    // Update dimensions
    useEffect(() => {
        const update = () => {
            if (containerRef.current) {
                setDimensions({
                    width: containerRef.current.clientWidth,
                    height: containerRef.current.clientHeight,
                });
            }
        };
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    // Send faces for recognition periodically
    useEffect(() => {
        if (!cameraReady || wsStatus !== 'connected') return;

        const sendForRecognition = () => {
            const now = Date.now();

            for (const [trackId, face] of faces) {
                if (!face.isVisible) continue;

                const lastSend = lastSendTimeRef.current.get(trackId) || 0;
                if (now - lastSend >= RECOGNITION_INTERVAL) {
                    const imageBase64 = cropFaceFromVideo(videoRef.current!, face.bbox);
                    if (imageBase64) {
                        sendFaceData({
                            track_id: trackId,
                            image_base64: imageBase64,
                            bbox: face.bbox,
                            timestamp: now,
                        });
                        lastSendTimeRef.current.set(trackId, now);
                    }
                }
            }
        };

        const interval = setInterval(sendForRecognition, RECOGNITION_INTERVAL);
        return () => clearInterval(interval);
    }, [cameraReady, wsStatus, faces, sendFaceData]);

    // Callbacks
    const handleCameraReady = useCallback(() => {
        setCameraReady(true);
        if (containerRef.current) {
            setDimensions({
                width: containerRef.current.clientWidth,
                height: containerRef.current.clientHeight,
            });
        }
    }, []);

    const handleCameraError = useCallback((error: string) => {
        setCameraError(error);
    }, []);

    const handleOpenRegistration = useCallback((trackId: string) => {
        const face = faces.get(trackId);
        if (face && videoRef.current) {
            setRegistrationFaceImage(cropFaceFromVideo(videoRef.current, face.bbox) || '');
        }
        setRegistrationTrackId(trackId);
        setShowRegistration(true);
    }, [faces]);

    const handleRegistrationSubmit = useCallback(async (data: RegistrationData) => {
        console.log('[App] Registering:', data.name);

        try {
            // Create person
            const createRes = await fetch('http://localhost:8000/people', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: data.name,
                    relation: data.relation,
                    last_met: data.lastMet,
                    context: data.context,
                }),
            });

            if (!createRes.ok) throw new Error('Failed to create person');
            const person = await createRes.json();

            // Register face
            if (data.faceImageBase64) {
                const faceRes = await fetch(`http://localhost:8000/register-face/${person.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        track_id: data.trackId,
                        image_base64: data.faceImageBase64,
                    }),
                });

                if (!faceRes.ok) {
                    console.error('[App] Face registration failed');
                }
            }

            // Clear and resend for immediate recognition
            clearResult(data.trackId);
            lastSendTimeRef.current.delete(data.trackId);

            // Send multiple times to ensure recognition
            const resend = () => {
                const face = faces.get(data.trackId);
                if (face && videoRef.current) {
                    const img = cropFaceFromVideo(videoRef.current, face.bbox);
                    if (img) {
                        sendFaceData({
                            track_id: data.trackId,
                            image_base64: img,
                            bbox: face.bbox,
                            timestamp: Date.now(),
                        });
                    }
                }
            };

            resend();
            setTimeout(resend, 300);
            setTimeout(resend, 600);
            setTimeout(resend, 900);

            console.log('[App] Registration complete:', person.name);
        } catch (error) {
            console.error('[App] Registration error:', error);
            alert('Failed to register. See console.');
        }
    }, [clearResult, faces, sendFaceData]);

    // Landing page
    if (!isDemoActive) {
        return <LandingPage onStartDemo={() => setIsDemoActive(true)} />;
    }

    // Camera error
    if (cameraError) {
        return (
            <div className="error-container">
                <h1>Camera Access Required</h1>
                <p>{cameraError}</p>
                <button onClick={() => window.location.reload()}>Retry</button>
            </div>
        );
    }

    return (
        <div className="app-container" ref={containerRef}>
            <StatusIndicator
                connectionStatus={wsStatus}
                facesDetected={Array.from(faces.values()).filter(f => f.isVisible).length}
                isModelLoaded={isModelLoaded}
                detectionError={detectionError}
            />

            <Camera
                ref={videoRef}
                onReady={handleCameraReady}
                onError={handleCameraError}
            />

            {cameraReady && dimensions.width > 0 && (
                <AROverlay
                    key={updateCounter}
                    faces={faces}
                    results={results}
                    containerWidth={dimensions.width}
                    containerHeight={dimensions.height}
                    onAddPerson={handleOpenRegistration}
                />
            )}

            <button className="back-button" onClick={() => setIsDemoActive(false)}>
                ← Back
            </button>

            <RegistrationModal
                isOpen={showRegistration}
                trackId={registrationTrackId}
                faceImageBase64={registrationFaceImage}
                onClose={() => setShowRegistration(false)}
                onSubmit={handleRegistrationSubmit}
            />
        </div>
    );
}

export default App;
