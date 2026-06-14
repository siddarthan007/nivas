/** Safe string for React Native Text — never pass raw Date objects. */
export function formatDisplayText(value: unknown): string {
    if (value == null || value === '') return '—';
    if (value instanceof Date) {
        return value.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    }
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) {
            return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        }
    }
    if (typeof value === 'object' && value !== null && 'toISOString' in value) {
        try {
            return new Date((value as Date).toISOString()).toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
            });
        } catch {
            return String(value);
        }
    }
    return String(value);
}

export function toIsoString(value: unknown): string | undefined {
    if (value == null || value === '') return undefined;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null && 'toISOString' in value) {
        try {
            return new Date((value as Date).toISOString()).toISOString();
        } catch {
            return undefined;
        }
    }
    return String(value);
}

export function asMinutes(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

export function formatDurationMinutes(minutes: unknown): string {
    const total = Math.max(0, Math.floor(asMinutes(minutes)));
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${h}h ${m}m`;
}

export function formatTimeLabel(iso?: string | Date | null): string {
    if (!iso) return '—';
    const d = iso instanceof Date ? iso : new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
