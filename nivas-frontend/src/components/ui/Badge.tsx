import { forwardRef, type HTMLAttributes } from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple' | 'pink' | 'orange';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    variant?: BadgeVariant;
    size?: 'sm' | 'md';
    children: React.ReactNode;
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
    ({ variant = 'default', size = 'md', children, className = '', style, ...props }, ref) => {

        const variantStyles = {
            default: { bg: 'rgba(255,255,255,0.1)', color: 'var(--notion-text)' },
            success: { bg: 'var(--notion-green-bg)', color: 'var(--notion-green)' },
            warning: { bg: 'var(--notion-yellow-bg)', color: 'var(--notion-yellow)' },
            error: { bg: 'var(--notion-red-bg)', color: 'var(--notion-red)' },
            info: { bg: 'var(--notion-blue-bg)', color: 'var(--notion-blue)' },
            purple: { bg: 'rgba(154, 109, 215, 0.2)', color: 'var(--notion-purple)' },
            pink: { bg: 'rgba(218, 103, 154, 0.2)', color: 'var(--notion-pink)' },
            orange: { bg: 'rgba(215, 125, 67, 0.2)', color: 'var(--notion-orange)' },
        };

        const v = variantStyles[variant] || variantStyles.default;

        return (
            <span
                ref={ref}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: size === 'sm' ? '0px 6px' : '2px 8px',
                    borderRadius: '4px',
                    fontSize: size === 'sm' ? '11px' : '12px',
                    fontWeight: '500',
                    backgroundColor: v.bg,
                    color: v.color,
                    whiteSpace: 'nowrap',
                    ...style
                }}
                {...props}
            >
                {children}
            </span>
        );
    }
);

Badge.displayName = 'Badge';

export default Badge;