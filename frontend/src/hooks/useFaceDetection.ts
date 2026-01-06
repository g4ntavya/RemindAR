/**
 * Face detection hook - Simplified version
 * Uses browser's native FaceDetector API (Chrome/Edge) or provides mock data
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { BoundingBox, TrackedFace } from '../types';
import {
    lerpBoundingBox,
    matchFaces
} from '../utils/faceUtils';

// Smoothing factor for bounding box interpolation
const LERP_FACTOR = 0.3;

// How long a face can be missing before it's removed (ms)
const FACE_TIMEOUT = 500;

// Detection interval (ms)
const DETECTION_INTERVAL = 150;

interface UseFaceDetectionReturn {
    faces: Map<string, TrackedFace>;
    isModelLoaded: boolean;
    error: string | null;
}

// Check if native FaceDetector API is available (Chrome 70+ with flag, Edge)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const hasNativeFaceDetector = typeof (window as any).FaceDetector !== 'undefined';

export function useFaceDetection(
    videoRef: React.RefObject<HTMLVideoElement | null>
): UseFaceDetectionReturn {
    const [faces, setFaces] = useState<Map<string, TrackedFace>>(new Map());
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detectorRef = useRef<any>(null);
    const animationFrameRef = useRef<number>();
    const lastDetectionRef = useRef<number>(0);
    const facesRef = useRef<Map<string, TrackedFace>>(new Map());
    const isProcessingRef = useRef(false);
    const mediaPipeLoadedRef = useRef(false);

    // Keep ref in sync with state
    useEffect(() => {
        facesRef.current = faces;
    }, [faces]);

    // Common face update logic
    const updateFaces = useCallback((newDetections: BoundingBox[], now: number) => {
        const matches = matchFaces(newDetections, facesRef.current);
        const updatedFaces = new Map<string, TrackedFace>();

        for (const [id, newBbox] of matches) {
            const existingFace = facesRef.current.get(id);

            if (existingFace) {
                const smoothedBbox = lerpBoundingBox(existingFace.bbox, newBbox, LERP_FACTOR);
                updatedFaces.set(id, {
                    ...existingFace,
                    bbox: smoothedBbox,
                    rawBbox: newBbox,
                    lastSeen: now,
                    isVisible: true,
                });
            } else {
                updatedFaces.set(id, {
                    id,
                    bbox: newBbox,
                    rawBbox: newBbox,
                    confidence: 1.0,
                    lastSeen: now,
                    isVisible: true,
                });
            }
        }

        // Keep faces that haven't timed out
        for (const [id, face] of facesRef.current) {
            if (!updatedFaces.has(id)) {
                if (now - face.lastSeen < FACE_TIMEOUT) {
                    updatedFaces.set(id, { ...face, isVisible: false });
                }
            }
        }

        setFaces(updatedFaces);
        isProcessingRef.current = false;
    }, []);

    // Initialize detector
    useEffect(() => {
        let mounted = true;

        const init = async () => {
            // Try native FaceDetector first
            if (hasNativeFaceDetector) {
                try {
                    console.log('[FaceDetection] Trying native FaceDetector...');
                    // @ts-expect-error - FaceDetector not in TS types
                    detectorRef.current = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
                    if (mounted) {
                        setIsModelLoaded(true);
                        console.log('[FaceDetection] Native FaceDetector ready!');
                    }
                    return;
                } catch (e) {
                    console.log('[FaceDetection] Native FaceDetector not available:', e);
                }
            }

            // Try loading MediaPipe from CDN
            try {
                console.log('[FaceDetection] Loading MediaPipe...');
                await loadMediaPipe();

                if (!mounted) return;

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const FaceDetection = (window as any).FaceDetection;
                if (!FaceDetection) throw new Error('MediaPipe not loaded');

                const detector = new FaceDetection({
                    locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4/${file}`,
                });

                detector.setOptions({ model: 'short', minDetectionConfidence: 0.5 });

                detector.onResults((results: { detections?: Array<{ boundingBox: { xCenter: number; yCenter: number; width: number; height: number } }> }) => {
                    const now = Date.now();
                    const detections: BoundingBox[] = (results.detections || []).map(det => ({
                        x: det.boundingBox.xCenter - det.boundingBox.width / 2,
                        y: det.boundingBox.yCenter - det.boundingBox.height / 2,
                        width: det.boundingBox.width,
                        height: det.boundingBox.height,
                    }));
                    updateFaces(detections, now);
                });

                detectorRef.current = detector;
                mediaPipeLoadedRef.current = true;
                if (mounted) {
                    setIsModelLoaded(true);
                    console.log('[FaceDetection] MediaPipe ready!');
                }
            } catch (e) {
                console.error('[FaceDetection] MediaPipe failed:', e);
                // Don't block - allow app to work without face detection
                if (mounted) {
                    setError('Face detection unavailable. Try Chrome or refresh.');
                    setIsModelLoaded(true); // Still allow app to function
                }
            }
        };

        init();

        return () => {
            mounted = false;
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [updateFaces]);

    // Detection loop
    const detect = useCallback(async () => {
        const video = videoRef.current;
        const detector = detectorRef.current;

        if (!video || video.readyState < 2 || !video.videoWidth) {
            animationFrameRef.current = requestAnimationFrame(detect);
            return;
        }

        const now = Date.now();

        if (now - lastDetectionRef.current >= DETECTION_INTERVAL && !isProcessingRef.current && detector) {
            isProcessingRef.current = true;
            lastDetectionRef.current = now;

            try {
                if (mediaPipeLoadedRef.current) {
                    // MediaPipe async
                    await detector.send({ image: video });
                } else {
                    // Native FaceDetector
                    const detected = await detector.detect(video);
                    const detections: BoundingBox[] = detected.map((face: { boundingBox: DOMRectReadOnly }) => ({
                        x: face.boundingBox.x / video.videoWidth,
                        y: face.boundingBox.y / video.videoHeight,
                        width: face.boundingBox.width / video.videoWidth,
                        height: face.boundingBox.height / video.videoHeight,
                    }));
                    updateFaces(detections, now);
                }
            } catch (e) {
                console.error('[FaceDetection] Error:', e);
                isProcessingRef.current = false;
            }
        }

        animationFrameRef.current = requestAnimationFrame(detect);
    }, [videoRef, updateFaces]);

    // Start loop when ready
    useEffect(() => {
        if (isModelLoaded) {
            console.log('[FaceDetection] Starting detection loop');
            detect();
        }
        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [isModelLoaded, detect]);

    return { faces, isModelLoaded, error };
}

// Load MediaPipe script
function loadMediaPipe(): Promise<void> {
    return new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((window as any).FaceDetection) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4/face_detection.js';
        script.crossOrigin = 'anonymous';
        script.onload = () => setTimeout(resolve, 200); // Give it time to initialize
        script.onerror = () => reject(new Error('Failed to load MediaPipe'));
        document.head.appendChild(script);
    });
}
