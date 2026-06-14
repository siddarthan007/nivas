'use client';

import { useState, useEffect, useCallback } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Save, FileText } from 'lucide-react';
import { ToggleSwitch, SettingsSection } from '@/components/features/settings/SettingsPrimitives';

// Bill / receipt template configuration (invoice prefix, footer, terms + toggles).
export function BillReceiptSection() {
    const [form, setForm] = useState({
        prefix: '', footerText: '', terms: '', headerNote: '', receiptFooter: '',
        showLogo: true, showTaxBreakdown: true, showQr: false,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<any>('/settings');
            const inv = res.data?.invoice || {};
            const cfg = inv.config || {};
            setForm({
                prefix: inv.prefix || '',
                footerText: inv.footerText || '',
                terms: inv.terms || '',
                headerNote: cfg.headerNote || '',
                receiptFooter: cfg.receiptFooter || '',
                showLogo: cfg.showLogo !== false,
                showTaxBreakdown: cfg.showTaxBreakdown !== false,
                showQr: cfg.showQr === true,
            });
        } catch {
            // optional
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { load(); }, [load]);

    const save = async () => {
        setSaving(true);
        try {
            await api.patch('/settings/invoice', {
                prefix: form.prefix,
                footerText: form.footerText,
                terms: form.terms,
                config: {
                    headerNote: form.headerNote,
                    receiptFooter: form.receiptFooter,
                    showLogo: form.showLogo,
                    showTaxBreakdown: form.showTaxBreakdown,
                    showQr: form.showQr,
                },
            });
            toast.success('Bill/receipt template saved');
        } catch (e: any) {
            toast.error(e?.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const taLabel = { fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' } as const;
    const taStyle: React.CSSProperties = {
        width: '100%', minHeight: '60px', padding: '8px 12px', backgroundColor: 'var(--notion-bg)',
        border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', color: 'var(--notion-text)',
        fontSize: '14px', fontFamily: 'inherit', resize: 'vertical',
    };

    if (loading) return <SettingsSection title="Bill / Receipt Template" icon={FileText}><div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Loading…</div></SettingsSection>;

    return (
        <SettingsSection title="Bill / Receipt Template" icon={FileText}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <div>
                    <label style={taLabel}>Invoice Prefix</label>
                    <Input value={form.prefix} onChange={e => setForm({ ...form, prefix: e.target.value })} placeholder="INV" />
                </div>
                <div>
                    <label style={taLabel}>Header Note (top of invoice)</label>
                    <Input value={form.headerNote} onChange={e => setForm({ ...form, headerNote: e.target.value })} placeholder="Tax Invoice" />
                </div>
            </div>
            <div style={{ marginBottom: 'var(--space-3)' }}>
                <label style={taLabel}>Footer Text</label>
                <textarea value={form.footerText} onChange={e => setForm({ ...form, footerText: e.target.value })} style={taStyle} placeholder="Thank you for your stay!" />
            </div>
            <div style={{ marginBottom: 'var(--space-3)' }}>
                <label style={taLabel}>Terms &amp; Conditions</label>
                <textarea value={form.terms} onChange={e => setForm({ ...form, terms: e.target.value })} style={taStyle} placeholder="Payment due on receipt…" />
            </div>
            <div style={{ marginBottom: 'var(--space-4)' }}>
                <label style={taLabel}>Receipt Footer (thermal / POS)</label>
                <Input value={form.receiptFooter} onChange={e => setForm({ ...form, receiptFooter: e.target.value })} placeholder="Visit again!" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                <ToggleSwitch enabled={form.showLogo} onToggle={() => setForm({ ...form, showLogo: !form.showLogo })} label="Show hotel logo on invoice" />
                <ToggleSwitch enabled={form.showTaxBreakdown} onToggle={() => setForm({ ...form, showTaxBreakdown: !form.showTaxBreakdown })} label="Show tax / service charge breakdown" />
                <ToggleSwitch enabled={form.showQr} onToggle={() => setForm({ ...form, showQr: !form.showQr })} label="Show payment QR on receipt" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button onClick={save} disabled={saving}><Save size={14} style={{ marginRight: '6px' }} /> {saving ? 'Saving…' : 'Save Template'}</Button>
            </div>
        </SettingsSection>
    );
}
