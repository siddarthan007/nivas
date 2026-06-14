'use client';

import { useState, useEffect, useCallback } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Save, Bell, Mail, Smartphone } from 'lucide-react';
import { ToggleSwitch, SettingsSection } from '@/components/features/settings/SettingsPrimitives';

type ChannelFlags = { sms?: boolean; email?: boolean; whatsapp?: boolean };
type MessageChannels = Record<string, ChannelFlags>;

const MESSAGE_EVENTS: { id: string; label: string; description: string }[] = [
    { id: 'bookingConfirmation', label: 'Booking confirmation', description: 'When a reservation is created' },
    { id: 'checkInReminder', label: 'Check-in reminder', description: 'Day before arrival' },
    { id: 'paymentReceipt', label: 'Payment receipt', description: 'After payment is recorded' },
    { id: 'checkout', label: 'Checkout summary', description: 'When a guest checks out' },
    { id: 'reviewRequest', label: 'Post-stay review', description: '48 hours after checkout' },
    { id: 'outstandingBalance', label: 'Outstanding balance', description: 'Unsettled folio reminders' },
    { id: 'licenseExpiry', label: 'License expiry', description: 'SaaS license warnings' },
];

const EMAIL_TEMPLATE_KEYS: { key: string; label: string; hint: string }[] = [
    { key: 'bookingConfirmation', label: 'Booking confirmation (HTML body)', hint: 'Use {guestName}, {hotelName}, {checkIn}, {roomNumber}, {bookingId}' },
    { key: 'checkInReminder', label: 'Check-in reminder (HTML body)', hint: 'Use {guestName}, {hotelName}, {roomNumber}, {checkInTime}' },
    { key: 'paymentReceipt', label: 'Payment receipt (HTML body)', hint: 'Use {guestName}, {amount}, {currency}, {invoiceNumber}, {hotelName}' },
];

const PUSH_EVENTS: { key: string; label: string }[] = [
    { key: 'newBooking', label: 'New booking confirmed' },
    { key: 'checkout', label: 'Guest checkout / room ready' },
    { key: 'newOrder', label: 'New F&B order' },
    { key: 'lowStock', label: 'Low stock alerts' },
    { key: 'housekeeping', label: 'Housekeeping requests' },
];

export function NotificationSettingsSection() {
    const [events, setEvents] = useState<Record<string, boolean>>({});
    const [messageChannels, setMessageChannels] = useState<MessageChannels>({});
    const [emailTemplates, setEmailTemplates] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<any>('/settings/notifications');
            setEvents(res.data?.events || {});
            setMessageChannels(res.data?.messageChannels || {});
            setEmailTemplates(res.data?.emailTemplates || {});
        } catch { /* optional */ } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const save = async () => {
        setSaving(true);
        try {
            await api.patch('/settings/notifications', { events, messageChannels, emailTemplates });
            toast.success('Notification settings saved');
        } catch (e: any) { toast.error(e?.message || 'Failed to save'); }
        finally { setSaving(false); }
    };

    const toggleChannel = (eventId: string, channel: keyof ChannelFlags) => {
        setMessageChannels(prev => {
            const current = prev[eventId] || {};
            const defaultOn = channel !== 'whatsapp';
            const isOn = current[channel] !== undefined ? current[channel] !== false : defaultOn;
            return {
                ...prev,
                [eventId]: { ...current, [channel]: !isOn },
            };
        });
    };

    const channelChecked = (flags: ChannelFlags, channel: keyof ChannelFlags) => {
        if (flags[channel] !== undefined) return flags[channel] !== false;
        return channel !== 'whatsapp';
    };

    const textareaStyle: React.CSSProperties = {
        width: '100%',
        minHeight: '64px',
        padding: '8px',
        backgroundColor: 'var(--notion-bg)',
        border: '1px solid var(--notion-border)',
        borderRadius: 'var(--radius-md)',
        fontSize: '13px',
        outline: 'none',
        color: 'var(--notion-text)',
        resize: 'vertical',
        fontFamily: 'inherit',
    };

    if (loading) return <SettingsSection title="Notifications" icon={Bell}><div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Loading…</div></SettingsSection>;
    const lbl = { fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' } as const;

    return (
        <SettingsSection title="Notifications" icon={Bell}>
            <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px',
                background: 'var(--notion-bg-secondary)', border: '1px solid var(--notion-border)',
                borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', fontSize: 12, color: 'var(--notion-text-secondary)', lineHeight: 1.5,
            }}>
                <Smartphone size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                    In-app alerts use <strong>WebSocket</strong> on the web dashboard and <strong>Expo Push</strong> on mobile — no third-party push service required.
                    Guest SMS/email/WhatsApp only send when the channel is enabled below <em>and</em> provider credentials are configured.
                </span>
            </div>

            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--notion-text)', marginBottom: 'var(--space-2)' }}>In-app alerts (web + mobile)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                {PUSH_EVENTS.map(ev => (
                    <ToggleSwitch key={ev.key} enabled={events[ev.key] !== false} onToggle={() => setEvents({ ...events, [ev.key]: events[ev.key] === false })} label={ev.label} />
                ))}
            </div>

            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--notion-text)', marginBottom: 'var(--space-2)', borderTop: '1px solid var(--notion-divider)', paddingTop: 'var(--space-4)' }}>
                Guest message channels (SMS / Email / WhatsApp)
            </div>
            <p style={{ fontSize: 12, color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
                WhatsApp is off by default. Enable per event only after configuring WhatsApp in SMS, Email &amp; WhatsApp settings.
            </p>
            <div style={{ overflowX: 'auto', marginBottom: 'var(--space-4)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--notion-border)', textAlign: 'left' }}>
                            <th style={{ padding: '8px 4px', color: 'var(--notion-text-secondary)', fontWeight: 600 }}>Event</th>
                            <th style={{ padding: '8px 4px', color: 'var(--notion-text-secondary)', fontWeight: 600, width: 72 }}>SMS</th>
                            <th style={{ padding: '8px 4px', color: 'var(--notion-text-secondary)', fontWeight: 600, width: 72 }}>Email</th>
                            <th style={{ padding: '8px 4px', color: 'var(--notion-text-secondary)', fontWeight: 600, width: 88 }}>WhatsApp</th>
                        </tr>
                    </thead>
                    <tbody>
                        {MESSAGE_EVENTS.map(ev => {
                            const flags = messageChannels[ev.id] || {};
                            const cell = (ch: keyof ChannelFlags) => (
                                <td key={ch} style={{ padding: '6px 4px' }}>
                                    <input
                                        type="checkbox"
                                        checked={channelChecked(flags, ch)}
                                        onChange={() => toggleChannel(ev.id, ch)}
                                        aria-label={`${ev.label} ${ch}`}
                                    />
                                </td>
                            );
                            return (
                                <tr key={ev.id} style={{ borderBottom: '1px solid var(--notion-divider)' }}>
                                    <td style={{ padding: '8px 4px' }}>
                                        <div style={{ fontWeight: 500, color: 'var(--notion-text)' }}>{ev.label}</div>
                                        <div style={{ fontSize: 11, color: 'var(--notion-text-secondary)' }}>{ev.description}</div>
                                    </td>
                                    {cell('sms')}
                                    {cell('email')}
                                    {cell('whatsapp')}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--notion-text)', marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Mail size={14} /> Custom HTML email bodies
            </div>
            <p style={{ fontSize: 12, color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
                Optional HTML snippets with {'{variables}'} — wrapped in your hotel&apos;s branded email layout. Leave blank for the default template.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                {EMAIL_TEMPLATE_KEYS.map(tpl => (
                    <div key={tpl.key}>
                        <label style={{ fontSize: 12, color: 'var(--notion-text-secondary)', display: 'block', marginBottom: 4 }}>{tpl.label}</label>
                        <textarea
                            value={emailTemplates[tpl.key] || ''}
                            onChange={e => setEmailTemplates({ ...emailTemplates, [tpl.key]: e.target.value })}
                            placeholder={tpl.hint}
                            style={textareaStyle}
                        />
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button onClick={save} disabled={saving}><Save size={14} style={{ marginRight: '6px' }} /> {saving ? 'Saving…' : 'Save'}</Button>
            </div>
        </SettingsSection>
    );
}
