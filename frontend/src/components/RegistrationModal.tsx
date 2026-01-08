/**
 * Registration Modal with Whisper STT
 * Name, Relation, Context fields with voice input
 */

import { useState, useEffect } from 'react';
import { useSpeechToText } from '../hooks/useSpeechToText';

interface RegistrationModalProps {
    isOpen: boolean;
    trackId: string;
    faceImageBase64?: string;
    onClose: () => void;
    onSubmit: (data: RegistrationData) => void;
}

export interface RegistrationData {
    trackId: string;
    name: string;
    relation: string;
    lastMet: string;
    context: string;
    faceImageBase64?: string;
}

export function RegistrationModal({
    isOpen,
    trackId,
    faceImageBase64,
    onClose,
    onSubmit,
}: RegistrationModalProps) {
    const [name, setName] = useState('');
    const [relation, setRelation] = useState('');
    const [context, setContext] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Whisper STT
    const {
        isRecording,
        isTranscribing,
        transcript,
        startRecording,
        stopRecording,
        resetTranscript,
    } = useSpeechToText();

    // Reset on open
    useEffect(() => {
        if (isOpen) {
            setName('');
            setRelation('');
            setContext('');
            setIsSubmitting(false);
            resetTranscript();
        }
    }, [isOpen, resetTranscript]);

    // Apply transcript to context when received
    useEffect(() => {
        if (transcript) {
            setContext(prev => prev ? `${prev} ${transcript}` : transcript);
        }
    }, [transcript]);

    const handleVoiceButton = async () => {
        if (isRecording) {
            await stopRecording();
        } else {
            startRecording();
        }
    };

    const handleSubmit = () => {
        if (!name.trim() || isSubmitting) return;

        setIsSubmitting(true);

        const today = new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });

        onSubmit({
            trackId,
            name: name.trim(),
            relation: relation.trim() || 'Person',
            lastMet: today,
            context: context.trim(),
            faceImageBase64,
        });

        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && name.trim() && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
        if (e.key === 'Escape') {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="ar-modal-overlay" onClick={onClose}>
            <div className="ar-modal" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
                {faceImageBase64 && (
                    <div className="ar-face-preview">
                        <img src={faceImageBase64} alt="Face" />
                    </div>
                )}

                <div className="ar-modal-content">
                    <h3 className="ar-modal-title">ADD PERSON</h3>

                    <div className="ar-form">
                        <input
                            type="text"
                            className="ar-input"
                            placeholder="Name *"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            autoFocus
                        />

                        <input
                            type="text"
                            className="ar-input"
                            placeholder="Relation (Friend, Doctor...)"
                            value={relation}
                            onChange={e => setRelation(e.target.value)}
                        />

                        <textarea
                            className="ar-input ar-textarea"
                            placeholder="Context (optional)"
                            value={context}
                            onChange={e => setContext(e.target.value)}
                            rows={2}
                        />

                        {/* Voice input for context */}
                        <button
                            type="button"
                            className={`ar-voice-btn ${isRecording ? 'active' : ''}`}
                            onClick={handleVoiceButton}
                            disabled={isTranscribing}
                        >
                            {isTranscribing
                                ? '⏳ Transcribing...'
                                : isRecording
                                    ? '🔴 Stop Recording'
                                    : '🎤 Add voice note'}
                        </button>
                    </div>

                    <div className="ar-modal-actions">
                        <button className="ar-btn ar-btn-cancel" onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            className="ar-btn ar-btn-confirm"
                            onClick={handleSubmit}
                            disabled={!name.trim() || isSubmitting}
                        >
                            {isSubmitting ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
