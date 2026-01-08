/**
 * Speech-to-Text Hook using local Whisper backend
 * Records audio from microphone and sends to backend for transcription
 */

import { useState, useRef, useCallback } from 'react';

interface UseSpeechToTextReturn {
    isRecording: boolean;
    isTranscribing: boolean;
    transcript: string;
    error: string | null;
    startRecording: () => void;
    stopRecording: () => Promise<string>;
    resetTranscript: () => void;
}

export function useSpeechToText(): UseSpeechToTextReturn {
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const startRecording = useCallback(async () => {
        setError(null);
        chunksRef.current = [];

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 16000,
                }
            });

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: MediaRecorder.isTypeSupported('audio/webm')
                    ? 'audio/webm'
                    : 'audio/mp4'
            });

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.start(1000); // Collect data every second
            setIsRecording(true);
            console.log('[STT] Recording started');
        } catch (err) {
            console.error('[STT] Failed to start recording:', err);
            setError('Failed to access microphone');
        }
    }, []);

    const stopRecording = useCallback(async (): Promise<string> => {
        return new Promise((resolve) => {
            const mediaRecorder = mediaRecorderRef.current;

            if (!mediaRecorder || mediaRecorder.state === 'inactive') {
                resolve('');
                return;
            }

            mediaRecorder.onstop = async () => {
                setIsRecording(false);
                setIsTranscribing(true);
                console.log('[STT] Recording stopped, transcribing...');

                // Stop all tracks
                mediaRecorder.stream.getTracks().forEach(track => track.stop());

                // Create blob from chunks
                const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });

                // Send to backend for transcription
                try {
                    const formData = new FormData();
                    formData.append('audio', audioBlob, 'recording.webm');

                    const response = await fetch('http://localhost:8000/api/transcribe', {
                        method: 'POST',
                        body: formData,
                    });

                    const data = await response.json();

                    if (data.success && data.text) {
                        setTranscript(data.text);
                        console.log('[STT] Transcription:', data.text);
                        resolve(data.text);
                    } else {
                        setError(data.error || 'Transcription failed');
                        resolve('');
                    }
                } catch (err) {
                    console.error('[STT] Transcription error:', err);
                    setError('Failed to transcribe audio');
                    resolve('');
                } finally {
                    setIsTranscribing(false);
                }
            };

            mediaRecorder.stop();
        });
    }, []);

    const resetTranscript = useCallback(() => {
        setTranscript('');
        setError(null);
    }, []);

    return {
        isRecording,
        isTranscribing,
        transcript,
        error,
        startRecording,
        stopRecording,
        resetTranscript,
    };
}
