'use client';

import { useState, useEffect, useCallback } from 'react';
import ImageUpload from '@/components/ui/ImageUpload';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Save, DollarSign } from 'lucide-react';
import { SettingsSection } from '@/components/features/settings/SettingsPrimitives';
import { normalizeEnabledPaymentMethods } from '@nivas/shared-utils';

const selectStyle: React.CSSProperties = {
    width: '100%', padding: '8px', backgroundColor: 'var(--notion-bg)',
    border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)',
    fontSize: '14px', outline: 'none', color: 'var(--notion-text)',
};

// Payment gateway / methods. Nepal rails only — no UPI (that's India).
const ALL_PAYMENT_METHODS: { value: string; label: string }[] = [
    { value: 'CASH', label: 'Cash' },
    { value: 'CARD', label: 'Card' },
    { value: 'FONEPAY', label: 'Fonepay' },
    { value: 'ESEWA', label: 'eSewa' },
    { value: 'KHALTI', label: 'Khalti' },
    { value: 'CONNECT_IPS', label: 'ConnectIPS' },
    { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
];

// Digital methods that can carry a scan-to-pay QR (excludes Cash/Card).
const QR_METHODS: { value: string; label: string }[] = [
    { value: 'FONEPAY', label: 'Fonepay' },
    { value: 'ESEWA', label: 'eSewa' },
    { value: 'KHALTI', label: 'Khalti' },
    { value: 'CONNECT_IPS', label: 'ConnectIPS' },
    { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
];

export function PaymentGatewaySection() {
    const [enabled, setEnabled] = useState<string[]>([]);
    const [fonepay, setFonepay] = useState({ merchantCode: '', secretKey: '', qrString: '', secretKeySet: false });
    const [paymentQr, setPaymentQr] = useState({ imageUrl: '', label: '' });
    const [paymentQrs, setPaymentQrs] = useState<Record<string, { imageUrl?: string; label?: string }>>({});
    const [cancellation, setCancellation] = useState({ enabled: false, type: 'FIXED', value: 0 });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<any>('/settings/payment');
            setEnabled(normalizeEnabledPaymentMethods(res.data?.enabledMethods));
            setFonepay({
                merchantCode: res.data?.fonepay?.merchantCode || '',
                secretKey: '',
                secretKeySet: !!res.data?.fonepay?.secretKeySet,
                qrString: res.data?.fonepay?.qrString || '',
            });
            setPaymentQr({ imageUrl: res.data?.paymentQr?.imageUrl || '', label: res.data?.paymentQr?.label || '' });
            setPaymentQrs(res.data?.paymentQrs || {});
            const c = res.data?.cancellation || {};
            setCancellation({ enabled: !!c.enabled, type: c.type || 'FIXED', value: Number(c.value) || 0 });
        } catch {
            // optional
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { load(); }, [load]);

    const toggle = (method: string) => {
        setEnabled(prev => prev.includes(method) ? prev.filter(m => m !== method) : [...prev, method]);
    };

    const save = async () => {
        const normalized = normalizeEnabledPaymentMethods(enabled);
        if (normalized.length === 0) { toast.error('Enable at least one payment method'); return; }
        setSaving(true);
        try {
            await api.patch('/settings/payment', {
                enabledMethods: normalized,
                fonepay: {
                    merchantCode: fonepay.merchantCode,
                    qrString: fonepay.qrString,
                    ...(fonepay.secretKey ? { secretKey: fonepay.secretKey } : {}),
                },
                paymentQr,
                paymentQrs,
                cancellation,
            });
            toast.success('Payment settings saved');
            await load();
        } catch (e: any) {
            toast.error(e?.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <SettingsSection title="Payment Methods" icon={DollarSign}><div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Loading…</div></SettingsSection>;

    return (
        <SettingsSection title="Payment Methods" icon={DollarSign}>
            <p style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)' }}>Methods enabled here appear at the POS and checkout.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                {ALL_PAYMENT_METHODS.map(m => (
                    <label key={m.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '13px', color: 'var(--notion-text)', background: enabled.includes(m.value) ? 'var(--notion-blue-bg)' : 'var(--notion-bg)' }}>
                        <input type="checkbox" checked={enabled.includes(m.value)} onChange={() => toggle(m.value)} style={{ accentColor: 'var(--notion-blue)' }} />
                        {m.label}
                    </label>
                ))}
            </div>

            {enabled.includes('FONEPAY') && (
                <div style={{ padding: 'var(--space-3)', background: 'var(--notion-bg-tertiary)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--notion-text)', marginBottom: 'var(--space-2)' }}>Fonepay Configuration</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                        <Input placeholder="Merchant Code" value={fonepay.merchantCode} onChange={e => setFonepay({ ...fonepay, merchantCode: e.target.value })} />
                        <Input type="password" placeholder={(fonepay as any).secretKeySet ? '•••• (set — blank keeps it)' : 'Secret Key'} value={fonepay.secretKey} onChange={e => setFonepay({ ...fonepay, secretKey: e.target.value })} />
                        <Input placeholder="QR String / Merchant ID" value={fonepay.qrString} onChange={e => setFonepay({ ...fonepay, qrString: e.target.value })} style={{ gridColumn: '1 / -1' }} />
                    </div>
                </div>
            )}

            {/* Per-method scan-to-pay QR — uploaded image shown at checkout for that method */}
            <div style={{ padding: 'var(--space-3)', background: 'var(--notion-bg-tertiary)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--notion-text)', marginBottom: 'var(--space-1)' }}>Scan-to-Pay QR Codes</div>
                <p style={{ fontSize: 12, color: 'var(--notion-text-muted)', marginBottom: 'var(--space-3)' }}>Upload a QR image for each digital method you accept. The matching QR is shown to the guest during checkout.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
                    {QR_METHODS.filter(m => enabled.includes(m.value)).map(m => {
                        const qr = paymentQrs[m.value] || { imageUrl: '', label: '' };
                        return (
                            <div key={m.value} style={{ border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)', background: 'var(--notion-bg)' }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--notion-text)', marginBottom: 6 }}>{m.label}</div>
                                <ImageUpload value={qr.imageUrl || null} onChange={(url) => setPaymentQrs(prev => ({ ...prev, [m.value]: { ...(prev[m.value] || {}), imageUrl: url || '' } }))} />
                                <Input placeholder="Label (optional)" value={qr.label || ''} onChange={e => setPaymentQrs(prev => ({ ...prev, [m.value]: { ...(prev[m.value] || {}), label: e.target.value } }))} style={{ marginTop: 6 }} />
                            </div>
                        );
                    })}
                    {QR_METHODS.filter(m => enabled.includes(m.value)).length === 0 && (
                        <div style={{ fontSize: 12, color: 'var(--notion-text-muted)' }}>Enable a digital method above (eSewa, Khalti, Fonepay, ConnectIPS, Bank) to upload its QR.</div>
                    )}
                </div>
            </div>

            {/* Cancellation policy */}
            <div style={{ padding: 'var(--space-3)', background: 'var(--notion-bg-tertiary)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--notion-text)', cursor: 'pointer', marginBottom: 'var(--space-2)' }}>
                    <input type="checkbox" checked={cancellation.enabled} onChange={e => setCancellation({ ...cancellation, enabled: e.target.checked })} style={{ accentColor: 'var(--notion-blue)' }} />
                    Charge a cancellation fee
                </label>
                {cancellation.enabled && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                        <select value={cancellation.type} onChange={e => setCancellation({ ...cancellation, type: e.target.value })} style={selectStyle}>
                            <option value="FIXED">Fixed amount</option>
                            <option value="PERCENT">% of booking total</option>
                        </select>
                        <Input type="number" placeholder={cancellation.type === 'PERCENT' ? '% (e.g. 10)' : 'Amount'} value={cancellation.value || ''} onChange={e => setCancellation({ ...cancellation, value: e.target.value === '' ? 0 : Number(e.target.value) })} />
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button onClick={save} disabled={saving}><Save size={14} style={{ marginRight: '6px' }} /> {saving ? 'Saving…' : 'Save Payment Methods'}</Button>
            </div>
        </SettingsSection>
    );
}
