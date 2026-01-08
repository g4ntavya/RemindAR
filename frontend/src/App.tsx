/**
 * RemindAR - Main Application
 * With modify person functionality
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

const RECOGNITION_INTERVAL = 500;

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

    // Hooks
    const { status: wsStatus, sendFaceData, results, clearResult } = useWebSocket();
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

    // Open modal for NEW person
    const handleAddPerson = useCallback((trackId: string) => {
        const face = faces.get(trackId);
        if (face && videoRef.current) {
            setModalFaceImage(cropFaceFromVideo(videoRef.current, face.bbox) || '');
        }
        setModalTrackId(trackId);
        setEditingPerson(null); // Not editing, creating new
        setShowModal(true);
    }, [faces]);

    // Open modal for EXISTING person (modify)
    const handleModifyPerson = useCallback((personId: string) => {
        // Find the person from results
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

    // Handle modal submit (create or update)
    const handleModalSubmit = useCallback(async (data: RegistrationData) => {
        const isEditing = !!editingPerson;
        console.log('[App]', isEditing ? 'Updating:' : 'Creating:', data.name);

        try {
            if (isEditing && editingPerson) {
                // UPDATE existing person
                const updateRes = await fetch(`http://localhost:8000/people/${editingPerson.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: data.name,
                        relation: data.relation,
                        last_met: data.lastMet,
                        context: data.context,
                    }),
                });

                if (!updateRes.ok) throw new Error('Failed to update person');
                console.log('[App] Updated:', data.name);
            } else {
                // CREATE new person
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

                // Register face for new person
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

                // Clear and resend for recognition
                clearResult(data.trackId);
                lastSendTimeRef.current.delete(data.trackId);

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
