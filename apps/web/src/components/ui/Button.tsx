'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    icon?: ReactNode;
    iconPosition?: 'left' | 'right';
    loading?: boolean;
    fullWidth?: boolean;
    children?: ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            variant = 'secondary',
            size = 'md',
            icon,
            iconPosition = 'left',
            loading = false,
            fullWidth = false,
            children,
            className = '',
            disabled,
            ...props
        },
        ref
    ) => {
        const btnClass = [
            'btn',
            `btn-${variant}`,
            `btn-${size}`,
            fullWidth ? 'btn-full' : '',
            loading ? 'btn-loading' : '',
            'active-scale',
            className
        ].filter(Boolean).join(' ');

        return (
            <button
                ref={ref}
                className={btnClass}
                disabled={disabled || loading}
                {...props}
            >
                {loading ? (
                    <span className="animate-spin" style={{ width: 14, height: 14, display: 'inline-flex' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                            <path d="M12 2a10 10 0 0 1 10 10" />
                        </svg>
                    </span>
                ) : (
                    <>
                        {icon && iconPosition === 'left' && <span>{icon}</span>}
                        {children && <span>{children}</span>}
                        {icon && iconPosition === 'right' && <span>{icon}</span>}
                    </>
                )}
            </button>
        );
    }
);

Button.displayName = 'Button';

export default Button;