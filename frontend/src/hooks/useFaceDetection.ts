/**
 * Face detection hook - Cross-browser compatible
 * 
 * Strategy:
 * 1. Try native Shape Detection API (Chrome/Edge experimental)
 * 2. Fall back to MediaPipe (Chrome, most browsers)
 * 3. For Safari: Provide visual feedback that face detection is limited
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { BoundingBox, TrackedFace } from '../types';
import { lerpBoundingBox, matchFaces } from '../utils/faceUtils';

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

// Detect browser
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const isChrome = /chrome/i.test(navigator.userAgent) && !/edge/i.test(navigator.userAgent);

export function useFaceDetection(
    videoRef: React.RefObject<HTMLVideoElement | null>
): UseFaceDetectionReturn {
    const [faces, setFaces] = useState<Map<string, TrackedFace>>(new Map());
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detectorRef = useRef<any>(null);
    const detectorTypeRef = useRef<'native' | 'mediapipe' | 'none'>('none');
    const animationFrameRef = useRef<number>();
    const lastDetectionRef = useRef<number>(0);
    const facesRef = useRef<Map<string, TrackedFace>>(new Map());
    const isProcessingRef = useRef(false);

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
            // For Safari, we'll set a special mode
            if (isSafari) {
                console.log('[FaceDetection] Safari detected, trying MediaPipe...');
            }

            // Try native FaceDetector first (Chrome Origin Trial)
            // @ts-expect-error - FaceDetector not in standard TS types
            if (typeof window.FaceDetector !== 'undefined' && isChrome) {
                try {
                    console.log('[FaceDetection] Trying native FaceDetector...');
                    // @ts-expect-error - FaceDetector not in standard TS types
                    const detector = new window.FaceDetector({
                        fastMode: true,
                        maxDetectedFaces: 5
                    });

                    if (mounted) {
                        detectorRef.current = detector;
                        detectorTypeRef.current = 'native';
                        setIsModelLoaded(true);
                        console.log('[FaceDetection] Native FaceDetector ready!');
                    }
                    return;
                } catch (e) {
                    console.log('[FaceDetection] Native FaceDetector not available:', e);
                }
            }

            // Try MediaPipe
            try {
                console.log('[FaceDetection] Loading MediaPipe from CDN...');
                await loadMediaPipe();

                if (!mounted) return;

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const FaceDetection = (window as any).FaceDetection;
                if (!FaceDetection) throw new Error('MediaPipe failed to initialize');

                const detector = new FaceDetection({
                    locateFile: (file: string) =>
                        `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4/${file}`,
                });

                detector.setOptions({
                    model: 'short',
                    minDetectionConfidence: 0.5
                });

                detector.onResults((results: {
                    detections?: Array<{
                        boundingBox: { xCenter: number; yCenter: number; width: number; height: number }
                    }>
                }) => {
                    const now = Date.now();
                    const detections: BoundingBox[] = (results.detections || []).map(det => ({
                        x: det.boundingBox.xCenter - det.boundingBox.width / 2,
                        y: det.boundingBox.yCenter - det.boundingBox.height / 2,
                        width: det.boundingBox.width,
                        height: det.boundingBox.height,
                    }));
                    updateFaces(detections, now);
                });

                if (mounted) {
                    detectorRef.current = detector;
                    detectorTypeRef.current = 'mediapipe';
                    setIsModelLoaded(true);
                    console.log('[FaceDetection] MediaPipe ready!');
                }
            } catch (e) {
                console.error('[FaceDetection] MediaPipe failed:', e);

                if (mounted) {
                    // Allow app to work without face detection
                    if (isSafari) {
                        setError('Face detection limited on Safari. Try Chrome for best experience.');
                    } else {
                        setError('Face detection unavailable. Refresh to retry.');
                    }
                    detectorTypeRef.current = 'none';
                    setIsModelLoaded(true); // Don't block UI
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
        const detectorType = detectorTypeRef.current;

        // Skip if no video or detector
        if (!video || video.readyState < 2 || !video.videoWidth) {
            animationFrameRef.current = requestAnimationFrame(detect);
            return;
        }

        const now = Date.now();

        // Throttle and prevent stacking
        if (now - lastDetectionRef.current >= DETECTION_INTERVAL && !isProcessingRef.current) {
            if (detector && detectorType !== 'none') {
                isProcessingRef.current = true;
                lastDetectionRef.current = now;

                try {
                    if (detectorType === 'native') {
                        // Native FaceDetector API
                        const detected = await detector.detect(video);
                        const detections: BoundingBox[] = detected.map(
                            (face: { boundingBox: DOMRectReadOnly }) => ({
                                x: face.boundingBox.x / video.videoWidth,
                                y: face.boundingBox.y / video.videoHeight,
                                width: face.boundingBox.width / video.videoWidth,
                                height: face.boundingBox.height / video.videoHeight,
                            })
                        );
                        updateFaces(detections, now);
                    } else if (detectorType === 'mediapipe') {
                        // MediaPipe - results come via callback
                        await detector.send({ image: video });
                    }
                } catch (e) {
                    console.error('[FaceDetection] Detection error:', e);
                    isProcessingRef.current = false;
                }
            }
        }

        animationFrameRef.current = requestAnimationFrame(detect);
    }, [videoRef, updateFaces]);

    // Start detection loop
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

// Load MediaPipe script from CDN
function loadMediaPipe(): Promise<void> {
    return new Promise((resolve, reject) => {
        // Already loaded?
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((window as any).FaceDetection) {
            resolve();
            return;
        }

        // Already loading?
        const existing = document.getElementById('mediapipe-script');
        if (existing) {
            existing.addEventListener('load', () => resolve());
            existing.addEventListener('error', () => reject(new Error('Script load failed')));
            return;
        }

        const script = document.createElement('script');
        script.id = 'mediapipe-script';
        script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4/face_detection.js';
        script.crossOrigin = 'anonymous';

        script.onload = () => {
            console.log('[FaceDetection] MediaPipe script loaded');
            // Wait for initialization
            setTimeout(resolve, 300);
        };

        script.onerror = () => {
            console.error('[FaceDetection] MediaPipe script failed to load');
            reject(new Error('Failed to load MediaPipe'));
        };

        document.head.appendChild(script);
    });
}
