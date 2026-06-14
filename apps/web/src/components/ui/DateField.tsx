import CustomDatePicker from './DatePicker';

/**
 * Thin string-based wrapper over the design-consistent CustomDatePicker, so the
 * native `<input type="date">` (value/onChange are `YYYY-MM-DD` strings) can be
 * swapped in-place without converting every call site to Date objects.
 */
interface DateFieldProps {
    value?: string;                          // YYYY-MM-DD
    onChange?: (value: string) => void;      // emits YYYY-MM-DD ('' when cleared)
    label?: string;
    placeholder?: string;
    min?: string;                            // YYYY-MM-DD
    max?: string;
    required?: boolean;
    error?: string;
    fullWidth?: boolean;
}

function toDate(s?: string): Date | null {
    if (!s) return null;
    const d = new Date(`${s}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
}

function toStr(d: Date | null): string {
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export default function DateField({ value, onChange, min, max, ...rest }: DateFieldProps) {
    return (
        <CustomDatePicker
            selected={toDate(value)}
            onChange={(d) => onChange?.(toStr(d))}
            minDate={toDate(min) ?? undefined}
            maxDate={toDate(max) ?? undefined}
            {...rest}
        />
    );
}
