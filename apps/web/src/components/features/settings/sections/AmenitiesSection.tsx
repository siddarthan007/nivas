'use client';

import { useState, useEffect, useCallback } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Trash2, DollarSign } from 'lucide-react';
import { SettingsSection } from '@/components/features/settings/SettingsPrimitives';

const selectStyle: React.CSSProperties = {
    width: '100%', padding: '8px', backgroundColor: 'var(--notion-bg)',
    border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)',
    fontSize: '14px', outline: 'none', color: 'var(--notion-text)',
};

interface Amenity { id: number; name: string; category: string; price: string | number; taxable: boolean; isActive: boolean }
const AMENITY_CATEGORIES = ['PARKING', 'EV_CHARGING', 'DAMAGE', 'LAUNDRY', 'SPA', 'MINIBAR', 'OTHER'];

// Extra-charge catalog (parking, EV charging, damages, laundry…) postable to a
// guest folio / POS bill.
export function AmenitiesSection() {
    const [items, setItems] = useState<Amenity[]>([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ name: '', category: 'PARKING', price: '', taxable: true });
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<Amenity[]>('/amenities');
            setItems(res.data || []);
        } catch { /* optional */ } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const add = async () => {
        if (!form.name.trim() || form.price === '' || Number(form.price) < 0) { toast.error('Name and price required'); return; }
        setSaving(true);
        try {
            await api.post('/amenities', { name: form.name.trim(), category: form.category, price: Number(form.price), taxable: form.taxable });
            toast.success('Amenity added');
            setForm({ name: '', category: 'PARKING', price: '', taxable: true });
            await load();
        } catch (e: any) { toast.error(e?.message || 'Failed'); } finally { setSaving(false); }
    };
    const toggle = async (a: Amenity) => { try { await api.patch(`/amenities/${a.id}`, { isActive: !a.isActive }); await load(); } catch (e: any) { toast.error(e?.message || 'Failed'); } };
    const del = async (id: number) => { try { await api.delete(`/amenities/${id}`); await load(); } catch (e: any) { toast.error(e?.message || 'Failed'); } };

    return (
        <SettingsSection title="Amenities & Extra Charges" icon={DollarSign}>
            <p style={{ fontSize: '12px', color: 'var(--notion-text-muted)', marginBottom: 'var(--space-3)' }}>Damages, EV charging, parking, laundry, etc. Postable to a guest folio or POS bill.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr auto', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', alignItems: 'center' }}>
                <Input placeholder="Name (e.g. Parking / fwd)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={selectStyle}>
                    {AMENITY_CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                </select>
                <Input type="number" placeholder="Price" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
                <Button onClick={add} disabled={saving}><Plus size={14} /></Button>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-4)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.taxable} onChange={e => setForm({ ...form, taxable: e.target.checked })} style={{ accentColor: 'var(--notion-blue)' }} /> Taxable
            </label>

            {loading ? <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Loading…</div>
                : items.length === 0 ? <div style={{ fontSize: '13px', color: 'var(--notion-text-muted)', textAlign: 'center', padding: '12px' }}>No amenities yet.</div>
                : (
                    <div style={{ border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                            <thead style={{ background: 'var(--notion-bg-tertiary)', color: 'var(--notion-text-secondary)' }}>
                                <tr>
                                    <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500 }}>Name</th>
                                    <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500 }}>Category</th>
                                    <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500 }}>Price</th>
                                    <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 500 }}>Status</th>
                                    <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500 }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(a => (
                                    <tr key={a.id} style={{ borderTop: '1px solid var(--notion-border)' }}>
                                        <td style={{ padding: '8px 12px', fontWeight: 500, color: 'var(--notion-text)' }}>{a.name}</td>
                                        <td style={{ padding: '8px 12px', color: 'var(--notion-text-secondary)' }}>{a.category?.replace('_', ' ')}</td>
                                        <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--notion-text)' }}>NPR {Number(a.price || 0).toFixed(2)}{a.taxable ? '' : ' (no tax)'}</td>
                                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                            <button onClick={() => toggle(a)} style={{ cursor: 'pointer', border: 'none', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', fontWeight: 600, background: a.isActive ? 'var(--notion-green-bg)' : 'var(--notion-bg-tertiary)', color: a.isActive ? 'var(--notion-green)' : 'var(--notion-text-secondary)' }}>{a.isActive ? 'Active' : 'Inactive'}</button>
                                        </td>
                                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                            <Button size="sm" variant="ghost" onClick={() => del(a.id)} style={{ color: 'var(--notion-red)' }}><Trash2 size={14} /></Button>
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
