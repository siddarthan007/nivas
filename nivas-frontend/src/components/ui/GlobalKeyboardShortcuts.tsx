'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from '@/lib/router';

const vimNavigations: Record<string, { path: string; description: string }> = {
    d: { path: '/dashboard', description: 'Go to Dashboard' },
    b: { path: '/dashboard/bookings', description: 'Go to Bookings' },
    r: { path: '/dashboard/rooms', description: 'Go to Rooms' },
    o: { path: '/dashboard/orders', description: 'Go to Orders' },
    h: { path: '/dashboard/housekeeping', description: 'Go to Housekeeping' },
    i: { path: '/dashboard/inventory', description: 'Go to Inventory' },
    s: { path: '/dashboard/staff', description: 'Go to Staff' },
    f: { path: '/dashboard/finance', description: 'Go to Finance' },
    c: { path: '/dashboard/crm', description: 'Go to CRM' },
    e: { path: '/dashboard/events', description: 'Go to Events' },
    m: { path: '/dashboard/menu', description: 'Go to Menu' },
    p: { path: '/dashboard/profile', description: 'Go to Profile' },
    l: { path: '/dashboard/licenses', description: 'Go to Licenses' },
};

const newItemShortcuts: Record<string, { path: string; description: string }> = {
    b: { path: '/dashboard/bookings?action=new', description: 'New Booking' },
    o: { path: '/dashboard/orders?action=new', description: 'New Order' },
};

export default function GlobalKeyboardShortcuts() {
    const lastKeyRef = useRef<string | null>(null);
    const lastKeyTimeRef = useRef<number>(0);
    const router = useRouter();

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        const target = event.target as HTMLElement;
        if (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable ||
            event.metaKey ||
            event.ctrlKey ||
            event.altKey
        ) {
            return;
        }

        const now = Date.now();
        const timeSinceLastKey = now - lastKeyTimeRef.current;
        const key = event.key.toLowerCase();

        if (lastKeyRef.current === 'g' && timeSinceLastKey < 500) {
            const nav = vimNavigations[key];
            if (nav) {
                event.preventDefault();
                router.push(nav.path);
                lastKeyRef.current = null;
                return;
            }
        }

        if (lastKeyRef.current === 'n' && timeSinceLastKey < 500) {
            const nav = newItemShortcuts[key];
            if (nav) {
                event.preventDefault();
                router.push(nav.path);
                lastKeyRef.current = null;
                return;
            }
        }

        if (key === 'g' || key === 'n') {
            lastKeyRef.current = key;
            lastKeyTimeRef.current = now;
        } else {
            lastKeyRef.current = null;
        }
    }, [router]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return null;
}

export { vimNavigations, newItemShortcuts };