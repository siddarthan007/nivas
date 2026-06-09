'use client';

import type { ReactNode } from 'react';

interface DropdownOption {
    value: string;
    label: string;
    icon?: ReactNode;
}

interface DropdownProps {
    options: DropdownOption[];
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
}

const Dropdown = ({
    options,
    value,
    onChange,
    placeholder = 'Select...',
}: DropdownProps) => {

    // Simplified native select for now to ensure reliability and accessibility while keeping style
    return (
        <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
            <select
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                style={{
                    width: '100%',
                    padding: '6px 10px',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid transparent',
                    borderRadius: 'var(--radius-sm)',
                    color: value ? 'var(--notion-text)' : 'var(--notion-text-secondary)',
                    fontSize: '14px',
                    appearance: 'none',
                    cursor: 'pointer',
                    outline: 'none'
                }}
                className="hover-bg"
            >
                <option value="" disabled>{placeholder}</option>
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value} style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
                        {opt.label}
                    </option>
                ))}
            </select>
            <div style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: 'var(--notion-text-muted)',
                fontSize: '10px'
            }}>
                ▼
            </div>
        </div>
    );
};

export default Dropdown;
export type { DropdownOption };