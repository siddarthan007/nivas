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
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            borderRadius: '2px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '2px 3px 8px rgba(0,0,0,0.15), 0 0 1px rgba(0,0,0,0.1)',
            position: 'relative',
            // Subtle sticky-note tilt
            transform: 'rotate(-0.5deg)',
        }}>
            {/* Tape strip at top */}
            <div style={{
                position: 'absolute',
                top: '-10px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '80px',
                height: '24px',
                background: 'rgba(255,255,255,0.45)',
                borderRadius: '2px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                backdropFilter: 'blur(2px)',
            }} />

            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#92400e',
                marginBottom: '4px',
                position: 'relative',
                zIndex: 1,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '13px', letterSpacing: '0.3px' }}>
                    <StickyNote size={15} />
                    <span>Quick Notes</span>
                </div>
                {isSaving ? (
                    <span style={{ fontSize: '11px', opacity: 0.7, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Save size={12} /> Saving...
                    </span>
                ) : note ? (
                    <span style={{ fontSize: '11px', opacity: 0.5 }}>Auto-saved</span>
                ) : null}
            </div>

            {/* Notebook-ruled textarea */}
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
                    lineHeight: '24px',
                    color: '#78350f',
                    fontFamily: "'Kalam', 'Comic Sans MS', cursive, sans-serif",
                    padding: 0,
                    // Ruled lines background
                    backgroundImage: 'repeating-linear-gradient(transparent, transparent 23px, #d4b483 23px, #d4b483 24px)',
                    backgroundAttachment: 'local',
                }}
            />
        </div>
    );
}