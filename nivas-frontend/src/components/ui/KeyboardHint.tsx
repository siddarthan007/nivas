'use client';

interface KeyboardHintProps {
    keys: string[];
    size?: 'sm' | 'md';
    className?: string;
}

/**
 * Displays keyboard shortcut hints (e.g., ⌘K, Ctrl+/)
 */
export default function KeyboardHint({ keys, size = 'sm', className = '' }: KeyboardHintProps) {
    const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

    const formatKey = (key: string): string => {
        const keyMap: Record<string, string> = {
            'ctrl': isMac ? '⌘' : 'Ctrl',
            'cmd': '⌘',
            'meta': isMac ? '⌘' : '⊞',
            'alt': isMac ? '⌥' : 'Alt',
            'shift': '⇧',
            'enter': '↵',
            'escape': 'Esc',
            'esc': 'Esc',
            'backspace': '⌫',
            'delete': '⌦',
            'tab': '⇥',
            'arrowup': '↑',
            'arrowdown': '↓',
            'arrowleft': '←',
            'arrowright': '→',
            'space': '␣',
        };
        return keyMap[key.toLowerCase()] || key.toUpperCase();
    };

    const sizeStyles = {
        sm: {
            padding: '2px 5px',
            fontSize: '10px',
            gap: '2px',
        },
        md: {
            padding: '3px 6px',
            fontSize: '11px',
            gap: '3px',
        },
    };

    return (
        <span
            className={className}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: sizeStyles[size].gap,
            }}
        >
            {keys.map((key, index) => (
                <kbd
                    key={index}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: sizeStyles[size].padding,
                        fontSize: sizeStyles[size].fontSize,
                        fontFamily: 'inherit',
                        fontWeight: 500,
                        lineHeight: 1,
                        color: 'var(--notion-text-secondary)',
                        backgroundColor: 'var(--notion-bg-tertiary)',
                        border: '1px solid var(--notion-border)',
                        borderRadius: 'var(--radius-sm)',
                        boxShadow: '0 1px 0 var(--notion-border)',
                        minWidth: '18px',
                        textAlign: 'center',
                    }}
                >
                    {formatKey(key)}
                </kbd>
            ))}
        </span>
    );
}
