'use client';

import { useState, useEffect, useCallback } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Save, Clock } from 'lucide-react';
import { SettingsSection } from '@/components/features/settings/SettingsPrimitives';

// Fiscal year + locale (Nepal BS fiscal year start, currency, timezone).
export function FiscalYearSection() {
    const [form, setForm] = useState({ fiscalYearStart: '', currency: 'NPR', timezone: 'Asia/Kathmandu' });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<any>('/settings');
            const r = res.data?.regional || {};
            setForm({
                fiscalYearStart: r.fiscalYearStart || '',
                currency: r.currency || 'NPR',
                timezone: r.timezone || 'Asia/Kathmandu',
            });
        } catch { /* optional */ } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const save = async () => {
        setSaving(true);
        try {
            await api.patch('/settings/regional', form);
            toast.success('Fiscal year & locale saved');
        } catch (e: any) { toast.error(e?.message || 'Failed to save'); }
        finally { setSaving(false); }
    };

    if (loading) return <SettingsSection title="Fiscal Year & Locale" icon={Clock}><div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Loading…</div></SettingsSection>;
    const lbl = { fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' } as const;

    return (
        <SettingsSection title="Fiscal Year & Locale" icon={Clock}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <div>
                    <label style={lbl}>Fiscal Year Start</label>
                    <Input value={form.fiscalYearStart} onChange={e => setForm({ ...form, fiscalYearStart: e.target.value })} placeholder="Shrawan 1 (e.g. 07-16)" />
                </div>
                <div>
                    <label style={lbl}>Timezone</label>
                    <Input value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })} placeholder="Asia/Kathmandu" />
                </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-4)', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                <span style={{ fontWeight: 500, color: 'var(--notion-text)' }}>Currency:</span> NPR (Nepalese Rupee)
            </div>
            <p style={{ fontSize: '12px', color: 'var(--notion-text-muted)', marginBottom: 'var(--space-3)' }}>Nepal fiscal year runs Shrawan→Ashad. Invoice numbering resets each fiscal year.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button onClick={save} disabled={saving}><Save size={14} style={{ marginRight: '6px' }} /> {saving ? 'Saving…' : 'Save'}</Button>
            </div>
        </SettingsSection>
    );
}
