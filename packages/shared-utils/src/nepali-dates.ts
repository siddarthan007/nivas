/**
 * Nepali (BS) calendar formatting — optional subpath; requires nepali-date-converter.
 */
import NepaliDate from 'nepali-date-converter';

export function formatNepaliDate(date?: Date | string | number): string {
    try {
        const d = date ? new Date(date) : new Date();
        const nd = new NepaliDate(d);
        return nd.format('YYYY MMMM DD');
    } catch {
        return '';
    }
}

export function formatNepaliDateTime(date?: Date | string | number): string {
    try {
        const d = date ? new Date(date) : new Date();
        const nd = new NepaliDate(d);
        const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        return `${nd.format('YYYY MMMM DD')}, ${time}`;
    } catch {
        return '';
    }
}
