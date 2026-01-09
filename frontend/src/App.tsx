/**
 * RemindAR - Main Application
 * With real-time updates and fast recognition
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
import { Person } from './types';

// Recognition settings - FAST for real-time feel
const RECOGNITION_INTERVAL = 200; // Faster recognition (was 500)
const BURST_DELAY = 50; // For burst recognition after visibility change

function App() {
    const [isDemoActive, setIsDemoActive] = useState(false);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [cameraReady, setCameraReady] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);

    // Registration/Modify modal state
    const [showModal, setShowModal] = useState(false);
    const [modalTrackId, setModalTrackId] = useState('');
    const [modalFaceImage, setModalFaceImage] = useState('');
    const [editingPerson, setEditingPerson] = useState<Person | null>(null);

    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const lastSendTimeRef = useRef<Map<string, number>>(new Map());
    const burstModeRef = useRef(false);

    // Hooks
    const { status: wsStatus, sendFaceData, results, clearResult, clearAllResults } = useWebSocket();
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

    // Immediate face recognition - can be called for burst mode
    const sendAllFacesNow = useCallback(() => {
        if (!videoRef.current || wsStatus !== 'connected') return;

        for (const [trackId, face] of faces) {
            if (!face.isVisible) continue;

            const imageBase64 = cropFaceFromVideo(videoRef.current, face.bbox);
            if (imageBase64) {
                sendFaceData({
                    track_id: trackId,
                    image_base64: imageBase64,
                    bbox: face.bbox,
                    timestamp: Date.now(),
                });
                lastSendTimeRef.current.set(trackId, Date.now());
            }
        }
    }, [faces, wsStatus, sendFaceData]);

    // Visibility change handler - CRITICAL for tab switching
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && cameraReady && wsStatus === 'connected') {
                console.log('[App] Tab visible - burst recognition');
                burstModeRef.current = true;

                // Immediately send all faces
                sendAllFacesNow();

                // Send again after short delays to catch up
                setTimeout(sendAllFacesNow, BURST_DELAY);
                setTimeout(sendAllFacesNow, BURST_DELAY * 2);
                setTimeout(sendAllFacesNow, BURST_DELAY * 3);

                // Exit burst mode
                setTimeout(() => { burstModeRef.current = false; }, BURST_DELAY * 4);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [cameraReady, wsStatus, sendAllFacesNow]);

    // Immediately recognize NEW faces (those without results yet)
    useEffect(() => {
        if (!videoRef.current || wsStatus !== 'connected') return;

        for (const [trackId, face] of faces) {
            if (!face.isVisible) continue;

            // If this face has no result yet, send immediately
            if (!results.has(trackId) && !lastSendTimeRef.current.has(trackId)) {
                const imageBase64 = cropFaceFromVideo(videoRef.current, face.bbox);
                if (imageBase64) {
                    console.log(`[App] New face detected: ${trackId.slice(0, 6)} - sending immediately`);
                    sendFaceData({
                        track_id: trackId,
                        image_base64: imageBase64,
                        bbox: face.bbox,
                        timestamp: Date.now(),
                    });
                    lastSendTimeRef.current.set(trackId, Date.now());
                }
            }
        }
    }, [faces, results, wsStatus, sendFaceData]);

    // Regular face recognition loop
    useEffect(() => {
        if (!cameraReady || wsStatus !== 'connected') return;

        const sendForRecognition = () => {
            const now = Date.now();

            for (const [trackId, face] of faces) {
                if (!face.isVisible) continue;

                const lastSend = lastSendTimeRef.current.get(trackId) || 0;
                const interval = burstModeRef.current ? BURST_DELAY : RECOGNITION_INTERVAL;

                if (now - lastSend >= interval) {
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

    // Open modal for NEW person
    const handleAddPerson = useCallback((trackId: string) => {
        const face = faces.get(trackId);
        if (face && videoRef.current) {
            setModalFaceImage(cropFaceFromVideo(videoRef.current, face.bbox) || '');
        }
        setModalTrackId(trackId);
        setEditingPerson(null);
        setShowModal(true);
    }, [faces]);

    // Open modal for EXISTING person (modify)
    const handleModifyPerson = useCallback((personId: string) => {
        for (const result of results.values()) {
            if (result.person?.id === personId) {
                setEditingPerson(result.person);
                setModalTrackId('');
                setModalFaceImage('');
                setShowModal(true);
                return;
            }
        }
    }, [results]);

    // Handle modal submit
    const handleModalSubmit = useCallback(async (data: RegistrationData) => {
        const isEditing = !!editingPerson;
        console.log('[App]', isEditing ? 'Updating:' : 'Creating:', data.name);

        try {
            if (isEditing && editingPerson) {
                await fetch(`http://localhost:8000/people/${editingPerson.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: data.name,
                        relation: data.relation,
                        last_met: data.lastMet,
                        context: data.context,
                    }),
                });
            } else {
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

                if (data.faceImageBase64) {
                    await fetch(`http://localhost:8000/register-face/${person.id}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            track_id: data.trackId,
                            image_base64: data.faceImageBase64,
                        }),
                    });
                }

                // Clear result to force re-recognition
                clearResult(data.trackId);
                lastSendTimeRef.current.delete(data.trackId);

                // Burst recognition for immediate update
                const bursts = [0, 100, 200, 300, 500];
                bursts.forEach(delay => {
                    setTimeout(() => {
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
                    }, delay);
                });
            }
        } catch (error) {
            console.error('[App] Error:', error);
            alert('Failed. See console.');
        }
    }, [editingPerson, clearResult, faces, sendFaceData]);

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
                    faces={faces}
                    results={results}
                    containerWidth={dimensions.width}
                    containerHeight={dimensions.height}
                    onAddPerson={handleAddPerson}
                    onModifyPerson={handleModifyPerson}
                />
            )}

            <button className="back-button" onClick={() => setIsDemoActive(false)}>
                ← Back
            </button>

            <RegistrationModal
                isOpen={showModal}
                trackId={modalTrackId}
                faceImageBase64={modalFaceImage}
                existingPerson={editingPerson}
                onClose={() => setShowModal(false)}
                onSubmit={handleModalSubmit}
            />
        </div>
    );
}

export default App;
