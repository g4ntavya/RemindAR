/**
 * Speech-to-Text Hook with LLM Extraction
 * Optimized for real-time updates
 */

import { useState, useRef, useCallback, useReducer } from 'react';

interface ExtractedInfo {
    name: string | null;
    relation: string | null;
    context: string | null;
}

interface STTState {
    isRecording: boolean;
    isProcessing: boolean;
    transcript: string;
    extracted: ExtractedInfo | null;
    error: string | null;
    updateKey: number; // Forces re-render
}

type STTAction =
    | { type: 'START_RECORDING' }
    | { type: 'STOP_RECORDING' }
    | { type: 'SET_PROCESSING'; value: boolean }
    | { type: 'SET_TRANSCRIPT'; value: string }
    | { type: 'SET_EXTRACTED'; value: ExtractedInfo }
    | { type: 'SET_ERROR'; value: string }
    | { type: 'RESET' };

function reducer(state: STTState, action: STTAction): STTState {
    switch (action.type) {
        case 'START_RECORDING':
            return { ...state, isRecording: true, error: null, extracted: null, updateKey: state.updateKey + 1 };
        case 'STOP_RECORDING':
            return { ...state, isRecording: false, updateKey: state.updateKey + 1 };
        case 'SET_PROCESSING':
            return { ...state, isProcessing: action.value, updateKey: state.updateKey + 1 };
        case 'SET_TRANSCRIPT':
            return { ...state, transcript: action.value, updateKey: state.updateKey + 1 };
        case 'SET_EXTRACTED':
            return { ...state, extracted: action.value, isProcessing: false, updateKey: state.updateKey + 1 };
        case 'SET_ERROR':
            return { ...state, error: action.value, isProcessing: false, updateKey: state.updateKey + 1 };
        case 'RESET':
            return { ...state, transcript: '', extracted: null, error: null, updateKey: state.updateKey + 1 };
        default:
            return state;
    }
}

const initialState: STTState = {
    isRecording: false,
    isProcessing: false,
    transcript: '',
    extracted: null,
    error: null,
    updateKey: 0,
};

export function useSpeechToText() {
    const [state, dispatch] = useReducer(reducer, initialState);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const startRecording = useCallback(async () => {
        chunksRef.current = [];
        dispatch({ type: 'START_RECORDING' });

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { channelCount: 1, sampleRate: 16000 }
            });

            const mimeType = MediaRecorder.isTypeSupported('audio/webm')
                ? 'audio/webm'
                : 'audio/mp4';

            const mediaRecorder = new MediaRecorder(stream, { mimeType });

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.start(500); // Smaller chunks
            console.log('[STT] Recording...');
        } catch (err) {
            console.error('[STT] Mic error:', err);
            dispatch({ type: 'SET_ERROR', value: 'Microphone access failed' });
        }
    }, []);

    const stopRecording = useCallback(async (): Promise<ExtractedInfo | null> => {
        return new Promise((resolve) => {
            const mediaRecorder = mediaRecorderRef.current;

            if (!mediaRecorder || mediaRecorder.state === 'inactive') {
                resolve(null);
                return;
            }

            mediaRecorder.onstop = async () => {
                dispatch({ type: 'STOP_RECORDING' });
                dispatch({ type: 'SET_PROCESSING', value: true });
                console.log('[STT] Processing...');

                mediaRecorder.stream.getTracks().forEach(track => track.stop());
                const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });

                try {
                    // Transcribe
                    const formData = new FormData();
                    formData.append('audio', audioBlob, 'recording.webm');

                    const transcribeRes = await fetch('http://localhost:8000/api/transcribe', {
                        method: 'POST',
                        body: formData,
                    });

                    const transcribeData = await transcribeRes.json();

                    if (!transcribeData.success || !transcribeData.text) {
                        dispatch({ type: 'SET_ERROR', value: 'Transcription failed' });
                        resolve(null);
                        return;
                    }

                    const text = transcribeData.text.trim();
                    dispatch({ type: 'SET_TRANSCRIPT', value: text });
                    console.log('[STT] Text:', text);

                    // Extract
                    console.log('[STT] Extracting...');
                    const extractRes = await fetch('http://localhost:8000/api/extract', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text }),
                    });

                    const extractData = await extractRes.json();
                    console.log('[STT] Raw extract:', extractData);

                    const info: ExtractedInfo = {
                        name: extractData.name || null,
                        relation: extractData.relation || null,
                        context: extractData.context || null,
                    };

                    console.log('[STT] Extracted:', info);
                    dispatch({ type: 'SET_EXTRACTED', value: info });
                    resolve(info);

                } catch (err) {
                    console.error('[STT] Error:', err);
                    dispatch({ type: 'SET_ERROR', value: 'Processing failed' });
                    resolve(null);
                }
            };

            mediaRecorder.stop();
        });
    }, []);

    const reset = useCallback(() => {
        dispatch({ type: 'RESET' });
    }, []);

    return {
        isRecording: state.isRecording,
        isProcessing: state.isProcessing,
        transcript: state.transcript,
        extracted: state.extracted,
        error: state.error,
        updateKey: state.updateKey,
        startRecording,
        stopRecording,
        reset,
    };
}
