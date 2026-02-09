import { forwardRef, type ReactNode, type HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'outline' | 'ghost';
    padding?: 'none' | 'sm' | 'md';
    hoverEffect?: boolean;
    children: ReactNode;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
    ({ variant = 'default', padding = 'md', hoverEffect = true, className = '', style, children, ...props }, ref) => {

        const baseStyle: React.CSSProperties = {
            backgroundColor: variant === 'default' ? 'var(--notion-bg-secondary)' : 'transparent',
            border: variant === 'outline' ? '1px solid var(--notion-border)' : 'none',
            borderRadius: 'var(--radius-md)',
            transition: 'background-color 200ms ease, transform 200ms ease, box-shadow 200ms ease',
            ...style,
        };

        const paddingMap = {
            none: '0',
            sm: '12px',
            md: '16px',
        };

        return (
            <div
                ref={ref}
                className={`notion-card ${hoverEffect ? 'hover-reveal-parent' : ''} ${className}`}
                style={{
                    ...baseStyle,
                    padding: paddingMap[padding]
                }}
                {...props}
            >
                {children}
            </div>
        );
    }
);

Card.displayName = 'Card';

export { Card };
export default Card;