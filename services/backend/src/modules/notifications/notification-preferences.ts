export type MessageEventId =
    | 'bookingConfirmation'
    | 'checkInReminder'
    | 'paymentReceipt'
    | 'checkout'
    | 'reviewRequest'
    | 'outstandingBalance'
    | 'licenseExpiry';

export type ChannelFlags = { sms?: boolean; email?: boolean; whatsapp?: boolean };

export type MessageChannelPrefs = Partial<Record<MessageEventId, ChannelFlags>>;

export const MESSAGE_EVENT_META: { id: MessageEventId; label: string; description: string }[] = [
    { id: 'bookingConfirmation', label: 'Booking confirmation', description: 'Sent when a reservation is created' },
    { id: 'checkInReminder', label: 'Check-in reminder', description: 'Day before arrival' },
    { id: 'paymentReceipt', label: 'Payment receipt', description: 'After a guest payment is recorded' },
    { id: 'checkout', label: 'Checkout summary', description: 'When a guest checks out' },
    { id: 'reviewRequest', label: 'Post-stay review', description: '48 hours after checkout' },
    { id: 'outstandingBalance', label: 'Outstanding balance', description: 'Unsettled folio reminders' },
    { id: 'licenseExpiry', label: 'License expiry', description: 'SaaS license warnings (admin)' },
];

const DEFAULT_CHANNEL_FLAGS: ChannelFlags = { sms: true, email: true, whatsapp: false };

const DEFAULT_PREFS: MessageChannelPrefs = Object.fromEntries(
    MESSAGE_EVENT_META.map(e => [e.id, { ...DEFAULT_CHANNEL_FLAGS }]),
) as MessageChannelPrefs;

export function mergeMessageChannelPrefs(raw?: MessageChannelPrefs | null): MessageChannelPrefs {
    const out: MessageChannelPrefs = { ...DEFAULT_PREFS };
    if (!raw) return out;
    for (const [event, flags] of Object.entries(raw)) {
        if (event === 'orderReady') continue;
        out[event as MessageEventId] = {
            ...DEFAULT_PREFS[event as MessageEventId],
            ...flags,
        };
    }
    return out;
}

export function isChannelEnabled(
    prefs: MessageChannelPrefs,
    event: MessageEventId,
    channel: 'sms' | 'email' | 'whatsapp',
): boolean {
    const flags = prefs[event];
    if (!flags) return DEFAULT_CHANNEL_FLAGS[channel] !== false;
    if (flags[channel] === undefined) return DEFAULT_CHANNEL_FLAGS[channel] !== false;
    return flags[channel] !== false;
}
