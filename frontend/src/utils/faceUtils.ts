/**
 * Utility functions for RemindAR
 * Includes face cropping, coordinate conversion, and interpolation
 */

import { BoundingBox, TrackedFace } from '../types';

/**
 * Linear interpolation between two values
 * Used for smooth bounding box transitions
 */
export function lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * factor;
}

/**
 * Lerp a bounding box for smooth transitions
 */
export function lerpBoundingBox(
    current: BoundingBox,
    target: BoundingBox,
    factor: number
): BoundingBox {
    return {
        x: lerp(current.x, target.x, factor),
        y: lerp(current.y, target.y, factor),
        width: lerp(current.width, target.width, factor),
        height: lerp(current.height, target.height, factor),
    };
}

/**
 * Generate a unique tracking ID for a face
 */
export function generateTrackId(): string {
    return `face_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculate distance between two bounding box centers
 * Used for face tracking across frames
 */
export function bboxDistance(a: BoundingBox, b: BoundingBox): number {
    const aCenterX = a.x + a.width / 2;
    const aCenterY = a.y + a.height / 2;
    const bCenterX = b.x + b.width / 2;
    const bCenterY = b.y + b.height / 2;

    return Math.sqrt(
        Math.pow(aCenterX - bCenterX, 2) +
        Math.pow(aCenterY - bCenterY, 2)
    );
}

/**
 * Crop a face region from a video element
 * Returns base64-encoded JPEG
 */
export function cropFaceFromVideo(
    video: HTMLVideoElement,
    bbox: BoundingBox,
    padding: number = 0.2
): string | null {
    if (!video.videoWidth || !video.videoHeight) {
        return null;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Calculate pixel coordinates with padding
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    // Add padding to capture more context (hair, ears, etc.)
    const paddedWidth = bbox.width * (1 + padding * 2);
    const paddedHeight = bbox.height * (1 + padding * 2);
    const paddedX = bbox.x - bbox.width * padding;
    const paddedY = bbox.y - bbox.height * padding;

    // Convert normalized to pixel coordinates
    let x = paddedX * videoWidth;
    let y = paddedY * videoHeight;
    let width = paddedWidth * videoWidth;
    let height = paddedHeight * videoHeight;

    // Clamp to video bounds
    x = Math.max(0, x);
    y = Math.max(0, y);
    width = Math.min(width, videoWidth - x);
    height = Math.min(height, videoHeight - y);

    // Set canvas size (max 256px for efficiency)
    const maxSize = 256;
    const scale = Math.min(maxSize / width, maxSize / height, 1);
    canvas.width = width * scale;
    canvas.height = height * scale;

    // Mirror the crop to match the mirrored video display
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);

    // Draw cropped region
    ctx.drawImage(
        video,
        x, y, width, height,
        0, 0, canvas.width, canvas.height
    );

    // Convert to base64 JPEG
    return canvas.toDataURL('image/jpeg', 0.8);
}

/**
 * Convert normalized coordinates to screen pixels
 * Accounts for video mirroring
 */
export function normalizedToScreen(
    normalized: { x: number; y: number },
    containerWidth: number,
    containerHeight: number,
    mirrored: boolean = true
): { x: number; y: number } {
    return {
        x: mirrored
            ? containerWidth - (normalized.x * containerWidth)
            : normalized.x * containerWidth,
        y: normalized.y * containerHeight,
    };
}

/**
 * Calculate AR label position (above-right of face)
 */
export function calculateLabelPosition(
    bbox: BoundingBox,
    containerWidth: number,
    containerHeight: number,
    mirrored: boolean = true
): { x: number; y: number } {
    // Position: slightly above and to the right of the face
    const faceCenter = {
        x: bbox.x + bbox.width / 2,
        y: bbox.y,
    };

    // Offset: 10% right, 5% up from top of face
    const offset = {
        x: bbox.width * 0.3,
        y: -bbox.height * 0.1,
    };

    const labelNormalized = {
        x: faceCenter.x + offset.x,
        y: faceCenter.y + offset.y,
    };

    return normalizedToScreen(labelNormalized, containerWidth, containerHeight, mirrored);
}

/**
 * Match detected faces to existing tracked faces
 * Uses distance-based matching with a threshold
 */
export function matchFaces(
    newDetections: BoundingBox[],
    existingFaces: Map<string, TrackedFace>,
    maxDistance: number = 0.15
): Map<string, BoundingBox> {
    const matches = new Map<string, BoundingBox>();
    const usedDetections = new Set<number>();

    // Try to match existing faces to new detections
    for (const [id, face] of existingFaces) {
        let bestMatch: { index: number; distance: number } | null = null;

        for (let i = 0; i < newDetections.length; i++) {
            if (usedDetections.has(i)) continue;

            const distance = bboxDistance(face.bbox, newDetections[i]);
            if (distance < maxDistance && (!bestMatch || distance < bestMatch.distance)) {
                bestMatch = { index: i, distance };
            }
        }

        if (bestMatch) {
            matches.set(id, newDetections[bestMatch.index]);
            usedDetections.add(bestMatch.index);
        }
    }

    // Create new IDs for unmatched detections
    for (let i = 0; i < newDetections.length; i++) {
        if (!usedDetections.has(i)) {
            matches.set(generateTrackId(), newDetections[i]);
        }
    }

    return matches;
}

/**
 * Debounce function for rate-limiting operations
 */
export function debounce<T extends (...args: unknown[]) => void>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    return (...args: Parameters<T>) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

/**
 * Throttle function for limiting call frequency
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throttle<T extends (...args: any[]) => void>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle = false;

    return (...args: Parameters<T>) => {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => { inThrottle = false; }, limit);
        }
    };
}
