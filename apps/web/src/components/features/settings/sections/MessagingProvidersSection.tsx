'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Bell, MessageCircle } from 'lucide-react';
import { SettingsSection } from '@/components/features/settings/SettingsPrimitives';
import type { MessagingPayload } from '@/components/features/settings/types';

const selectStyle: React.CSSProperties = {
    width: '100%', padding: '8px', backgroundColor: 'var(--notion-bg)',
    border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)',
    fontSize: '14px', outline: 'none', color: 'var(--notion-text)',
};

export function MessagingProvidersSection() {
    const [sms, setSms] = useState({ provider: '', senderId: '', apiKey: '', apiSecret: '' });
    const [email, setEmail] = useState({ smtpHost: '', smtpPort: 587, smtpUser: '', smtpFromEmail: '', smtpFromName: '', smtpPassword: '' });
    const [whatsapp, setWhatsapp] = useState({ provider: '', phoneNumberId: '', businessId: '', apiKey: '' });
    const [templates, setTemplates] = useState({
        bookingConfirmationTemplate: '',
        checkInReminderTemplate: '',
        paymentReceiptTemplate: '',
    });
    const [flags, setFlags] = useState({ apiKeySet: false, apiSecretSet: false, smtpPasswordSet: false, whatsappApiKeySet: false });
    const [saving, setSaving] = useState(false);
    const [savingTemplates, setSavingTemplates] = useState(false);

    useEffect(() => {
        api.get<any>('/settings/messaging').then(r => {
            const d = r.data; if (!d) return;
            setSms(s => ({ ...s, provider: d.sms?.provider || '', senderId: d.sms?.senderId || '' }));
            setEmail(e => ({ ...e, smtpHost: d.email?.smtpHost || '', smtpPort: d.email?.smtpPort || 587, smtpUser: d.email?.smtpUser || '', smtpFromEmail: d.email?.smtpFromEmail || '', smtpFromName: d.email?.smtpFromName || '' }));
            setWhatsapp(w => ({ ...w, provider: d.whatsapp?.provider || '', phoneNumberId: d.whatsapp?.phoneNumberId || '', businessId: d.whatsapp?.businessId || '' }));
            setFlags({ apiKeySet: !!d.sms?.apiKeySet, apiSecretSet: !!d.sms?.apiSecretSet, smtpPasswordSet: !!d.email?.smtpPasswordSet, whatsappApiKeySet: !!d.whatsapp?.apiKeySet });
        }).catch(() => {});
        api.get<any>('/saas/notifications').then(r => {
            const d = r.data;
            if (!d) return;
            setTemplates({
                bookingConfirmationTemplate: d.bookingConfirmationTemplate || '',
                checkInReminderTemplate: d.checkInReminderTemplate || '',
                paymentReceiptTemplate: d.paymentReceiptTemplate || '',
            });
        }).catch(() => {});
    }, []);

    const save = async () => {
        setSaving(true);
        try {
            const payload: MessagingPayload = {
                sms: { provider: sms.provider, senderId: sms.senderId },
                email: { smtpHost: email.smtpHost, smtpPort: email.smtpPort, smtpUser: email.smtpUser, smtpFromEmail: email.smtpFromEmail, smtpFromName: email.smtpFromName },
                whatsapp: { provider: whatsapp.provider, phoneNumberId: whatsapp.phoneNumberId, businessId: whatsapp.businessId },
            };
            if (sms.apiKey) payload.sms.apiKey = sms.apiKey;
            if (sms.apiSecret) payload.sms.apiSecret = sms.apiSecret;
            if (email.smtpPassword) payload.email.smtpPassword = email.smtpPassword;
            if (whatsapp.apiKey) payload.whatsapp!.apiKey = whatsapp.apiKey;
            await api.patch('/settings/messaging', payload);
            toast.success('Messaging providers saved');
            setSms(s => ({ ...s, apiKey: '', apiSecret: '' }));
            setEmail(e => ({ ...e, smtpPassword: '' }));
            setWhatsapp(w => ({ ...w, apiKey: '' }));
        } catch (e: any) { toast.error(e?.message || 'Failed'); } finally { setSaving(false); }
    };

    const saveTemplates = async () => {
        setSavingTemplates(true);
        try {
            await api.patch('/saas/notifications', templates);
            toast.success('Message templates saved');
        } catch (e: any) {
            toast.error(e?.message || 'Failed to save templates');
        } finally {
            setSavingTemplates(false);
        }
    };

    const textareaStyle: React.CSSProperties = {
        width: '100%',
        minHeight: '72px',
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

    return (
        <SettingsSection title="SMS, Email & WhatsApp" icon={Bell}>
            <p style={{ fontSize: 13, color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
                Connect your messaging accounts so booking confirmations, receipts, and guest updates are sent from your hotel.
            </p>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--notion-text)', marginBottom: 'var(--space-2)' }}>Text messages (SMS)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                <select value={sms.provider} onChange={e => setSms({ ...sms, provider: e.target.value })} style={selectStyle}>
                    <option value="">Choose your SMS company…</option>
                    <option value="SPARROW">Sparrow SMS (Nepal)</option>
                    <option value="AAKASH">Aakash SMS (Nepal)</option>
                    <option value="TWILIO">Twilio</option>
                </select>
                <Input placeholder="Sender name shown to guests" value={sms.senderId} onChange={e => setSms({ ...sms, senderId: e.target.value })} />
                <Input type="password" placeholder={flags.apiKeySet ? '•••••••• (saved)' : 'Access key from your SMS company'} value={sms.apiKey} onChange={e => setSms({ ...sms, apiKey: e.target.value })} />
                <Input type="password" placeholder={flags.apiSecretSet ? '•••••••• (saved)' : 'Secret (Twilio only)'} value={sms.apiSecret} onChange={e => setSms({ ...sms, apiSecret: e.target.value })} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--notion-text)', margin: 'var(--space-3) 0 var(--space-2)' }}>Email</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                <Input placeholder="Mail server (e.g. smtp.gmail.com)" value={email.smtpHost} onChange={e => setEmail({ ...email, smtpHost: e.target.value })} />
                <Input type="number" placeholder="Port (usually 587)" value={email.smtpPort || ''} onChange={e => setEmail({ ...email, smtpPort: e.target.value === '' ? 0 : Number(e.target.value) })} />
                <Input placeholder="Email login / username" value={email.smtpUser} onChange={e => setEmail({ ...email, smtpUser: e.target.value })} />
                <Input type="password" placeholder={flags.smtpPasswordSet ? '•••••••• (saved)' : 'Email password'} value={email.smtpPassword} onChange={e => setEmail({ ...email, smtpPassword: e.target.value })} />
                <Input placeholder="Send emails from (address)" value={email.smtpFromEmail} onChange={e => setEmail({ ...email, smtpFromEmail: e.target.value })} />
                <Input placeholder="Sender name (your hotel)" value={email.smtpFromName} onChange={e => setEmail({ ...email, smtpFromName: e.target.value })} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--notion-text)', margin: 'var(--space-3) 0 var(--space-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <MessageCircle size={14} /> WhatsApp
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                <select value={whatsapp.provider} onChange={e => setWhatsapp({ ...whatsapp, provider: e.target.value })} style={selectStyle}>
                    <option value="">Choose provider…</option>
                    <option value="META_CLOUD">Meta WhatsApp Cloud API</option>
                    <option value="TWILIO">Twilio WhatsApp</option>
                </select>
                <Input placeholder="Phone number ID (Meta)" value={whatsapp.phoneNumberId} onChange={e => setWhatsapp({ ...whatsapp, phoneNumberId: e.target.value })} />
                <Input placeholder="Business account ID" value={whatsapp.businessId} onChange={e => setWhatsapp({ ...whatsapp, businessId: e.target.value })} />
                <Input type="password" placeholder={flags.whatsappApiKeySet ? '•••••••• (saved)' : 'API access token'} value={whatsapp.apiKey} onChange={e => setWhatsapp({ ...whatsapp, apiKey: e.target.value })} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save providers'}</Button></div>

            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--notion-text)', margin: 'var(--space-5) 0 var(--space-2)', borderTop: '1px solid var(--notion-divider)', paddingTop: 'var(--space-4)' }}>
                Guest message templates
            </div>
            <p style={{ fontSize: 12, color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
                Use placeholders like {'{guestName}'}, {'{hotelName}'}, {'{checkIn}'}, {'{roomNumber}'}, {'{checkInTime}'}, {'{amount}'}. Both {'{var}'} and {'{{var}}'} work. Leave blank to use the default message.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <div>
                    <label style={{ fontSize: 12, color: 'var(--notion-text-secondary)', display: 'block', marginBottom: 4 }}>Booking confirmation (SMS / WhatsApp)</label>
                    <textarea
                        value={templates.bookingConfirmationTemplate}
                        onChange={e => setTemplates({ ...templates, bookingConfirmationTemplate: e.target.value })}
                        placeholder="Your booking at {hotelName} is confirmed! Check-in: {checkIn}, Room: {roomNumber}"
                        style={textareaStyle}
                    />
                </div>
                <div>
                    <label style={{ fontSize: 12, color: 'var(--notion-text-secondary)', display: 'block', marginBottom: 4 }}>Check-in reminder (day before arrival)</label>
                    <textarea
                        value={templates.checkInReminderTemplate}
                        onChange={e => setTemplates({ ...templates, checkInReminderTemplate: e.target.value })}
                        placeholder="Hi {guestName}, reminder: check-in at {hotelName} tomorrow. Room {roomNumber}, from {checkInTime}."
                        style={textareaStyle}
                    />
                </div>
                <div>
                    <label style={{ fontSize: 12, color: 'var(--notion-text-secondary)', display: 'block', marginBottom: 4 }}>Payment receipt</label>
                    <textarea
                        value={templates.paymentReceiptTemplate}
                        onChange={e => setTemplates({ ...templates, paymentReceiptTemplate: e.target.value })}
                        placeholder="Thank you {guestName} — we received NPR {amount} at {hotelName}."
                        style={textareaStyle}
                    />
                </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button onClick={saveTemplates} disabled={savingTemplates}>{savingTemplates ? 'Saving…' : 'Save templates'}</Button>
            </div>
        </SettingsSection>
    );
}
