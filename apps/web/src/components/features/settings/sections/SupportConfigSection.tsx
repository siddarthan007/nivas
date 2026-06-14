'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Settings } from 'lucide-react';
import { SettingsSection } from '@/components/features/settings/SettingsPrimitives';

// SaaS-admin: configure the support contacts shown to all hotels.
export function SupportConfigSection() {
    const [cfg, setCfg] = useState({ email: '', phone: '', whatsapp: '', hours: '' });
    const [saving, setSaving] = useState(false);
    useEffect(() => { api.get<any>('/saas-admin/support').then(r => r.data && setCfg({ email: r.data.email || '', phone: r.data.phone || '', whatsapp: r.data.whatsapp || '', hours: r.data.hours || '' })).catch(() => {}); }, []);
    const save = async () => {
        setSaving(true);
        try { await api.patch('/saas-admin/support', cfg); toast.success('Support contacts saved'); }
        catch (e: any) { toast.error(e?.message || 'Failed'); } finally { setSaving(false); }
    };
    return (
        <SettingsSection title="Support Contacts" icon={Settings}>
            <p style={{ fontSize: 13, color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>Shown to all hotels in the in-app "Help" button.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                <Input placeholder="Support email" value={cfg.email} onChange={e => setCfg({ ...cfg, email: e.target.value })} />
                <Input placeholder="Phone" value={cfg.phone} onChange={e => setCfg({ ...cfg, phone: e.target.value })} />
                <Input placeholder="WhatsApp number (with country code)" value={cfg.whatsapp} onChange={e => setCfg({ ...cfg, whatsapp: e.target.value })} />
                <Input placeholder="Hours (e.g. Sun–Fri, 9am–6pm)" value={cfg.hours} onChange={e => setCfg({ ...cfg, hours: e.target.value })} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-3)' }}><Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button></div>
        </SettingsSection>
    );
}
