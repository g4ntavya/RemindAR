/**
 * Camera component for webcam capture
 * Handles getUserMedia with Safari compatibility
 */

import { useEffect, useRef, useState, forwardRef } from 'react';

interface CameraProps {
    onReady?: () => void;
    onError?: (error: string) => void;
}

export const Camera = forwardRef<HTMLVideoElement, CameraProps>(
    ({ onReady, onError }, ref) => {
        const [isLoading, setIsLoading] = useState(true);
        const localRef = useRef<HTMLVideoElement>(null);
        const videoRef = (ref as React.RefObject<HTMLVideoElement>) || localRef;

        useEffect(() => {
            let stream: MediaStream | null = null;

            const initCamera = async () => {
                try {
                    // Check for getUserMedia support (with Safari fallback)
                    const getUserMedia =
                        navigator.mediaDevices?.getUserMedia ||
                        // @ts-expect-error - Safari legacy
                        navigator.webkitGetUserMedia ||
                        // @ts-expect-error - Firefox legacy
                        navigator.mozGetUserMedia;

                    if (!getUserMedia) {
                        throw new Error('Camera not supported in this browser');
                    }

                    // Request camera access with Safari-compatible constraints
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: {
                            width: { ideal: 1280, max: 1920 },
                            height: { ideal: 720, max: 1080 },
                            facingMode: 'user',
                            // Safari-friendly frame rate
                            frameRate: { ideal: 30, max: 30 },
                        },
                        audio: false,
                    });

                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;

                        // Wait for video to be ready
                        videoRef.current.onloadedmetadata = () => {
                            if (videoRef.current) {
                                // Safari needs explicit play call
                                const playPromise = videoRef.current.play();

                                if (playPromise !== undefined) {
                                    playPromise
                                        .then(() => {
                                            setIsLoading(false);
                                            onReady?.();
                                            console.log('[Camera] Video stream ready');
                                        })
                                        .catch((err) => {
                                            console.error('[Camera] Play failed:', err);
                                            // Try again with muted (autoplay policy)
                                            if (videoRef.current) {
                                                videoRef.current.muted = true;
                                                videoRef.current.play().then(() => {
                                                    setIsLoading(false);
                                                    onReady?.();
                                                });
                                            }
                                        });
                                }
                            }
                        };
                    }
                } catch (err) {
                    console.error('[Camera] Error accessing camera:', err);
                    let errorMessage = 'Failed to access camera';

                    if (err instanceof Error) {
                        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                            errorMessage = 'Camera permission denied. Please allow camera access.';
                        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                            errorMessage = 'No camera found. Please connect a camera.';
                        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                            errorMessage = 'Camera is in use by another application.';
                        } else if (err.name === 'OverconstrainedError') {
                            errorMessage = 'Camera does not meet requirements.';
                        } else {
                            errorMessage = err.message;
                        }
                    }

                    onError?.(errorMessage);
                }
            };

            initCamera();

            // Cleanup: stop tracks on unmount
            return () => {
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                }
            };
        }, [onReady, onError, videoRef]);

        return (
            <div className="video-container">
                <video
                    ref={videoRef}
                    className="video-feed"
                    autoPlay
                    playsInline
                    muted
                    // Safari-specific attributes

                    webkit-playsinline="true"
                    style={{ opacity: isLoading ? 0 : 1 }}
                />
                {isLoading && (
                    <div className="loading-container">
                        <div className="loading-spinner" />
                        <p className="loading-text">Starting camera...</p>
                    </div>
                )}
            </div>
        );
    }
);

Camera.displayName = 'Camera';
