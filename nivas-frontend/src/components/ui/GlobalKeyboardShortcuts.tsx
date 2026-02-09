'use client';

import { useEffect, useRef, useCallback } from 'react';

// Navigation function
const navigateTo = (path: string) => {
    window.location.href = path;
};

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
    'm': { path: '/dashboard/menu', description: 'Go to Menu' },
};

// New item shortcuts (N + key)
const newItemShortcuts: Record<string, { path: string; description: string }> = {
    'b': { path: '/dashboard/bookings?action=new', description: 'New Booking' },
    'o': { path: '/dashboard/orders?action=new', description: 'New Order' },
};

/**
 * Provides global keyboard shortcuts for the entire application.
 * Mount this component once at the app root level.
 * 
 * Shortcuts:
 * - Ctrl+K / Cmd+K: Open command palette
 * - G + key: Navigate to page (vim-style)
 * - N + key: Create new item
 * - Escape: Close modals/dialogs
 */
export default function GlobalKeyboardShortcuts() {
    const lastKeyRef = useRef<string | null>(null);
    const lastKeyTimeRef = useRef<number>(0);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Skip if user is typing in an input, textarea, or contenteditable
        const target = e.target as HTMLElement;
        if (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable
        ) {
            return;
        }

        const now = Date.now();
        const timeSinceLastKey = now - lastKeyTimeRef.current;
        const key = e.key.toLowerCase();

        // Handle vim-style navigation (g + key within 500ms)
        if (lastKeyRef.current === 'g' && timeSinceLastKey < 500) {
            const nav = vimNavigations[key];
            if (nav) {
                e.preventDefault();
                navigateTo(nav.path);
                lastKeyRef.current = null;
                return;
            }
        }

        // Handle new item shortcuts (n + key within 500ms)
        if (lastKeyRef.current === 'n' && timeSinceLastKey < 500) {
            const nav = newItemShortcuts[key];
            if (nav) {
                e.preventDefault();
                navigateTo(nav.path);
                lastKeyRef.current = null;
                return;
            }
        }

        // Store the current key for potential two-key combo
        if (key === 'g' || key === 'n') {
            lastKeyRef.current = key;
            lastKeyTimeRef.current = now;
        } else {
            lastKeyRef.current = null;
        }
    }, []);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // This component doesn't render anything
    return null;
}

// Export shortcuts for documentation/help modal
export { vimNavigations, newItemShortcuts };
