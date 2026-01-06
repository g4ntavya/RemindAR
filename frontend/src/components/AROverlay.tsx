/**
 * AR Overlay component using Three.js
 * Renders floating text labels in 3D space anchored to faces
 */

import { Canvas } from '@react-three/fiber';
import { TrackedFace, RecognitionResult } from '../types';
import { PersonLabel } from './PersonLabel';
import { calculateLabelPosition } from '../utils/faceUtils';

interface AROverlayProps {
    faces: Map<string, TrackedFace>;
    results: Map<string, RecognitionResult>;
    containerWidth: number;
    containerHeight: number;
}

export function AROverlay({
    faces,
    results,
    containerWidth,
    containerHeight
}: AROverlayProps) {
    // Convert face positions to 3D label positions
    const labels = Array.from(faces.entries()).map(([trackId, face]) => {
        const result = results.get(trackId);

        // Calculate screen position for the label
        const screenPos = calculateLabelPosition(
            face.bbox,
            containerWidth,
            containerHeight,
            true // mirrored
        );

        // Convert screen coordinates to Three.js normalized coordinates
        // Three.js uses a coordinate system where:
        // x: -1 (left) to 1 (right)
        // y: -1 (bottom) to 1 (top)
        const threeX = (screenPos.x / containerWidth) * 2 - 1;
        const threeY = -((screenPos.y / containerHeight) * 2 - 1);

        return {
            trackId,
            position: [threeX * 5, threeY * 3, 0] as [number, number, number],
            displayLines: result?.display_lines || ['Analyzing...', '', ''],
            isKnown: result?.is_known || false,
            isVisible: face.isVisible,
        };
    });

    return (
        <div className="ar-overlay">
            <Canvas
                orthographic
                camera={{
                    zoom: 100,
                    position: [0, 0, 10],
                    near: 0.1,
                    far: 100,
                }}
                style={{
                    background: 'transparent',
                    pointerEvents: 'none',
                }}
            >
                {/* Ambient light for HTML elements */}
                <ambientLight intensity={1} />

                {/* Render labels for each tracked face */}
                {labels.map(label => (
                    <PersonLabel
                        key={label.trackId}
                        position={label.position}
                        displayLines={label.displayLines}
                        isKnown={label.isKnown}
                        isVisible={label.isVisible}
                    />
                ))}
            </Canvas>
        </div>
    );
}
