/**
 * Individual Person Label for AR overlay
 * Clean, minimal Helvetica design with backdrop blur
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
    isVisible
}: PersonLabelProps) {
    const [show, setShow] = useState(false);
    const [opacity, setOpacity] = useState(0);

    useEffect(() => {
        if (isVisible) {
            setShow(true);
            requestAnimationFrame(() => setOpacity(1));
        } else {
            setOpacity(0);
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
                    transition: 'opacity 0.3s ease-out',
                    pointerEvents: 'none',
                }}
            >
                <div className="label-container">
                    <span className="label-name">{name || 'Scanning...'}</span>
                    {relation && <span className="label-relation">{relation}</span>}
                    {context && <span className="label-context">{context}</span>}
                </div>
            </Html>
        </group>
    );
}
