/**
 * Speech-to-Text Hook with LLM Extraction
 * Records audio -> Whisper transcription -> Phi-3 extraction
 */

import { useState, useRef, useCallback } from 'react';

interface ExtractedInfo {
    name: string | null;
    relation: string | null;
    context: string | null;
}

interface UseSpeechToTextReturn {
    isRecording: boolean;
    isProcessing: boolean;
    transcript: string;
    extracted: ExtractedInfo | null;
    error: string | null;
    startRecording: () => void;
    stopRecording: () => Promise<ExtractedInfo | null>;
    reset: () => void;
}

export function useSpeechToText(): UseSpeechToTextReturn {
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [extracted, setExtracted] = useState<ExtractedInfo | null>(null);
    const [error, setError] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const startRecording = useCallback(async () => {
        setError(null);
        setExtracted(null);
        chunksRef.current = [];

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
            mediaRecorder.start(1000);
            setIsRecording(true);
            console.log('[STT] Recording started');
        } catch (err) {
            console.error('[STT] Mic error:', err);
            setError('Failed to access microphone');
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
                setIsRecording(false);
                setIsProcessing(true);
                console.log('[STT] Processing audio...');

                // Stop tracks
                mediaRecorder.stream.getTracks().forEach(track => track.stop());

                const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });

                try {
                    // Step 1: Transcribe with Whisper
                    const formData = new FormData();
                    formData.append('audio', audioBlob, 'recording.webm');

                    const transcribeRes = await fetch('http://localhost:8000/api/transcribe', {
                        method: 'POST',
                        body: formData,
                    });

                    const transcribeData = await transcribeRes.json();

                    if (!transcribeData.success || !transcribeData.text) {
                        setError('Transcription failed');
                        setIsProcessing(false);
                        resolve(null);
                        return;
                    }

                    const text = transcribeData.text;
                    setTranscript(text);
                    console.log('[STT] Transcript:', text);

                    // Step 2: Extract with Phi-3
                    console.log('[STT] Extracting info...');
                    const extractRes = await fetch('http://localhost:8000/api/extract', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text }),
                    });

                    const extractData = await extractRes.json();

                    const info: ExtractedInfo = {
                        name: extractData.name || null,
                        relation: extractData.relation || null,
                        context: extractData.context || null,
                    };

                    setExtracted(info);
                    console.log('[STT] Extracted:', info);

                    setIsProcessing(false);
                    resolve(info);

                } catch (err) {
                    console.error('[STT] Error:', err);
                    setError('Processing failed');
                    setIsProcessing(false);
                    resolve(null);
                }
            };

            mediaRecorder.stop();
        });
    }, []);

    const reset = useCallback(() => {
        setTranscript('');
        setExtracted(null);
        setError(null);
    }, []);

    return {
        isRecording,
        isProcessing,
        transcript,
        extracted,
        error,
        startRecording,
        stopRecording,
        reset,
    };
}
