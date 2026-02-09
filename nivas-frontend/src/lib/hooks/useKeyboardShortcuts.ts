'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useCommandPalette } from '@/lib/contexts/CommandPaletteContext';

interface ShortcutConfig {
    key: string;
    ctrl?: boolean;
    meta?: boolean;
    shift?: boolean;
    action: () => void;
    description: string;
}

// Navigation function (using window.location for now, can be enhanced with router)
const navigateTo = (path: string) => {
    window.location.href = path;
};

export function useKeyboardShortcuts() {
    const { toggle, close } = useCommandPalette();
    const lastKeyRef = useRef<string | null>(null);
    const lastKeyTimeRef = useRef<number>(0);

    // Global shortcuts
    const shortcuts: ShortcutConfig[] = [
        { key: 'k', ctrl: true, action: toggle, description: 'Open command palette' },
        { key: 'Escape', action: close, description: 'Close dialogs' },
    ];

    // Vim-style two-key navigation (G + key)
    const vimNavigations: Record<string, { path: string; description: string }> = {
        'd': { path: '/dashboard', description: 'Go to Dashboard' },
        'b': { path: '/dashboard/bookings', description: 'Go to Bookings' },
        'r': { path: '/dashboard/rooms', description: 'Go to Rooms' },
        'o': { path: '/dashboard/orders', description: 'Go to Orders' },
        'h': { path: '/dashboard/housekeeping', description: 'Go to Housekeeping' },
        'i': { path: '/dashboard/inventory', description: 'Go to Inventory' },
        's': { path: '/dashboard/staff', description: 'Go to Staff' },
        'f': { path: '/dashboard/finance', description: 'Go to Finance' },
        'c': { path: '/dashboard/crm', description: 'Go to CRM' },
        'e': { path: '/dashboard/events', description: 'Go to Events' },
        'p': { path: '/dashboard/reports', description: 'Go to Reports' },
    };

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Skip if user is typing in an input, textarea, or contenteditable
        const target = e.target as HTMLElement;
        if (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable ||
            target.closest('[role="dialog"]')
        ) {
            // Only handle Escape for closing modals
            if (e.key === 'Escape') {
                close();
            }
            return;
        }

        // Handle Ctrl/Cmd shortcuts
        for (const shortcut of shortcuts) {
            const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : true;
            const metaMatch = shortcut.meta ? e.metaKey : true;
            const shiftMatch = shortcut.shift ? e.shiftKey : true;

            if (e.key.toLowerCase() === shortcut.key.toLowerCase() && ctrlMatch && metaMatch && shiftMatch) {
                e.preventDefault();
                shortcut.action();
                return;
            }
        }

        // Handle Escape
        if (e.key === 'Escape') {
            close();
            return;
        }

        // Handle vim-style navigation (g + key within 500ms)
        const now = Date.now();
        const timeSinceLastKey = now - lastKeyTimeRef.current;

        if (lastKeyRef.current === 'g' && timeSinceLastKey < 500) {
            const nav = vimNavigations[e.key.toLowerCase()];
            if (nav) {
                e.preventDefault();
                navigateTo(nav.path);
                lastKeyRef.current = null;
                return;
            }
        }

        // Store the current key for potential two-key combo
        if (e.key.toLowerCase() === 'g') {
            lastKeyRef.current = 'g';
            lastKeyTimeRef.current = now;
        } else {
            lastKeyRef.current = null;
        }
    }, [toggle, close, shortcuts, vimNavigations]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return {
        shortcuts,
        vimNavigations,
    };
}

export default useKeyboardShortcuts;
