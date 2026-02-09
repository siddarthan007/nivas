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
            variant = 'secondary', // Notion defaults to secondary/ghost often
            size = 'md',
            icon,
            iconPosition = 'left',
            loading = false,
            fullWidth = false,
            children,
            className = '',
            style = {},
            disabled,
            ...props
        },
        ref
    ) => {
        // Notion-style Styles
        const baseStyle: React.CSSProperties = {
            display: fullWidth ? 'flex' : 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            cursor: 'pointer',
            transition: 'background-color 100ms ease, color 100ms ease',
            fontFamily: 'var(--font-body)',
            fontWeight: '500',
            userSelect: 'none',
            width: fullWidth ? '100%' : 'auto',
            whiteSpace: 'nowrap',
            ...style,
        };

        const sizeStyles = {
            sm: { fontSize: '12px', padding: '2px 8px', height: '24px' },
            md: { fontSize: '14px', padding: '4px 12px', height: '32px' },
            lg: { fontSize: '15px', padding: '6px 16px', height: '36px' },
        };

        const variantStyles = {
            primary: {
                backgroundColor: 'var(--notion-blue)',
                color: 'white',
                boxShadow: 'var(--shadow-sm)',
            },
            secondary: {
                backgroundColor: 'rgba(255,255,255,0.06)',
                color: 'var(--notion-text)',
                border: '1px solid rgba(255,255,255,0.06)',
            },
            ghost: {
                backgroundColor: 'transparent',
                color: 'var(--notion-text-secondary)',
            },
            danger: {
                backgroundColor: 'var(--notion-red)',
                color: 'white',
            },
        };

        const disabledStyle = disabled || loading ? {
            opacity: 0.5,
            cursor: 'not-allowed',
            pointerEvents: 'none' as const,
        } : {};

        const combinedStyle = {
            ...baseStyle,
            ...sizeStyles[size],
            ...variantStyles[variant],
            ...disabledStyle,
        };

        const hoverStyle = (e: React.MouseEvent<HTMLButtonElement>) => {
            if (disabled || loading) return;
            if (variant === 'primary') e.currentTarget.style.backgroundColor = 'var(--notion-blue-hover)'; // Pseudo
            if (variant === 'secondary') e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
            if (variant === 'ghost') {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.color = 'var(--notion-text)';
            }
            if (variant === 'danger') e.currentTarget.style.backgroundColor = 'rgba(224, 108, 108, 0.8)';
        };

        const leaveStyle = (e: React.MouseEvent<HTMLButtonElement>) => {
            if (disabled || loading) return;
            // Reset to original (simplified for inline styles)
            Object.assign(e.currentTarget.style, variantStyles[variant]);
        };

        return (
            <button
                ref={ref}
                className={`active-scale ${className}`}
                style={combinedStyle}
                onMouseEnter={hoverStyle}
                onMouseLeave={leaveStyle}
                disabled={disabled || loading}
                {...props}
            >
                {loading ? (
                    <span className="animate-spin" style={{ width: 14, height: 14 }}>
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