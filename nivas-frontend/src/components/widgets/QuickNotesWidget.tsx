"use client";

import { useState, useEffect } from "react";
import { StickyNote, Save } from "lucide-react";

export default function QuickNotesWidget() {
    const [note, setNote] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem("quickNote");
        if (saved) setNote(saved);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newVal = e.target.value;
        setNote(newVal);
        setIsSaving(true);
        // Debounce save
        const timeoutId = setTimeout(() => {
            localStorage.setItem("quickNote", newVal);
            setIsSaving(false);
        }, 800);
        return () => clearTimeout(timeoutId);
    };

    return (
        <div style={{
            height: '100%',
            minHeight: '220px',
            backgroundColor: '#fffbeb', // Very subtle yellow/cream
            border: '1px solid #fcd34d', // Subtle yellow border
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
            boxShadow: 'var(--shadow-sm)',
            position: 'relative'
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#92400e', // Darker yellow/brown text
                marginBottom: '4px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '14px' }}>
                    <StickyNote size={16} />
                    <span>Quick Notes</span>
                </div>
                {isSaving && (
                    <span style={{ fontSize: '11px', opacity: 0.7, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Saving...
                    </span>
                )}
            </div>

            <textarea
                value={note}
                onChange={handleChange}
                placeholder="Jot down a quick note..."
                style={{
                    flex: 1,
                    width: '100%',
                    backgroundColor: 'transparent',
                    border: 'none',
                    resize: 'none',
                    outline: 'none',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    color: '#78350f',
                    fontFamily: 'inherit',
                    padding: 0
                }}
            />
        </div>
    );
}