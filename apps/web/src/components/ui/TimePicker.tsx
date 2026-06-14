'use client';

import { useMemo } from 'react';

interface TimePickerProps {
    value?: string;                      // "HH:mm" (24h)
    onChange?: (time: string) => void;   // emits "HH:mm" (24h)
    label?: string;
    placeholder?: string;
    error?: string;
    fullWidth?: boolean;
    required?: boolean;
}

const MINUTE_STEP = 5;

function parse(value?: string): { h12: number; min: number; ampm: 'AM' | 'PM' } | null {
    if (!value) return null;
    const [hh, mm] = value.split(':').map(Number);
    if (hh == null || mm == null || Number.isNaN(hh) || Number.isNaN(mm)) return null;
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    return { h12, min: mm, ampm };
}

function build(h12: number, min: number, ampm: 'AM' | 'PM'): string {
    let h24 = h12 % 12;            // 12 -> 0
    if (ampm === 'PM') h24 += 12;  // 12 PM -> 12, 1 PM -> 13
    return `${String(h24).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

const selectStyle: React.CSSProperties = {
    padding: '8px 8px',
    fontSize: '14px',
    border: '1px solid var(--notion-border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--notion-bg)',
    color: 'var(--notion-text)',
    cursor: 'pointer',
    outline: 'none',
};

/**
 * Design-consistent time picker: clean Hour / Minute / AM-PM selects (no
 * react-datepicker time list). Keeps the "HH:mm" 24-hour string contract.
 */
export default function TimePicker({ value, onChange, label, placeholder, error, fullWidth, required }: TimePickerProps) {
    const parts = useMemo(() => parse(value), [value]);
    const h12 = parts?.h12 ?? '';
    const min = parts?.min ?? '';
    const ampm = parts?.ampm ?? 'AM';

    const emit = (nh: number | string, nm: number | string, na: 'AM' | 'PM') => {
        const hour = nh === '' ? 12 : Number(nh);
        const minute = nm === '' ? 0 : Number(nm);
        onChange?.(build(hour, minute, na));
    };

    const hours = Array.from({ length: 12 }, (_, i) => i + 1);
    const minutes = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => i * MINUTE_STEP);

    return (
        <div style={{ width: fullWidth ? '100%' : 'auto' }}>
            {label && (
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--notion-text-secondary)' }}>
                    {label} {required && <span style={{ color: 'var(--notion-red)' }}>*</span>}
                </label>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <select aria-label="Hour" value={h12} onChange={(e) => emit(e.target.value, min === '' ? 0 : min, ampm)} style={{ ...selectStyle, flex: 1 }}>
                    <option value="" disabled>{placeholder ? 'HH' : 'HH'}</option>
                    {hours.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}
                </select>
                <span style={{ color: 'var(--notion-text-muted)', fontWeight: 600 }}>:</span>
                <select aria-label="Minute" value={min} onChange={(e) => emit(h12 === '' ? 12 : h12, e.target.value, ampm)} style={{ ...selectStyle, flex: 1 }}>
                    <option value="" disabled>MM</option>
                    {minutes.map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
                </select>
                <select aria-label="AM/PM" value={ampm} onChange={(e) => emit(h12 === '' ? 12 : h12, min === '' ? 0 : min, e.target.value as 'AM' | 'PM')} style={{ ...selectStyle, width: '64px' }}>
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                </select>
            </div>
            {error && <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--notion-red)' }}>{error}</div>}
        </div>
    );
}
