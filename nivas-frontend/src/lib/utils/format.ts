/**
 * Centralized money formatting so the whole ERP renders currency consistently
 * (was a mix of "Rs.", "₹", "NPR " across pages).
 */
export function formatCurrency(amount: number | string | null | undefined, currency = 'NPR'): string {
    const n = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
    const value = Number.isFinite(n) ? n : 0;
    return `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Compact money for tight UI (no decimals, e.g. dashboard tiles). */
export function formatMoneyShort(amount: number | string | null | undefined, currency = 'NPR'): string {
    const n = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
    const value = Number.isFinite(n) ? n : 0;
    return `${currency} ${Math.round(value).toLocaleString()}`;
}

/**
 * Format a Date as a LOCAL `YYYY-MM-DD` (no timezone shift). `toISOString()`
 * converts to UTC, which rolls a locally-picked midnight back a day in UTC+
 * zones (e.g. Asia/Kathmandu) — breaking date-range filters.
 */
export function toLocalDateString(d: Date): string {
    if (!(d instanceof Date) || isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
