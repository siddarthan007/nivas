import { useState, useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Search, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import type { RecordPaymentPayload } from '@/lib/hooks/useFinance';

interface InvoiceLike {
    id: string;
    invoiceNumber?: string;
    bookingId?: string | null;
    grandTotal?: string | number;
    paymentStatus?: string;
    guestPan?: string | null;
    createdAt?: string;
    booking?: { guestName?: string; guestPhone?: string; checkIn?: string; checkOut?: string } | null;
}

const METHODS = ['CASH', 'CARD', 'FONEPAY', 'BANK_TRANSFER', 'ESEWA', 'KHALTI'];

/**
 * Collect a late / credit payment against a specific outstanding invoice.
 * Lists CREDIT invoices, lets staff pinpoint one (search), and records the
 * payment linked directly to that invoice's booking — which flips it to PAID.
 */
export default function CreditSettlementTab({ invoices, onRecordPayment }: {
    invoices: InvoiceLike[];
    onRecordPayment: (data: RecordPaymentPayload) => Promise<boolean>;
}) {
    const [query, setQuery] = useState('');
    const [target, setTarget] = useState<InvoiceLike | null>(null);
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('CASH');
    const [busy, setBusy] = useState(false);

    const outstanding = useMemo(() => {
        const q = query.trim().toLowerCase();
        return invoices
            .filter(i => i.paymentStatus === 'CREDIT')
            .filter(i => !q
                || (i.invoiceNumber || '').toLowerCase().includes(q)
                || (i.booking?.guestName || '').toLowerCase().includes(q)
                || (i.booking?.guestPhone || '').includes(q));
    }, [invoices, query]);

    const openSettle = (inv: InvoiceLike) => {
        setTarget(inv);
        setAmount(String(Number(inv.grandTotal || 0)));
        setMethod('CASH');
    };

    const submit = async () => {
        if (!target?.bookingId) { toast.error('This invoice is not linked to a booking'); return; }
        const amt = Number(amount);
        if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
        setBusy(true);
        try {
            const ok = await onRecordPayment({ bookingId: target.bookingId, amount: amt, paymentMethod: method } as RecordPaymentPayload);
            if (ok) setTarget(null);
        } finally { setBusy(false); }
    };

    return (
        <div>
            <div style={{ position: 'relative', maxWidth: 360, marginBottom: 'var(--space-4)' }}>
                <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--notion-text-muted)' }} />
                <input
                    value={query} onChange={e => setQuery(e.target.value)}
                    placeholder="Find by invoice #, guest name or phone…"
                    style={{ width: '100%', padding: '8px 10px 8px 32px', fontSize: 13, border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', background: 'var(--notion-bg)', color: 'var(--notion-text)' }}
                />
            </div>

            {outstanding.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--notion-text-muted)', fontSize: 13 }}>No outstanding credit invoices.</div>
            ) : (
                <div style={{ border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                        <thead style={{ background: 'var(--notion-bg-tertiary)', color: 'var(--notion-text-secondary)' }}>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500 }}>Invoice</th>
                                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500 }}>Guest</th>
                                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500 }}>Stay</th>
                                <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500 }}>Amount Due</th>
                                <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {outstanding.map(inv => (
                                <tr key={inv.id} style={{ borderTop: '1px solid var(--notion-border)' }}>
                                    <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--notion-text)' }}>{inv.invoiceNumber || inv.id.slice(0, 8)}</td>
                                    <td style={{ padding: '8px 12px', color: 'var(--notion-text)' }}>{inv.booking?.guestName || '—'}<div style={{ fontSize: 11, color: 'var(--notion-text-muted)' }}>{inv.booking?.guestPhone || ''}</div></td>
                                    <td style={{ padding: '8px 12px', color: 'var(--notion-text-secondary)', fontSize: 12 }}>{inv.booking?.checkIn ? new Date(inv.booking.checkIn).toLocaleDateString() : ''}{inv.booking?.checkOut ? ` → ${new Date(inv.booking.checkOut).toLocaleDateString()}` : ''}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--notion-red)' }}>Rs {Number(inv.grandTotal || 0).toLocaleString()}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                        <Button size="sm" onClick={() => openSettle(inv)}><CreditCard size={14} style={{ marginRight: 6 }} />Record Payment</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Modal isOpen={!!target} onClose={() => setTarget(null)} title={`Record Payment — ${target?.invoiceNumber || ''}`}>
                {target && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <div style={{ background: 'var(--notion-bg-tertiary)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', fontSize: 13 }}>
                            <div><strong>{target.booking?.guestName || 'Guest'}</strong> · {target.booking?.guestPhone || ''}</div>
                            <div style={{ color: 'var(--notion-text-secondary)' }}>Invoice {target.invoiceNumber} · Due Rs {Number(target.grandTotal || 0).toLocaleString()}</div>
                        </div>
                        <div>
                            <label style={{ fontSize: 13, color: 'var(--notion-text-secondary)', display: 'block', marginBottom: 4 }}>Amount Received</label>
                            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} fullWidth />
                        </div>
                        <div>
                            <label style={{ fontSize: 13, color: 'var(--notion-text-secondary)', display: 'block', marginBottom: 4 }}>Method</label>
                            <select value={method} onChange={e => setMethod(e.target.value)} style={{ width: '100%', padding: '8px 10px', fontSize: 14, border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', background: 'var(--notion-bg)', color: 'var(--notion-text)' }}>
                                {METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                            </select>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                            <Button variant="secondary" onClick={() => setTarget(null)}>Cancel</Button>
                            <Button onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Record Payment'}</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
