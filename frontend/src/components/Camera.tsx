/**
 * Camera component for webcam capture
 * Handles getUserMedia and video element management
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
            const initCamera = async () => {
                try {
                    // Request camera access with optimal settings for face detection
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: {
                            width: { ideal: 1280 },
                            height: { ideal: 720 },
                            facingMode: 'user', // Front camera
                            frameRate: { ideal: 30 },
                        },
                        audio: false,
                    });

                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;

                        // Wait for video to be ready
                        videoRef.current.onloadedmetadata = () => {
                            videoRef.current?.play().then(() => {
                                setIsLoading(false);
                                onReady?.();
                                console.log('[Camera] Video stream ready');
                            });
                        };
                    }
                } catch (err) {
                    console.error('[Camera] Error accessing camera:', err);
                    const errorMessage = err instanceof Error
                        ? err.message
                        : 'Failed to access camera';
                    onError?.(errorMessage);
                }
            };

            initCamera();

            // Cleanup: stop tracks on unmount
            return () => {
                if (videoRef.current?.srcObject) {
                    const stream = videoRef.current.srcObject as MediaStream;
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
