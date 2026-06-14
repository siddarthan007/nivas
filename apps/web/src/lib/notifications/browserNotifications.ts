'use client';

import { deriveNotificationRoute } from '@nivas/shared-utils';

const PERMISSION_KEY = 'nivas_web_push_asked';

export function isBrowserNotificationSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (!isBrowserNotificationSupported()) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';

    const alreadyAsked = sessionStorage.getItem(PERMISSION_KEY);
    if (!alreadyAsked) {
        sessionStorage.setItem(PERMISSION_KEY, '1');
    }

    try {
        return await Notification.requestPermission();
    } catch {
        return 'denied';
    }
}

export function showBrowserNotification(options: {
    title: string;
    body?: string;
    type?: string;
    metadata?: Record<string, unknown>;
    onNavigate?: (href: string) => void;
}) {
    if (!isBrowserNotificationSupported()) return;
    if (Notification.permission !== 'granted') return;
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') return;

    const href = deriveNotificationRoute('web', { type: options.type, metadata: options.metadata });

    try {
        const notification = new Notification(options.title, {
            body: options.body,
            tag: options.metadata?.dedupeKey ? String(options.metadata.dedupeKey) : undefined,
            data: { href, type: options.type, ...options.metadata },
        });

        notification.onclick = (event) => {
            event.preventDefault();
            window.focus();
            if (href && options.onNavigate) {
                options.onNavigate(href);
            } else if (href) {
                window.location.href = href;
            }
            notification.close();
        };
    } catch {
        /* ignore — autoplay / permission edge cases */
    }
}
