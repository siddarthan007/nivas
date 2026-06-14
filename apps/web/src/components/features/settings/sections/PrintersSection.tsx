'use client';

import { useState, useEffect, useCallback } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Trash2, Printer } from 'lucide-react';
import { SettingsSection } from '@/components/features/settings/SettingsPrimitives';

// Section Card Component
interface KotPrinter {
    id: number;
    name: string;
    printerType?: string;
    ipAddress?: string | null;
    port?: number | null;
    station?: string | null;
    categories?: string[] | null;
    isDefault?: boolean;
    isActive?: boolean;
}

// KOT/BOT printer management — list, add, test and remove network printers.
export function PrintersSection() {
    const [printers, setPrinters] = useState<KotPrinter[]>([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ name: '', ipAddress: '', port: '9100', station: '', categories: '', isDefault: false });
    const [saving, setSaving] = useState(false);
    const [testingId, setTestingId] = useState<number | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<KotPrinter[]>('/orders/kot/printers');
            setPrinters(res.data || []);
        } catch {
            // section is optional; ignore load failure
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const addPrinter = async () => {
        if (!form.name.trim()) { toast.error('Printer name is required'); return; }
        setSaving(true);
        try {
            await api.post('/orders/kot/printers', {
                name: form.name.trim(),
                ipAddress: form.ipAddress.trim() || undefined,
                port: form.port ? Number(form.port) : 9100,
                station: form.station.trim() || undefined,
                categories: form.categories.split(',').map(c => c.trim()).filter(Boolean),
                isDefault: form.isDefault,
            });
            toast.success('Printer added');
            setForm({ name: '', ipAddress: '', port: '9100', station: '', categories: '', isDefault: false });
            await load();
        } catch (e: any) {
            toast.error(e?.message || 'Failed to add printer');
        } finally {
            setSaving(false);
        }
    };

    const testPrinter = async (id: number) => {
        setTestingId(id);
        try {
            await api.post(`/orders/kot/printers/${id}/test`);
            toast.success('Test sent to printer');
        } catch (e: any) {
            toast.error(e?.message || 'Printer connection failed');
        } finally {
            setTestingId(null);
        }
    };

    const removePrinter = async (id: number) => {
        try {
            await api.delete(`/orders/kot/printers/${id}`);
            toast.success('Printer removed');
            await load();
        } catch (e: any) {
            toast.error(e?.message || 'Failed to remove printer');
        }
    };

    const inputStyle = { width: '100%' } as const;

    return (
        <SettingsSection title="KOT / BOT Printers" icon={Printer}>
            {/* Add printer form */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <Input placeholder="Printer Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
                <Input placeholder="Station / Title (e.g. Kitchen)" value={form.station} onChange={e => setForm({ ...form, station: e.target.value })} style={inputStyle} />
                <Input placeholder="IP Address (e.g. 192.168.1.50)" value={form.ipAddress} onChange={e => setForm({ ...form, ipAddress: e.target.value })} style={inputStyle} />
                <Input placeholder="Port" value={form.port} onChange={e => setForm({ ...form, port: e.target.value })} style={inputStyle} />
                <Input placeholder="Categories (comma separated)" value={form.categories} onChange={e => setForm({ ...form, categories: e.target.value })} style={{ ...inputStyle, gridColumn: '1 / -1' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--notion-text-secondary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.isDefault} onChange={e => setForm({ ...form, isDefault: e.target.checked })} style={{ accentColor: 'var(--notion-blue)' }} />
                    Default printer (catch-all)
                </label>
                <Button onClick={addPrinter} disabled={saving}><Plus size={14} style={{ marginRight: '6px' }} /> {saving ? 'Adding…' : 'Add Printer'}</Button>
            </div>

            {/* Printer list */}
            {loading ? (
                <div style={{ padding: '16px', color: 'var(--notion-text-secondary)', fontSize: '13px' }}>Loading printers…</div>
            ) : printers.length === 0 ? (
                <div style={{ padding: '16px', color: 'var(--notion-text-muted)', fontSize: '13px', textAlign: 'center' }}>No printers configured yet.</div>
            ) : (
                <div style={{ border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                        <thead style={{ background: 'var(--notion-bg-tertiary)', color: 'var(--notion-text-secondary)' }}>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '8px 12px' }}>Name</th>
                                <th style={{ textAlign: 'left', padding: '8px 12px' }}>IP : Port</th>
                                <th style={{ textAlign: 'left', padding: '8px 12px' }}>Station</th>
                                <th style={{ textAlign: 'left', padding: '8px 12px' }}>Categories</th>
                                <th style={{ textAlign: 'right', padding: '8px 12px' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {printers.map(p => (
                                <tr key={p.id} style={{ borderTop: '1px solid var(--notion-border)' }}>
                                    <td style={{ padding: '8px 12px', color: 'var(--notion-text)', fontWeight: 500 }}>
                                        {p.name}{p.isDefault && <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: 600, color: 'var(--notion-blue)', background: 'var(--notion-blue-bg)', padding: '1px 6px', borderRadius: '4px' }}>DEFAULT</span>}
                                    </td>
                                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: 'var(--notion-text-secondary)' }}>{p.ipAddress || '—'}{p.ipAddress ? `:${p.port ?? 9100}` : ''}</td>
                                    <td style={{ padding: '8px 12px', color: 'var(--notion-text-secondary)' }}>{p.station || '—'}</td>
                                    <td style={{ padding: '8px 12px', color: 'var(--notion-text-secondary)' }}>{(p.categories && p.categories.length) ? p.categories.join(', ') : 'All'}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                        <Button size="sm" variant="secondary" onClick={() => testPrinter(p.id)} disabled={testingId === p.id} style={{ marginRight: '6px' }}>{testingId === p.id ? 'Testing…' : 'Test'}</Button>
                                        <Button size="sm" variant="ghost" onClick={() => removePrinter(p.id)} style={{ color: 'var(--notion-red)' }}><Trash2 size={14} /></Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </SettingsSection>
    );
}
