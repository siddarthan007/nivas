import { ChevronDown } from 'lucide-react';
import React, { forwardRef } from 'react';
import type { SelectHTMLAttributes } from 'react';

export interface SelectOption {
    value: string | number;
    label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    options?: SelectOption[];
    label?: string;
    error?: string;
    fullWidth?: boolean;
    helperText?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
    ({ options, label, error, fullWidth = false, helperText, className = '', style, children, onKeyDown: parentOnKeyDown, ...restProps }, ref) => {
        return (
            <div style={{ width: fullWidth ? '100%' : 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {label && (
                    <label style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: 'var(--notion-text-secondary)',
                        marginBottom: '2px'
                    }}>
                        {label}
                    </label>
                )}
                <div style={{ position: 'relative', width: '100%' }}>
                    <select
                        ref={ref}
                        style={{
                            appearance: 'none',
                            width: '100%',
                            padding: '8px 32px 8px 12px',
                            fontSize: '14px',
                            lineHeight: '20px',
                            color: 'var(--notion-text)',
                            backgroundColor: 'var(--notion-bg)',
                            border: error ? '1px solid var(--notion-red)' : '1px solid var(--notion-border)',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            outline: 'none',
                            transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                            ...style
                        }}
                        className={`hover-border-focus ${className}`}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                const form = e.currentTarget.form;
                                if (form) {
                                    const focusable = Array.from(form.querySelectorAll(
                                        'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
                                    )) as HTMLElement[];
                                    const currentIndex = focusable.indexOf(e.currentTarget);
                                    if (currentIndex < focusable.length - 1) {
                                        focusable[currentIndex + 1]?.focus();
                                    }
                                }
                            }
                            if (e.key === 'Escape') {
                                e.currentTarget.blur();
                            }
                            parentOnKeyDown?.(e);
                        }}
                        {...restProps}
                    >
                        {options ? options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        )) : children}
                    </select>
                    <div style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        pointerEvents: 'none',
                        color: 'var(--notion-text-secondary)',
                        display: 'flex',
                        alignItems: 'center'
                    }}>
                        <ChevronDown size={14} />
                    </div>
                </div>
                {(error || helperText) && (
                    <span style={{
                        fontSize: '12px',
                        color: error ? 'var(--notion-red)' : 'var(--notion-text-secondary)',
                        marginTop: '2px'
                    }}>
                        {error || helperText}
                    </span>
                )}
            </div>
        );
    }
);

Select.displayName = 'Select';

export default Select;
