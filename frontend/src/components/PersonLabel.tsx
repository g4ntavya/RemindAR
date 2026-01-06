/**
 * Individual Person Label for AR overlay
 * Displays name, relation, and context with CSS animations
 */

import { Html } from '@react-three/drei';
import { useState, useEffect } from 'react';

interface PersonLabelProps {
    position: [number, number, number];
    displayLines: string[];
    isKnown: boolean;
    isVisible: boolean;
}

export function PersonLabel({
    position,
    displayLines,
    isKnown,
    isVisible
}: PersonLabelProps) {
    const [show, setShow] = useState(false);
    const [opacity, setOpacity] = useState(0);

    // Fade in/out animation
    useEffect(() => {
        if (isVisible) {
            setShow(true);
            // Fade in
            requestAnimationFrame(() => setOpacity(1));
        } else {
            // Fade out
            setOpacity(0);
            // Hide after animation
            const timeout = setTimeout(() => setShow(false), 300);
            return () => clearTimeout(timeout);
        }
    }, [isVisible]);

    if (!show) return null;

    const [name, relation, context] = displayLines;

    return (
        <group position={position}>
            <Html
                center
                style={{
                    opacity,
                    transition: 'opacity 0.3s ease-out, transform 0.3s ease-out',
                    transform: `translateY(${isVisible ? 0 : -10}px)`,
                    pointerEvents: 'none',
                }}
            >
                <div
                    className="ar-label"
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        minWidth: '150px',
                    }}
                >
                    {/* Name - primary line */}
                    <div
                        className="ar-label-name"
                        style={{
                            color: isKnown ? '#ffffff' : '#94a3b8',
                        }}
                    >
                        {name || 'Scanning...'}
                    </div>

                    {/* Relation - secondary line */}
                    {relation && (
                        <div className="ar-label-relation">
                            {relation}
                        </div>
                    )}

                    {/* Context - tertiary line */}
                    {context && (
                        <div className="ar-label-context">
                            {context}
                        </div>
                    )}
                </div>
            </Html>
        </group>
    );
}
