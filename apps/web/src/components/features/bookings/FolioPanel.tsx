import { useState, useEffect, useCallback } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Trash2, ArrowRightLeft, AlertTriangle, Star } from 'lucide-react';
import { usePermissions } from '@/lib/hooks/usePermissions';

interface Charge { id: number; description: string; amount: string | number; type?: string; invoiceId?: number | null }
interface GuestContext {
    isVip?: boolean;
    preferences?: unknown;
    allergies?: string[];
    notes?: string;
}
interface FolioData {
    booking?: { guestName?: string; room?: { number?: number | string } };
    guestContext?: GuestContext | null;
    charges: Charge[];
    summary?: { totalCharges?: number; totalPayments?: number; balance?: number };
}
interface BookingOpt { id: string; guestName?: string; room?: { number?: number | string } }

/**
 * Per-booking folio editor: add / void charges, and MOVE a charge to another
 * in-house booking (= split a bill across guests / transfer on room change).
 */
export default function FolioPanel({ isOpen, bookingId, onClose, otherBookings, onChanged }: {
    isOpen: boolean;
    bookingId: string | null;
    onClose: () => void;
    otherBookings: BookingOpt[];
    onChanged?: () => void;
}) {
    const { can } = usePermissions();
    const [data, setData] = useState<FolioData | null>(null);
    const [loading, setLoading] = useState(false);
    const [desc, setDesc] = useState('');
    const [amount, setAmount] = useState('');
    const [moveTarget, setMoveTarget] = useState<Record<number, string>>({});
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        if (!bookingId) return;
        setLoading(true);
        try { const r = await api.get<FolioData>(`/billing/bookings/${bookingId}/folio`); setData(r.data || null); }
        catch (e: any) { toast.error(e?.message || 'Failed to load folio'); }
        finally { setLoading(false); }
    }, [bookingId]);
    useEffect(() => { if (isOpen) load(); }, [isOpen, load]);

    const addCharge = async () => {
        if (!desc.trim() || !Number(amount)) { toast.error('Description + amount required'); return; }
        setBusy(true);
        try {
            await api.post('/billing/folio-charges', { bookingId, description: desc.trim(), amount: Number(amount), type: 'MISCELLANEOUS' });
            setDesc(''); setAmount(''); await load(); onChanged?.();
        } catch (e: any) { toast.error(e?.message || 'Failed'); } finally { setBusy(false); }
    };
    const voidCharge = async (id: number) => {
        if (!confirm('Remove this charge?')) return;
        try { await api.delete(`/billing/folio-charges/${id}`); await load(); onChanged?.(); } catch (e: any) { toast.error(e?.message || 'Failed'); }
    };
    const moveCharge = async (id: number) => {
        const target = moveTarget[id];
        if (!target) { toast.error('Pick a booking to move to'); return; }
        try {
            await api.post(`/billing/folio-charges/${id}/move`, { targetBookingId: target });
            toast.success('Charge moved');
            setMoveTarget(prev => { const n = { ...prev }; delete n[id]; return n; });
            await load(); onChanged?.();
        } catch (e: any) { toast.error(e?.message || 'Failed'); }
    };

    const charges = data?.charges || [];
    const targets = otherBookings.filter(b => b.id !== bookingId);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Folio — ${data?.booking?.guestName || ''}${data?.booking?.room?.number ? ` · Room ${data.booking.room.number}` : ''}`} size="lg">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {data?.guestContext && (data.guestContext.isVip || (data.guestContext.allergies?.length ?? 0) > 0 || data.guestContext.notes) && (
                    <div style={{
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--notion-border)',
                        background: 'var(--notion-bg-secondary)',
                        fontSize: 13,
                    }}>
                        {data.guestContext.isVip && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--notion-orange)', fontWeight: 600, marginBottom: 6 }}>
                                <Star size={14} fill="currentColor" /> VIP Guest
                            </div>
                        )}
                        {(data.guestContext.allergies?.length ?? 0) > 0 && (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, color: 'var(--notion-red)', marginBottom: 4 }}>
                                <AlertTriangle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                                <span><strong>Allergies:</strong> {data.guestContext.allergies!.join(', ')}</span>
                            </div>
                        )}
                        {data.guestContext.notes && (
                            <div style={{ color: 'var(--notion-text-secondary)' }}>
                                <strong>Notes:</strong> {data.guestContext.notes}
                            </div>
                        )}
                    </div>
                )}
                {/* Add charge */}
                {can('finance:generate_invoice') && (
                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
                        <div style={{ flex: 2 }}><Input label="Add charge" placeholder="Description (e.g. Minibar)" value={desc} onChange={e => setDesc(e.target.value)} /></div>
                        <div style={{ width: 120 }}><Input label="Amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
                        <Button onClick={addCharge} disabled={busy}>Add</Button>
                    </div>
                )}

                {/* Charges */}
                {loading ? <div style={{ fontSize: 13, color: 'var(--notion-text-secondary)' }}>Loading…</div>
                    : charges.length === 0 ? <div style={{ fontSize: 13, color: 'var(--notion-text-muted)', textAlign: 'center', padding: 16 }}>No charges yet.</div>
                    : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
                            {charges.map(c => {
                                const locked = !!c.invoiceId;
                                return (
                                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)' }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 13, color: 'var(--notion-text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.description}</div>
                                            <div style={{ fontSize: 11, color: 'var(--notion-text-muted)' }}>{c.type}{locked ? ' · invoiced' : ''}</div>
                                        </div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--notion-text)', whiteSpace: 'nowrap' }}>NPR {Number(c.amount).toLocaleString()}</div>
                                        {can('finance:generate_invoice') && !locked && targets.length > 0 && (
                                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                                <select value={moveTarget[c.id] || ''} onChange={e => setMoveTarget(prev => ({ ...prev, [c.id]: e.target.value }))}
                                                    style={{ fontSize: 12, padding: '4px 6px', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-sm)', background: 'var(--notion-bg)', color: 'var(--notion-text)', maxWidth: 130 }}>
                                                    <option value="">Move to…</option>
                                                    {targets.map(b => <option key={b.id} value={b.id}>{b.guestName || 'Guest'}{b.room?.number ? ` (R${b.room.number})` : ''}</option>)}
                                                </select>
                                                <Button size="sm" variant="ghost" onClick={() => moveCharge(c.id)} title="Move charge"><ArrowRightLeft size={14} /></Button>
                                            </div>
                                        )}
                                        {can('finance:generate_invoice') && !locked && <Button size="sm" variant="ghost" onClick={() => voidCharge(c.id)} style={{ color: 'var(--notion-red)' }}><Trash2 size={14} /></Button>}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                {/* Summary */}
                {data?.summary && (
                    <div style={{ borderTop: '1px solid var(--notion-divider)', paddingTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                        <Row label="Total charges" value={data.summary.totalCharges} />
                        <Row label="Payments" value={data.summary.totalPayments} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--notion-text)', borderTop: '1px solid var(--notion-divider)', paddingTop: 6 }}>
                            <span>Balance due</span><span>NPR {Number(data.summary.balance || 0).toLocaleString()}</span>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}

function Row({ label, value }: { label: string; value?: number }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--notion-text-secondary)' }}>
            <span>{label}</span><span>NPR {Number(value || 0).toLocaleString()}</span>
        </div>
    );
}
