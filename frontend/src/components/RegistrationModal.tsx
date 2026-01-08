/**
 * Registration Modal with Voice + LLM Auto-fill
 * Records voice -> Whisper -> Phi-3 -> Auto-fills form
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

    const {
        isRecording,
        isProcessing,
        transcript,
        extracted,
        startRecording,
        stopRecording,
        reset,
    } = useSpeechToText();

    // Reset on open
    useEffect(() => {
        if (isOpen) {
            setName('');
            setRelation('');
            setContext('');
            setIsSubmitting(false);
            reset();
        }
    }, [isOpen, reset]);

    // Auto-fill from LLM extraction
    useEffect(() => {
        if (extracted) {
            if (extracted.name && !name) setName(extracted.name);
            if (extracted.relation && !relation) setRelation(extracted.relation);
            if (extracted.context && !context) setContext(extracted.context);
        }
    }, [extracted, name, relation, context]);

    const handleVoice = async () => {
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
        if (e.key === 'Escape') onClose();
    };

    if (!isOpen) return null;

    const voiceLabel = isProcessing
        ? 'Processing...'
        : isRecording
            ? 'Stop'
            : 'Speak';

    return (
        <div className="ar-modal-overlay" onClick={onClose}>
            <div className="ar-modal" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
                {faceImageBase64 && (
                    <div className="ar-face-preview">
                        <img src={faceImageBase64} alt="" />
                    </div>
                )}

                <div className="ar-modal-content">
                    <h3 className="ar-modal-title">ADD PERSON</h3>

                    {/* Voice button */}
                    <button
                        type="button"
                        className={`ar-voice-btn ${isRecording ? 'active' : ''}`}
                        onClick={handleVoice}
                        disabled={isProcessing}
                    >
                        {isRecording && '🔴 '}
                        {voiceLabel}
                        {!isRecording && !isProcessing && ' — "That\'s John, my friend"'}
                    </button>

                    {/* Transcript preview */}
                    {transcript && (
                        <div className="ar-transcript">
                            "{transcript}"
                        </div>
                    )}

                    <div className="ar-form">
                        <input
                            type="text"
                            className="ar-input"
                            placeholder="Name"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            autoFocus
                        />

                        <input
                            type="text"
                            className="ar-input"
                            placeholder="Relation"
                            value={relation}
                            onChange={e => setRelation(e.target.value)}
                        />

                        <textarea
                            className="ar-input ar-textarea"
                            placeholder="Context"
                            value={context}
                            onChange={e => setContext(e.target.value)}
                            rows={2}
                        />
                    </div>

                    <div className="ar-modal-actions">
                        <button className="ar-btn ar-btn-cancel" onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            className="ar-btn ar-btn-confirm"
                            onClick={handleSubmit}
                            disabled={!name.trim() || isSubmitting || isProcessing}
                        >
                            {isSubmitting ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
