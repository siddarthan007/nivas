'use client';

import { useState, useEffect, useCallback } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import DateField from '@/components/ui/DateField';
import SortableTh from '@/components/ui/SortableTh';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useTableSort } from '@/lib/hooks/useTableSort';
import { Plus, Trash2, DollarSign } from 'lucide-react';
import { SettingsSection } from '@/components/features/settings/SettingsPrimitives';

interface Coupon {
    id: number;
    code: string;
    description?: string | null;
    discountType: 'PERCENT' | 'FIXED';
    discountValue: string | number;
    maxDiscount?: string | number | null;
    minOrderAmount?: string | number | null;
    scope: 'ALL' | 'ROOM' | 'FNB';
    usageLimit?: number | null;
    usedCount?: number | null;
    validUntil?: string | null;
    isActive?: boolean;
}

const selectStyle: React.CSSProperties = {
    width: '100%', padding: '8px', backgroundColor: 'var(--notion-bg)',
    border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)',
    fontSize: '14px', outline: 'none', color: 'var(--notion-text)',
};

// Coupons / discounts management — create, toggle and remove promo codes.
export function CouponsSection() {
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        code: '', description: '', discountType: 'PERCENT', discountValue: '', maxDiscount: '',
        minOrderAmount: '', scope: 'ALL', usageLimit: '', validUntil: '',
    });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<Coupon[]>('/coupons');
            setCoupons(res.data || []);
        } catch {
            // optional section
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { load(); }, [load]);

    const { sorted, sortField, sortDir, toggleSort } = useTableSort(
        coupons, 'code', 'asc',
        {
            discountValue: c => Number(c.discountValue),
            usedCount: c => Number(c.usedCount ?? 0),
            status: c => (c.isActive ? 1 : 0),
        }
    );

    const addCoupon = async () => {
        if (!form.code.trim()) { toast.error('Coupon code is required'); return; }
        if (!form.discountValue || Number(form.discountValue) <= 0) { toast.error('Enter a discount value'); return; }
        setSaving(true);
        try {
            await api.post('/coupons', {
                code: form.code.trim().toUpperCase(),
                description: form.description.trim() || undefined,
                discountType: form.discountType,
                discountValue: Number(form.discountValue),
                maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : 0,
                minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : 0,
                scope: form.scope,
                usageLimit: form.usageLimit ? Number(form.usageLimit) : 0,
                validUntil: form.validUntil || undefined,
            });
            toast.success('Coupon created');
            setForm({ code: '', description: '', discountType: 'PERCENT', discountValue: '', maxDiscount: '', minOrderAmount: '', scope: 'ALL', usageLimit: '', validUntil: '' });
            await load();
        } catch (e: any) {
            toast.error(e?.message || 'Failed to create coupon');
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (c: Coupon) => {
        try {
            await api.patch(`/coupons/${c.id}`, { isActive: !c.isActive });
            await load();
        } catch (e: any) { toast.error(e?.message || 'Failed to update coupon'); }
    };

    const removeCoupon = async (id: number) => {
        try {
            await api.delete(`/coupons/${id}`);
            toast.success('Coupon removed');
            await load();
        } catch (e: any) { toast.error(e?.message || 'Failed to remove coupon'); }
    };

    return (
        <SettingsSection title="Coupons & Discounts" icon={DollarSign}>
            {/* Create form */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <Input placeholder="Code * (e.g. WELCOME10)" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
                <select value={form.discountType} onChange={e => setForm({ ...form, discountType: e.target.value })} style={selectStyle}>
                    <option value="PERCENT">Percent (%)</option>
                    <option value="FIXED">Fixed (NPR)</option>
                </select>
                <Input type="number" placeholder="Discount value *" value={form.discountValue} onChange={e => setForm({ ...form, discountValue: e.target.value })} />
                <select value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value })} style={selectStyle}>
                    <option value="ALL">All</option>
                    <option value="ROOM">Room only</option>
                    <option value="FNB">F&B only</option>
                </select>
                <Input type="number" placeholder="Min order (optional)" value={form.minOrderAmount} onChange={e => setForm({ ...form, minOrderAmount: e.target.value })} />
                <Input type="number" placeholder="Max discount (% cap)" value={form.maxDiscount} onChange={e => setForm({ ...form, maxDiscount: e.target.value })} />
                <Input type="number" placeholder="Usage limit (0 = ∞)" value={form.usageLimit} onChange={e => setForm({ ...form, usageLimit: e.target.value })} />
                <DateField placeholder="Valid until" value={form.validUntil} onChange={(v) => setForm({ ...form, validUntil: v })} />
                <Input placeholder="Description (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-4)' }}>
                <Button onClick={addCoupon} disabled={saving}><Plus size={14} style={{ marginRight: '6px' }} /> {saving ? 'Adding…' : 'Add Coupon'}</Button>
            </div>

            {/* List */}
            {loading ? (
                <div style={{ padding: '16px', color: 'var(--notion-text-secondary)', fontSize: '13px' }}>Loading coupons…</div>
            ) : coupons.length === 0 ? (
                <div style={{ padding: '16px', color: 'var(--notion-text-muted)', fontSize: '13px', textAlign: 'center' }}>No coupons yet.</div>
            ) : (
                <div style={{ border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                        <thead style={{ background: 'var(--notion-bg-tertiary)', color: 'var(--notion-text-secondary)' }}>
                            <tr>
                                <SortableTh field="code" label="Code" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                                <SortableTh field="discountType" label="Type" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                                <SortableTh field="discountValue" label="Value" sortField={sortField} sortDir={sortDir} onSort={toggleSort} align="right" />
                                <SortableTh field="scope" label="Scope" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                                <SortableTh field="usedCount" label="Used" sortField={sortField} sortDir={sortDir} onSort={toggleSort} align="right" />
                                <SortableTh field="status" label="Status" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 500 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.map(c => (
                                <tr key={c.id} style={{ borderTop: '1px solid var(--notion-border)' }}>
                                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--notion-text)' }}>{c.code}</td>
                                    <td style={{ padding: '8px 12px', color: 'var(--notion-text-secondary)' }}>{c.discountType}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--notion-text)' }}>{c.discountType === 'PERCENT' ? `${Number(c.discountValue)}%` : `NPR ${Number(c.discountValue)}`}</td>
                                    <td style={{ padding: '8px 12px', color: 'var(--notion-text-secondary)' }}>{c.scope}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--notion-text-secondary)' }}>{c.usedCount ?? 0}{(c.usageLimit ?? 0) > 0 ? `/${c.usageLimit}` : ''}</td>
                                    <td style={{ padding: '8px 12px' }}>
                                        <button onClick={() => toggleActive(c)} style={{ cursor: 'pointer', border: 'none', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', fontWeight: 600, background: c.isActive ? 'var(--notion-green-bg)' : 'var(--notion-bg-tertiary)', color: c.isActive ? 'var(--notion-green)' : 'var(--notion-text-secondary)' }}>
                                            {c.isActive ? 'Active' : 'Inactive'}
                                        </button>
                                    </td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                        <Button size="sm" variant="ghost" onClick={() => removeCoupon(c.id)} style={{ color: 'var(--notion-red)' }}><Trash2 size={14} /></Button>
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
