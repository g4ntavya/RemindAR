/**
 * WebSocket hook - Fixed version with proper React state updates
 * The key fix: use a counter to force re-renders when results change
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ConnectionStatus, FaceData, RecognitionResult } from '../types';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';

const INITIAL_RETRY_DELAY = 1000;
const MAX_RETRY_DELAY = 10000;
const HEARTBEAT_INTERVAL = 15000;

interface UseWebSocketReturn {
    status: ConnectionStatus;
    sendFaceData: (data: FaceData) => void;
    results: Map<string, RecognitionResult>;
    clearResult: (trackId: string) => void;
    clearAllResults: () => void;
    updateCounter: number; // Force re-render trigger
}

export function useWebSocket(): UseWebSocketReturn {
    const [status, setStatus] = useState<ConnectionStatus>('connecting');
    const [updateCounter, setUpdateCounter] = useState(0);

    // Use ref for results to avoid closure issues, but trigger re-render with counter
    const resultsRef = useRef<Map<string, RecognitionResult>>(new Map());

    const wsRef = useRef<WebSocket | null>(null);
    const retryDelayRef = useRef(INITIAL_RETRY_DELAY);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
    const heartbeatRef = useRef<ReturnType<typeof setInterval>>();
    const mountedRef = useRef(true);

    // Force component re-render
    const forceUpdate = useCallback(() => {
        setUpdateCounter(c => c + 1);
    }, []);

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
                retryDelayRef.current = INITIAL_RETRY_DELAY;

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
                    const delay = retryDelayRef.current;
                    retryDelayRef.current = Math.min(delay * 1.5, MAX_RETRY_DELAY);
                    console.log(`[WS] Reconnecting in ${delay}ms...`);
                    reconnectTimeoutRef.current = setTimeout(connect, delay);
                }
            };

            ws.onerror = () => { };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);

                    if (message.type === 'recognition_result' && message.data) {
                        const result = message.data as RecognitionResult;
                        const name = result.is_known ? result.display_lines?.[0] : 'Unknown';
                        console.log(`[WS] Result: ${result.track_id.slice(0, 6)} -> ${name} (${(result.confidence * 100).toFixed(0)}%)`);

                        // Update ref and force re-render
                        resultsRef.current.set(result.track_id, result);
                        forceUpdate();
                    }

                    if (message.type === 'person_registered' && message.data) {
                        console.log('[WS] Person registered:', message.data.name);
                        // Clear all results to force re-recognition
                        resultsRef.current.clear();
                        forceUpdate();
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
    }, [forceUpdate]);

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
        resultsRef.current.delete(trackId);
        forceUpdate();
    }, [forceUpdate]);

    const clearAllResults = useCallback(() => {
        resultsRef.current.clear();
        forceUpdate();
    }, [forceUpdate]);

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
        results: resultsRef.current,
        clearResult,
        clearAllResults,
        updateCounter,
    };
}
