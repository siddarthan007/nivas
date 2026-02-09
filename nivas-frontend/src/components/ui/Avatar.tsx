import { forwardRef, type HTMLAttributes } from 'react';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
    src?: string;
    alt?: string;
    name?: string;
    size?: AvatarSize;
}

const sizeMap: Record<AvatarSize, { width: string; height: string; fontSize: string }> = {
    xs: { width: '24px', height: '24px', fontSize: 'var(--text-xs)' },
    sm: { width: '32px', height: '32px', fontSize: 'var(--text-xs)' },
    md: { width: '40px', height: '40px', fontSize: 'var(--text-sm)' },
    lg: { width: '48px', height: '48px', fontSize: 'var(--text-base)' },
    xl: { width: '64px', height: '64px', fontSize: 'var(--text-lg)' },
};

function getInitials(name: string): string {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return '?';
    const firstPart = parts[0];
    const lastPart = parts[parts.length - 1];
    if (!firstPart || parts.length === 1) return (firstPart?.[0] ?? '?').toUpperCase();
    return ((firstPart[0] ?? '') + (lastPart?.[0] ?? '')).toUpperCase();
}

const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
    ({ src, alt, name = '', size = 'md', className = '', style, ...props }, ref) => {
        const sizeStyles = sizeMap[size];
        const initials = name ? getInitials(name) : '?';

        const combinedStyle = {
            ...sizeStyles,
            ...style,
        };

        const classes = ['avatar', className].filter(Boolean).join(' ');

        return (
            <div
                ref={ref}
                className={classes}
                style={combinedStyle}
                {...props}
            >
                {src ? (
                    <img
                        src={src}
                        alt={alt || name}
                    />
                ) : (
                    <span>{initials}</span>
                )}
            </div>
        );
    }
);

Avatar.displayName = 'Avatar';

export default Avatar;