'use client';

import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
    label?: string;
    error?: string;
    hint?: string;
    icon?: ReactNode;
    fullWidth?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
    (
        {
            label,
            error,
            hint,
            icon,
            fullWidth = true,
            type = 'text',
            className = '',
            style,
            onFocus: parentOnFocus,
            onBlur: parentOnBlur,
            onKeyDown: parentOnKeyDown,
            value,
            ...restProps
        },
        ref
    ) => {
        const [showPassword, setShowPassword] = useState(false);
        const [isFocused, setIsFocused] = useState(false);
        const isPassword = type === 'password';
        const inputType = isPassword && showPassword ? 'text' : type;

        return (
            <div style={{ width: fullWidth ? '100%' : 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {label && (
                    <label style={{
                        fontSize: '12px',
                        color: 'var(--notion-text-secondary)',
                        marginBottom: '4px'
                    }}>
                        {label}
                    </label>
                )}

                <div style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: isFocused ? 'var(--notion-bg-secondary)' : 'var(--notion-bg-hover)',
                    border: '1px solid',
                    borderColor: isFocused ? 'var(--notion-blue)' : 'var(--notion-border)',
                    borderRadius: 'var(--radius-sm)',
                    transition: 'all 0.15s ease',
                    boxShadow: isFocused ? '0 0 0 2px var(--notion-blue-bg)' : 'var(--shadow-sm)'
                }}>
                    {icon && (
                        <span style={{
                            paddingLeft: '10px',
                            color: 'var(--notion-text-muted)',
                            display: 'flex'
                        }}>
                            {icon}
                        </span>
                    )}

                    <input
                        ref={ref}
                        type={inputType}
                        style={{
                            width: '100%',
                            backgroundColor: 'transparent',
                            border: 'none',
                            padding: '8px 12px',
                            fontSize: '14px',
                            color: 'var(--notion-text)',
                            outline: 'none',
                            paddingLeft: icon ? '8px' : '12px',
                            ...style
                        }}
                        onFocus={(e) => {
                            setIsFocused(true);
                            parentOnFocus?.(e);
                        }}
                        onBlur={(e) => {
                            setIsFocused(false);
                            parentOnBlur?.(e);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && type !== 'textarea') {
                                e.preventDefault();
                                const form = e.currentTarget.form;
                                if (form) {
                                    const focusable = Array.from(form.querySelectorAll(
                                        'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
                                    )) as HTMLElement[];
                                    const currentIndex = focusable.indexOf(e.currentTarget);
                                    if (currentIndex < focusable.length - 1) {
                                        focusable[currentIndex + 1]?.focus();
                                    } else {
                                        const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
                                        submitBtn?.click();
                                    }
                                }
                            }
                            if (e.key === 'Escape') {
                                e.currentTarget.blur();
                            }
                            parentOnKeyDown?.(e);
                        }}
                        {...restProps}
                        value={value ?? ''}
                    />

                    {isPassword && (
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--notion-text-muted)',
                                cursor: 'pointer',
                                padding: '0 10px',
                                display: 'flex'
                            }}
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    )}
                </div>

                {error && (
                    <span style={{ fontSize: '12px', color: 'var(--notion-red)' }}>{error}</span>
                )}
                {hint && !error && (
                    <span style={{ fontSize: '12px', color: 'var(--notion-text-muted)' }}>{hint}</span>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';

export default Input;