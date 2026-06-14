/** Nepal payment rails accepted by Nivas PMS (no UPI — India-only). */
export const VALID_PAYMENT_METHODS = [
    'CASH',
    'CARD',
    'FONEPAY',
    'ESEWA',
    'KHALTI',
    'CONNECT_IPS',
    'BANK_TRANSFER',
] as const;

export type NepalPaymentMethod = (typeof VALID_PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
    CASH: 'Cash',
    CARD: 'Card',
    FONEPAY: 'Fonepay',
    ESEWA: 'eSewa',
    KHALTI: 'Khalti',
    CONNECT_IPS: 'ConnectIPS',
    BANK_TRANSFER: 'Bank Transfer',
    UNPAID: 'Unpaid',
    OTHER: 'Other',
};

export function getPaymentMethodLabel(method: string): string {
    return PAYMENT_METHOD_LABELS[method] ?? method.charAt(0) + method.slice(1).toLowerCase().replace(/_/g, ' ');
}

export function isQrPaymentMethod(method: string): boolean {
    return method === 'FONEPAY' || method === 'ESEWA' || method === 'KHALTI' || method === 'CONNECT_IPS';
}

/** Keep only known methods, preserve order, dedupe. */
export function normalizeEnabledPaymentMethods(methods: string[] | undefined | null): string[] {
    if (!Array.isArray(methods) || methods.length === 0) return [];
    const valid = new Set<string>(VALID_PAYMENT_METHODS);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const m of methods) {
        const key = String(m).toUpperCase();
        if (!valid.has(key) || seen.has(key)) continue;
        seen.add(key);
        out.push(key);
    }
    return out;
}

export const DEFAULT_ENABLED_PAYMENT_METHODS: NepalPaymentMethod[] = [
    'CASH',
    'CARD',
    'FONEPAY',
    'ESEWA',
    'KHALTI',
    'BANK_TRANSFER',
];
