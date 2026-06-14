import { ValidationError } from './errors';

export type BookingDateKind = 'checkIn' | 'checkOut';

const DEFAULT_CHECK_IN_TIME = '14:00:00';
const DEFAULT_CHECK_OUT_TIME = '11:00:00';

/**
 * Parse booking dates from API / engine payloads.
 * Accepts ISO datetimes, YYYY-MM-DD, and DD/MM/YYYY (common in Nepal).
 */
export function parseBookingDate(input: unknown, kind: BookingDateKind = 'checkIn'): Date {
    if (input instanceof Date) {
        if (isNaN(input.getTime())) throw new ValidationError('Invalid date');
        return input;
    }
    if (input === null || input === undefined || input === '') {
        throw new ValidationError('Date is required');
    }

    const raw = String(input).trim();
    const timeSuffix = kind === 'checkOut' ? DEFAULT_CHECK_OUT_TIME : DEFAULT_CHECK_IN_TIME;

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const dt = new Date(`${raw}T${timeSuffix}`);
        if (isNaN(dt.getTime())) throw new ValidationError('Invalid date');
        return dt;
    }

    const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy?.[1] && dmy[2] && dmy[3]) {
        const day = dmy[1].padStart(2, '0');
        const month = dmy[2].padStart(2, '0');
        const year = dmy[3];
        const dt = new Date(`${year}-${month}-${day}T${timeSuffix}`);
        if (isNaN(dt.getTime())) throw new ValidationError('Invalid date format');
        return dt;
    }

    const dt = new Date(raw);
    if (isNaN(dt.getTime())) throw new ValidationError('Invalid date format');
    return dt;
}

export function nightsBetween(checkIn: Date, checkOut: Date): number {
    const ms = checkOut.getTime() - checkIn.getTime();
    return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}
