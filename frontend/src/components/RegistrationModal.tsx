/**
 * Registration Modal with prefill support and immediate LLM updates
 */

import { useState, useEffect, useRef } from 'react';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { Person } from '../types';

interface RegistrationModalProps {
    isOpen: boolean;
    trackId: string;
    faceImageBase64?: string;
    existingPerson?: Person | null;
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
    existingPerson,
    onClose,
    onSubmit,
}: RegistrationModalProps) {
    const [name, setName] = useState('');
    const [relation, setRelation] = useState('');
    const [context, setContext] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const prevUpdateKeyRef = useRef(0);

    const {
        isRecording,
        isProcessing,
        transcript,
        extracted,
        updateKey,
        startRecording,
        stopRecording,
        reset,
    } = useSpeechToText();

    const isEditing = !!existingPerson;

    // Reset on open and prefill if editing
    useEffect(() => {
        if (isOpen) {
            if (existingPerson) {
                setName(existingPerson.name || '');
                setRelation(existingPerson.relation || '');
                setContext(existingPerson.context || '');
            } else {
                setName('');
                setRelation('');
                setContext('');
            }
            setIsSubmitting(false);
            reset();
            prevUpdateKeyRef.current = 0;
        }
    }, [isOpen, existingPerson, reset]);

    // LLM OVERWRITES fields when extraction updates
    useEffect(() => {
        if (extracted && updateKey > prevUpdateKeyRef.current) {
            console.log('[Modal] Applying extracted:', extracted);
            prevUpdateKeyRef.current = updateKey;

            if (extracted.name) {
                setName(extracted.name);
            }
            if (extracted.relation) {
                setRelation(extracted.relation);
            }
            if (extracted.context) {
                setContext(extracted.context);
            }
        }
    }, [extracted, updateKey]);

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

    return (
        <div className="ar-modal-overlay" onClick={onClose}>
            <div className="ar-modal" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
                {faceImageBase64 && (
                    <div className="ar-face-preview">
                        <img src={faceImageBase64} alt="" />
                    </div>
                )}

                <div className="ar-modal-content">
                    <h3 className="ar-modal-title">
                        {isEditing ? 'MODIFY PERSON' : 'ADD PERSON'}
                    </h3>

                    {/* Voice button */}
                    <button
                        type="button"
                        className={`ar-voice-btn ${isRecording ? 'active' : ''}`}
                        onClick={handleVoice}
                        disabled={isProcessing}
                    >
                        {isProcessing
                            ? '⏳ Processing...'
                            : isRecording
                                ? '🔴 Stop'
                                : '🎤 Speak'}
                    </button>

                    {/* Transcript */}
                    {transcript && (
                        <div className="ar-transcript">"{transcript}"</div>
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
                            {isSubmitting ? 'Saving...' : isEditing ? 'Update' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
