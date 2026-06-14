import { api } from '../api/client';

interface MobileEvent {
    type: 'screen_view' | 'action' | 'error' | 'session';
    name: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
    durationMs?: number;
}

const queue: MobileEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flushEvents() {
    flushTimer = null;
    if (!queue.length) return;
    const batch = queue.splice(0, queue.length);
    api['mobile-analytics'].events.post({ events: batch }).catch(() => {
        /* silently fail - analytics is best-effort */
    });
}

export function trackEvent(
    type: 'screen_view' | 'action' | 'error' | 'session',
    name: string,
    metadata?: Record<string, unknown>,
    durationMs?: number
) {
    queue.push({
        type,
        name,
        timestamp: new Date().toISOString(),
        metadata,
        durationMs,
    });
    if (!flushTimer) {
        flushTimer = setTimeout(flushEvents, 5000);
    }
}

export function trackScreenView(screenName: string) {
    trackEvent('screen_view', screenName);
}

export function trackAction(actionName: string, metadata?: Record<string, unknown>) {
    trackEvent('action', actionName, metadata);
}

export function trackError(errorName: string, metadata?: Record<string, unknown>) {
    trackEvent('error', errorName, metadata);
}

export function trackSession(durationMs: number) {
    trackEvent('session', 'session', undefined, durationMs);
}
