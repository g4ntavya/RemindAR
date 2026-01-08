/**
 * AR Overlay - Labels for detected faces
 */

import { TrackedFace, RecognitionResult } from '../types';

interface AROverlayProps {
    faces: Map<string, TrackedFace>;
    results: Map<string, RecognitionResult>;
    containerWidth: number;
    containerHeight: number;
    onAddPerson?: (trackId: string) => void;
}

export function AROverlay({
    faces,
    results,
    containerWidth,
    containerHeight,
    onAddPerson,
}: AROverlayProps) {
    const visibleFaces = Array.from(faces.values()).filter(f => f.isVisible);

    return (
        <div className="ar-overlay">
            {/* Debug */}
            <div className="debug-indicator">
                {visibleFaces.length} face{visibleFaces.length !== 1 ? 's' : ''} | {results.size} result{results.size !== 1 ? 's' : ''}
            </div>

            {/* Face labels */}
            {visibleFaces.map((face) => {
                const result = results.get(face.id);
                const isKnown = result?.is_known ?? false;
                const name = result?.display_lines?.[0] || 'Scanning...';
                const relation = result?.display_lines?.[1] || '';

                // Position at right edge of face (mirrored)
                const x = Math.min(
                    Math.max(20, (1 - face.bbox.x) * containerWidth + 20),
                    containerWidth - 250
                );
                const y = Math.min(
                    Math.max(60, (face.bbox.y + face.bbox.height / 2) * containerHeight),
                    containerHeight - 100
                );

                return (
                    <div key={face.id} className="face-label" style={{ left: x, top: y }}>
                        <div className="label-content">
                            <span className="label-name">{name}</span>
                            {relation && <span className="label-relation">{relation}</span>}
                        </div>

                        {!isKnown && onAddPerson && (
                            <button
                                className="add-person-btn"
                                onClick={() => onAddPerson(face.id)}
                            >
                                Add this person
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
