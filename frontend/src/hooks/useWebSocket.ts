/**
 * WebSocket hook - FIXED VERSION
 * 
 * ROOT CAUSE OF TAB-SWITCH BUG:
 * - Previously returned resultsRef.current (same Map reference)
 * - React couldn't detect the Map had changed because reference was same
 * - Now we create a NEW Map on every update so React sees a new object
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ConnectionStatus, FaceData, RecognitionResult } from '../types';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';
const HEARTBEAT_INTERVAL = 15000;

interface UseWebSocketReturn {
    status: ConnectionStatus;
    sendFaceData: (data: FaceData) => void;
    results: Map<string, RecognitionResult>;
    clearResult: (trackId: string) => void;
    clearAllResults: () => void;
}

export function useWebSocket(): UseWebSocketReturn {
    const [status, setStatus] = useState<ConnectionStatus>('connecting');

    // KEY FIX: Use useState for results so React tracks changes
    const [results, setResults] = useState<Map<string, RecognitionResult>>(new Map());

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
    const heartbeatRef = useRef<ReturnType<typeof setInterval>>();
    const mountedRef = useRef(true);

    const connect = useCallback(() => {
        if (!mountedRef.current) return;
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        console.log('[WS] Connecting...');
        setStatus('connecting');

        try {
            const ws = new WebSocket(WS_URL);

            ws.onopen = () => {
                console.log('[WS] Connected');
                setStatus('connected');

                heartbeatRef.current = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'ping' }));
                    }
                }, HEARTBEAT_INTERVAL);
            };

            ws.onclose = () => {
                console.log('[WS] Disconnected');
                setStatus('disconnected');

                if (heartbeatRef.current) clearInterval(heartbeatRef.current);
                if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

                if (mountedRef.current) {
                    console.log('[WS] Reconnecting in 2s...');
                    reconnectTimeoutRef.current = setTimeout(connect, 2000);
                }
            };

            ws.onerror = () => { };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);

                    if (message.type === 'recognition_result' && message.data) {
                        const result = message.data as RecognitionResult;
                        const name = result.is_known ? result.display_lines?.[0] : 'Unknown';
                        console.log(`[WS] ${result.track_id.slice(0, 6)} -> ${name}`);

                        // KEY FIX: Create NEW Map to trigger React re-render
                        setResults(prev => {
                            const next = new Map(prev);
                            next.set(result.track_id, result);
                            return next;
                        });
                    }

                    // Person registered or updated - clear results to force re-recognition
                    if (message.type === 'person_registered' && message.data) {
                        console.log('[WS] Person registered:', message.data.name);
                        setResults(new Map());
                    }

                    if (message.type === 'person_updated' && message.data) {
                        console.log('[WS] Person updated:', message.data.name);
                        setResults(new Map());
                    }

                    if (message.type === 'person_deleted' && message.data) {
                        console.log('[WS] Person deleted:', message.data.id);
                        setResults(new Map());
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

    const sendFaceData = useCallback((data: FaceData) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) return;

        wsRef.current.send(JSON.stringify({
            type: 'face_data',
            data: {
                track_id: data.track_id,
                image_base64: data.image_base64,
                bbox: data.bbox,
                timestamp: data.timestamp || Date.now(),
            },
        }));
    }, []);

    const clearResult = useCallback((trackId: string) => {
        setResults(prev => {
            const next = new Map(prev);
            next.delete(trackId);
            return next;
        });
    }, []);

    const clearAllResults = useCallback(() => {
        setResults(new Map());
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        connect();

        return () => {
            mountedRef.current = false;
            if (heartbeatRef.current) clearInterval(heartbeatRef.current);
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [connect]);

    return {
        status,
        sendFaceData,
        results,
        clearResult,
        clearAllResults,
    };
}
