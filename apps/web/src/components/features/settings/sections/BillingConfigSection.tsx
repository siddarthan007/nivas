'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import api from '@/lib/api';
import { toast } from 'sonner';
import { CreditCard } from 'lucide-react';
import { SettingsSection } from '@/components/features/settings/SettingsPrimitives';

/** SaaS-admin: billing contacts shown on subscription invoices. */
export function BillingConfigSection() {
    const [cfg, setCfg] = useState({ name: '', email: '', phone: '', pan: '', vat: '', address: '' });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.get<typeof cfg>('/saas-admin/billing')
            .then(r => { if (r.data) setCfg({ name: r.data.name || '', email: r.data.email || '', phone: r.data.phone || '', pan: r.data.pan || '', vat: r.data.vat || '', address: r.data.address || '' }); })
            .catch(() => {});
    }, []);

    const save = async () => {
        setSaving(true);
        try {
            await api.patch('/saas-admin/billing', cfg);
            toast.success('Billing contacts saved');
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <SettingsSection title="Billing & Invoices" icon={CreditCard}>
            <p style={{ fontSize: 13, color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
                Legal entity details printed on SaaS subscription invoices.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                <Input placeholder="Company name" value={cfg.name} onChange={e => setCfg({ ...cfg, name: e.target.value })} />
                <Input placeholder="Billing email" value={cfg.email} onChange={e => setCfg({ ...cfg, email: e.target.value })} />
                <Input placeholder="Phone" value={cfg.phone} onChange={e => setCfg({ ...cfg, phone: e.target.value })} />
                <Input placeholder="PAN" value={cfg.pan} onChange={e => setCfg({ ...cfg, pan: e.target.value })} />
                <Input placeholder="VAT number" value={cfg.vat} onChange={e => setCfg({ ...cfg, vat: e.target.value })} />
                <Input placeholder="Address" value={cfg.address} onChange={e => setCfg({ ...cfg, address: e.target.value })} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-3)' }}>
                <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            </div>
        </SettingsSection>
    );
}
