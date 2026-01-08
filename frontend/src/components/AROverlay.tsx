/**
 * AR Overlay - Labels for detected faces with expandable cards
 */

import { useState } from 'react';
import { TrackedFace, RecognitionResult } from '../types';

interface AROverlayProps {
    faces: Map<string, TrackedFace>;
    results: Map<string, RecognitionResult>;
    containerWidth: number;
    containerHeight: number;
    onAddPerson?: (trackId: string) => void;
    onModifyPerson?: (personId: string) => void;
}

export function AROverlay({
    faces,
    results,
    containerWidth,
    containerHeight,
    onAddPerson,
    onModifyPerson,
}: AROverlayProps) {
    const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
    const visibleFaces = Array.from(faces.values()).filter(f => f.isVisible);

    const toggleExpand = (trackId: string) => {
        setExpandedCards(prev => {
            const next = new Set(prev);
            if (next.has(trackId)) {
                next.delete(trackId);
            } else {
                next.add(trackId);
            }
            return next;
        });
    };

    return (
        <div className="ar-overlay">
            {/* Debug */}
            <div className="debug-indicator">
                {visibleFaces.length} face{visibleFaces.length !== 1 ? 's' : ''}
            </div>

            {/* Face labels */}
            {visibleFaces.map((face) => {
                const result = results.get(face.id);
                const isKnown = result?.is_known ?? false;
                const person = result?.person;
                const name = result?.display_lines?.[0] || 'Scanning...';
                const relation = result?.display_lines?.[1] || '';
                const isExpanded = expandedCards.has(face.id);

                // Position at right edge of face (mirrored)
                const x = Math.min(
                    Math.max(20, (1 - face.bbox.x) * containerWidth + 20),
                    containerWidth - 280
                );
                const y = Math.min(
                    Math.max(60, (face.bbox.y + face.bbox.height / 2) * containerHeight),
                    containerHeight - 150
                );

                return (
                    <div
                        key={face.id}
                        className={`face-label ${isExpanded ? 'expanded' : ''}`}
                        style={{ left: x, top: y }}
                    >
                        <div className="label-content">
                            <div className="label-header">
                                <div className="label-info">
                                    <span className="label-name">{name}</span>
                                    {relation && <span className="label-relation">{relation}</span>}
                                </div>

                                {/* Expand arrow for known persons */}
                                {isKnown && (
                                    <button
                                        className={`expand-btn ${isExpanded ? 'rotated' : ''}`}
                                        onClick={() => toggleExpand(face.id)}
                                    >
                                        ›
                                    </button>
                                )}
                            </div>

                            {/* Context - always visible for known persons */}
                            {isKnown && person?.context && (
                                <p className="label-context">{person.context}</p>
                            )}

                            {/* Date - always visible */}
                            {isKnown && person?.last_met && (
                                <span className="label-date">{person.last_met}</span>
                            )}

                            {/* Modify button - only when expanded */}
                            {isKnown && (
                                <div className={`modify-container ${isExpanded ? 'show' : ''}`}>
                                    <button
                                        className="modify-btn"
                                        onClick={() => person?.id && onModifyPerson?.(person.id)}
                                    >
                                        Modify Details
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Add button for unknown */}
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
