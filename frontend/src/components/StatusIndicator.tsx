/**
 * Status indicator component
 * Shows WebSocket connection status and face detection state
 */

import { ConnectionStatus } from '../types';

interface StatusIndicatorProps {
    connectionStatus: ConnectionStatus;
    facesDetected: number;
    isModelLoaded: boolean;
    detectionError?: string | null;
}

export function StatusIndicator({
    connectionStatus,
    facesDetected,
    isModelLoaded,
    detectionError
}: StatusIndicatorProps) {
    const getStatusText = () => {
        if (detectionError) {
            return `Detection error: ${detectionError}`;
        }

        if (!isModelLoaded) {
            return 'Loading face detection model...';
        }

        switch (connectionStatus) {
            case 'connected':
                return facesDetected > 0
                    ? `${facesDetected} face${facesDetected > 1 ? 's' : ''} detected`
                    : 'Ready - Looking for faces...';
            case 'connecting':
                return 'Connecting to server...';
            case 'disconnected':
                return 'Server disconnected - Reconnecting...';
        }
    };

    const getStatusClass = () => {
        if (detectionError) return 'disconnected';
        if (!isModelLoaded) return 'connecting';
        return connectionStatus;
    };

    return (
        <div className="status-indicator">
            <div className={`status-dot ${getStatusClass()}`} />
            <span className="status-text">{getStatusText()}</span>
        </div>
    );
}
