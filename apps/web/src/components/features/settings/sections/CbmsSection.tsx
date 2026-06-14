'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Bell } from 'lucide-react';
import { SettingsSection } from '@/components/features/settings/SettingsPrimitives';
import type { CbmsPayload } from '@/components/features/settings/types';

// IRD CBMS (Nepal) real-time billing sync — only shown when the plan enables it.
export function CbmsSection() {
    const [available, setAvailable] = useState<boolean | null>(null);
    const [cfg, setCfg] = useState({ enabled: false, username: '', sellerPan: '', isRealtime: true, password: '' });
    const [passwordSet, setPasswordSet] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.get<any>('/saas/cbms').then(r => {
            const d = r.data; setAvailable(!!d?.available);
            if (d?.available) { setCfg(c => ({ ...c, enabled: !!d.enabled, username: d.username || '', sellerPan: d.sellerPan || '', isRealtime: d.isRealtime ?? true })); setPasswordSet(!!d.passwordSet); }
        }).catch(() => setAvailable(false));
    }, []);

    if (available === null) return null;
    if (!available) return null; // plan doesn't include CBMS → hide entirely

    const save = async () => {
        setSaving(true);
        try {
            const payload: CbmsPayload = { enabled: cfg.enabled, username: cfg.username, sellerPan: cfg.sellerPan, isRealtime: cfg.isRealtime };
            if (cfg.password) payload.password = cfg.password;
            await api.patch('/saas/cbms', payload);
            toast.success('CBMS settings saved');
            setCfg(c => ({ ...c, password: '' })); setPasswordSet(p => p || !!payload.password);
        } catch (e: any) { toast.error(e?.message || 'Failed'); } finally { setSaving(false); }
    };

    return (
        <SettingsSection title="IRD CBMS (Real-time Billing Sync)" icon={Bell}>
            <p style={{ fontSize: 12, color: 'var(--notion-text-muted)', marginBottom: 'var(--space-3)' }}>
                Auto-syncs every invoice + credit note to IRD's Central Billing Monitoring System. Use the IRD-issued username, password and seller PAN.
            </p>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 'var(--space-3)', cursor: 'pointer' }}>
                <input type="checkbox" checked={cfg.enabled} onChange={e => setCfg({ ...cfg, enabled: e.target.checked })} />
                Enable CBMS sync
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                <Input label="IRD username" value={cfg.username} onChange={e => setCfg({ ...cfg, username: e.target.value })} />
                <Input label="IRD password" type="password" placeholder={passwordSet ? '•••• (set — blank keeps it)' : ''} value={cfg.password} onChange={e => setCfg({ ...cfg, password: e.target.value })} />
                <Input label="Seller PAN" value={cfg.sellerPan} onChange={e => setCfg({ ...cfg, sellerPan: e.target.value })} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, alignSelf: 'end', paddingBottom: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={cfg.isRealtime} onChange={e => setCfg({ ...cfg, isRealtime: e.target.checked })} />
                    Mark pushes as real-time
                </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save CBMS Settings'}</Button></div>
        </SettingsSection>
    );
}
