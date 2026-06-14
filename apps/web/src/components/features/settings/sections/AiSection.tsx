'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import { SettingsSection } from '@/components/features/settings/SettingsPrimitives';
import type { AiPayload } from '@/components/features/settings/types';

const selectStyle: React.CSSProperties = {
    width: '100%', padding: '8px', backgroundColor: 'var(--notion-bg)',
    border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)',
    fontSize: '14px', outline: 'none', color: 'var(--notion-text)',
};

export function AiSection() {
    const [available, setAvailable] = useState<boolean | null>(null);
    const [cfg, setCfg] = useState({ enabled: true, model: 'gemini-2.5-flash', apiKey: '', dailyLimit: 500 });
    const [usage, setUsage] = useState({ used: 0, limit: 500 });
    const [keySet, setKeySet] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.get<any>('/saas/ai').then(r => {
            const d = r.data; setAvailable(!!d?.available);
            if (d?.available) {
                setCfg(c => ({ ...c, enabled: d.enabled !== false, model: d.model || 'gemini-2.5-flash', dailyLimit: d.dailyLimit || 500 }));
                setKeySet(!!d.apiKeySet);
                if (d.usage) setUsage(d.usage);
            }
        }).catch(() => setAvailable(false));
    }, []);

    if (available === null || !available) return null;

    const save = async () => {
        setSaving(true);
        try {
            const payload: AiPayload = { enabled: cfg.enabled, model: cfg.model, dailyLimit: cfg.dailyLimit };
            if (cfg.apiKey) payload.apiKey = cfg.apiKey;
            const res = await api.patch<any>('/saas/ai', payload);
            toast.success('AI settings saved');
            setCfg(c => ({ ...c, apiKey: '' }));
            setKeySet(k => k || !!payload.apiKey);
            if (res.data?.usage) setUsage(res.data.usage);
        } catch (e: any) { toast.error(e?.message || 'Failed'); } finally { setSaving(false); }
    };

    return (
        <SettingsSection title="AI Assistant" icon={Sparkles}>
            <p style={{ fontSize: 13, color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
                Turn on smart features: a chat that answers questions about your sales and occupancy, suggested replies to guest reviews, and an in-room assistant that helps guests order food and request service.
            </p>
            <div style={{ background: 'var(--notion-bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: 12, color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
                You'll need a free Google AI key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--notion-blue)' }}>aistudio.google.com</a>.
            </div>
            <div style={{ fontSize: 12, color: 'var(--notion-text-muted)', marginBottom: 'var(--space-3)' }}>
                Today's usage: <strong style={{ color: 'var(--notion-text)' }}>{usage.used}</strong> / {usage.limit} requests
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 'var(--space-3)', cursor: 'pointer' }}>
                <input type="checkbox" checked={cfg.enabled} onChange={e => setCfg({ ...cfg, enabled: e.target.checked })} /> Turn on AI features
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                <div>
                    <label style={{ fontSize: 12, color: 'var(--notion-text-secondary)', display: 'block', marginBottom: 4 }}>Google AI key</label>
                    <Input type="password" placeholder={keySet ? '•••••••• (saved)' : 'Paste your key'} value={cfg.apiKey} onChange={e => setCfg({ ...cfg, apiKey: e.target.value })} />
                </div>
                <div>
                    <label style={{ fontSize: 12, color: 'var(--notion-text-secondary)', display: 'block', marginBottom: 4 }}>Speed / quality</label>
                    <select value={cfg.model} onChange={e => setCfg({ ...cfg, model: e.target.value })} style={selectStyle}>
                        <option value="gemini-2.5-flash">Balanced (recommended)</option>
                        <option value="gemini-2.5-flash-lite">Fastest & cheapest</option>
                        <option value="gemini-2.0-flash">Standard</option>
                        <option value="gemini-2.0-flash-lite">Standard lite</option>
                    </select>
                </div>
                <div>
                    <label style={{ fontSize: 12, color: 'var(--notion-text-secondary)', display: 'block', marginBottom: 4 }}>Daily request limit</label>
                    <Input type="number" min={50} max={10000} value={cfg.dailyLimit} onChange={e => setCfg({ ...cfg, dailyLimit: Number(e.target.value) || 500 })} />
                </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-3)' }}><Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button></div>
        </SettingsSection>
    );
}
