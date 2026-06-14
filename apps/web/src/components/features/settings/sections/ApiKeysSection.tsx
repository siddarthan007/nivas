'use client';

import { useState, useEffect, useCallback } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Plus, QrCode } from 'lucide-react';
import { SettingsSection } from '@/components/features/settings/SettingsPrimitives';

interface ApiKey { id: number; name: string; keyPrefix: string; scopes: string[]; isActive: boolean; lastUsedAt?: string | null; createdAt?: string }

// Booking-engine API keys — generate keys for the hotel's website / partners.
export function ApiKeysSection() {
    const [keys, setKeys] = useState<ApiKey[]>([]);
    const [name, setName] = useState('');
    const [canBook, setCanBook] = useState(false);
    const [newKey, setNewKey] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [preview, setPreview] = useState<{ checkIn: string; checkOut: string; totalAvailable: number; roomTypes: { type: string; available: number; fromRate: number }[] } | null>(null);
    const [previewBusy, setPreviewBusy] = useState(false);

    const load = useCallback(async () => {
        try { const r = await api.get<ApiKey[]>('/api-keys'); setKeys(r.data || []); } catch { /* optional */ }
    }, []);
    useEffect(() => { load(); }, [load]);

    const create = async () => {
        if (!name.trim()) { toast.error('Name required'); return; }
        setBusy(true);
        try {
            const r = await api.post<{ key: string }>('/api-keys', { name: name.trim(), scopes: canBook ? ['read', 'book'] : ['read'] });
            setNewKey(r.data?.key || null);
            setName(''); setCanBook(false);
            await load();
        } catch (e: any) { toast.error(e?.message || 'Failed'); } finally { setBusy(false); }
    };
    const revoke = async (id: number) => { try { await api.delete(`/api-keys/${id}`); await load(); } catch (e: any) { toast.error(e?.message || 'Failed'); } };

    const runPreview = async () => {
        setPreviewBusy(true);
        try {
            const r = await api.get<{ checkIn: string; checkOut: string; totalAvailable: number; roomTypes: { type: string; available: number; fromRate: number }[] }>('/api-keys/availability-preview');
            setPreview(r.data || null);
        } catch (e: any) { toast.error(e?.message || 'Preview failed'); }
        finally { setPreviewBusy(false); }
    };

    return (
        <SettingsSection title="Website Booking Connection" icon={QrCode}>
            <p style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
                Create a secure key so your own website can show live room availability and take direct bookings. Give this key to whoever built your website — keep it private.
            </p>
            {newKey && (
                <div style={{ background: 'var(--notion-green-bg)', border: '1px solid var(--notion-green)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--notion-green)', marginBottom: 4 }}>Copy now — shown only once:</div>
                    <code style={{ fontSize: 12, wordBreak: 'break-all', color: 'var(--notion-text)' }}>{newKey}</code>
                    <div style={{ marginTop: 6 }}><Button size="sm" variant="secondary" onClick={() => { navigator.clipboard.writeText(newKey); toast.success('Copied'); }}>Copy</Button> <Button size="sm" variant="ghost" onClick={() => setNewKey(null)}>Done</Button></div>
                </div>
            )}
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
                <Input placeholder="Key name (e.g. Website)" value={name} onChange={e => setName(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--notion-text-secondary)' }}>
                    <input type="checkbox" checked={canBook} onChange={e => setCanBook(e.target.checked)} /> Allow booking
                </label>
                <Button onClick={create} disabled={busy}><Plus size={14} style={{ marginRight: 4 }} />Generate</Button>
            </div>
            {keys.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {keys.map(k => (
                        <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', opacity: k.isActive ? 1 : 0.5 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--notion-text)' }}>{k.name}</span>
                            <code style={{ fontSize: 11, color: 'var(--notion-text-muted)' }}>{k.keyPrefix}…</code>
                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--notion-bg-tertiary)', color: 'var(--notion-text-secondary)' }}>{(k.scopes || []).join(', ')}</span>
                            <span style={{ flex: 1 }} />
                            {k.isActive ? <Button size="sm" variant="ghost" onClick={() => revoke(k.id)} style={{ color: 'var(--notion-red)' }}>Revoke</Button> : <span style={{ fontSize: 11, color: 'var(--notion-text-muted)' }}>Revoked</span>}
                        </div>
                    ))}
                </div>
            )}
            <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--notion-border)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--notion-text)', marginBottom: 8 }}>Availability smoke test</div>
                <p style={{ fontSize: 12, color: 'var(--notion-text-secondary)', marginBottom: 8 }}>Checks live room availability for tomorrow night using the same logic as your website booking API.</p>
                <Button variant="secondary" size="sm" onClick={runPreview} disabled={previewBusy}>{previewBusy ? 'Checking…' : 'Run preview'}</Button>
                {preview && (
                    <div style={{ marginTop: 10, padding: 10, background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', fontSize: 12 }}>
                        <div style={{ color: 'var(--notion-text-secondary)', marginBottom: 6 }}>{preview.checkIn} → {preview.checkOut}</div>
                        <div style={{ fontWeight: 600, color: 'var(--notion-text)', marginBottom: 6 }}>{preview.totalAvailable} rooms available</div>
                        {preview.roomTypes.map(rt => (
                            <div key={rt.type} style={{ color: 'var(--notion-text)' }}>{rt.type}: {rt.available} from NPR {rt.fromRate}</div>
                        ))}
                    </div>
                )}
            </div>
        </SettingsSection>
    );
}
