/**
 * WebSocket hook for real-time communication with backend
 * Handles connection management, reconnection, and message handling
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ConnectionStatus, FaceData, RecognitionResult } from '../types';

// Backend WebSocket URL
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';

interface UseWebSocketReturn {
    status: ConnectionStatus;
    sendFaceData: (data: FaceData) => void;
    lastResult: RecognitionResult | null;
    results: Map<string, RecognitionResult>;
}

export function useWebSocket(): UseWebSocketReturn {
    const [status, setStatus] = useState<ConnectionStatus>('connecting');
    const [lastResult, setLastResult] = useState<RecognitionResult | null>(null);
    const [results, setResults] = useState<Map<string, RecognitionResult>>(new Map());

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
    const pingIntervalRef = useRef<ReturnType<typeof setInterval>>();

    // Connect to WebSocket
    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        console.log('[WS] Connecting to', WS_URL);
        setStatus('connecting');

        try {
            const ws = new WebSocket(WS_URL);

            ws.onopen = () => {
                console.log('[WS] Connected');
                setStatus('connected');

                // Start ping interval to keep connection alive
                pingIntervalRef.current = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'ping' }));
                    }
                }, 30000);
            };

            ws.onclose = () => {
                console.log('[WS] Disconnected');
                setStatus('disconnected');

                // Clear ping interval
                if (pingIntervalRef.current) {
                    clearInterval(pingIntervalRef.current);
                }

                // Attempt reconnection after delay
                reconnectTimeoutRef.current = setTimeout(() => {
                    console.log('[WS] Attempting reconnection...');
                    connect();
                }, 2000);
            };

            ws.onerror = (error) => {
                console.error('[WS] Error:', error);
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);

                    if (message.type === 'recognition_result' && message.data) {
                        const result = message.data as RecognitionResult;

                        setLastResult(result);
                        setResults(prev => {
                            const updated = new Map(prev);
                            updated.set(result.track_id, result);
                            return updated;
                        });
                    }
                } catch (e) {
                    console.error('[WS] Parse error:', e);
                }
            };

            wsRef.current = ws;
        } catch (error) {
            console.error('[WS] Connection error:', error);
            setStatus('disconnected');
        }
    }, []);

    // Disconnect and cleanup
    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
        }
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
    }, []);

    // Send face data to backend
    const sendFaceData = useCallback((data: FaceData) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
            return;
        }

        const message = {
            type: 'face_data',
            data: {
                track_id: data.track_id,
                image_base64: data.image_base64,
                bbox: data.bbox,
                timestamp: data.timestamp || Date.now(),
            },
        };

        wsRef.current.send(JSON.stringify(message));
    }, []);

    // Connect on mount, disconnect on unmount
    useEffect(() => {
        connect();
        return disconnect;
    }, [connect, disconnect]);

    return {
        status,
        sendFaceData,
        lastResult,
        results,
    };
}
