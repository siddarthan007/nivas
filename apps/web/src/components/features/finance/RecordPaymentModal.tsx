'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { normalizeEnabledPaymentMethods } from '@nivas/shared-utils';
import type { RecordPaymentPayload, Payment } from '@/lib/hooks/useFinance';

const ALL_PAYMENT_METHODS = [
    { value: 'CASH', label: 'Cash' },
    { value: 'CARD', label: 'Card' },
    { value: 'ESEWA', label: 'eSewa' },
    { value: 'KHALTI', label: 'Khalti' },
    { value: 'CONNECT_IPS', label: 'Connect IPS' },
    { value: 'FONEPAY', label: 'Fonepay' },
    { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
    { value: 'OTHER', label: 'Other' },
];

export interface PaymentContext {
    bookingId?: string;
    orderId?: string;
    guestName?: string;
    totalDue?: number;
    label?: string;
}

interface RecordPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Called after a successful payment (API or onSubmit path). */
    onSuccess?: () => void;
    /** Custom submit handler — used by Finance hub. Falls back to direct API when omitted. */
    onSubmit?: (data: RecordPaymentPayload) => Promise<boolean>;
    /** Pre-fill context for order/booking payments. */
    context?: PaymentContext;
}

export default function RecordPaymentModal({
    isOpen,
    onClose,
    onSuccess,
    onSubmit,
    context,
}: RecordPaymentModalProps) {
    const [amount, setAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<Payment['paymentMethod']>('CASH');
    const [transactionId, setTransactionId] = useState('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [linkType, setLinkType] = useState<'booking' | 'order' | 'none'>('none');
    const [bookingId, setBookingId] = useState('');
    const [orderId, setOrderId] = useState('');
    const [payQr, setPayQr] = useState<{ imageUrl?: string; label?: string } | null>(null);
    const [payQrs, setPayQrs] = useState<Record<string, { imageUrl?: string; label?: string }>>({});
    const [methodOptions, setMethodOptions] = useState(ALL_PAYMENT_METHODS);

    const showLinkToggles = !context?.bookingId && !context?.orderId;

    useEffect(() => {
        if (!isOpen) return;
        if (context?.bookingId) {
            setLinkType('booking');
            setBookingId(context.bookingId);
        } else if (context?.orderId) {
            setLinkType('order');
            setOrderId(context.orderId);
        } else {
            setLinkType('none');
            setBookingId('');
            setOrderId('');
        }
        if (context?.totalDue) {
            setAmount(String(context.totalDue));
        } else {
            setAmount('');
        }
        setPaymentMethod('CASH');
        setTransactionId('');
        setNotes('');

        api.get<{ enabledMethods?: string[]; paymentQr?: { imageUrl?: string; label?: string }; paymentQrs?: Record<string, { imageUrl?: string; label?: string }> }>('/settings/payment')
            .then(r => {
                const enabled = normalizeEnabledPaymentMethods(r.data?.enabledMethods);
                const enabledSet = new Set(enabled);
                const filtered = enabled.length > 0
                    ? ALL_PAYMENT_METHODS.filter(m => enabledSet.has(m.value))
                    : ALL_PAYMENT_METHODS.filter(m => m.value !== 'OTHER');
                setMethodOptions(filtered.length > 0 ? [...filtered, { value: 'OTHER', label: 'Other' }] : ALL_PAYMENT_METHODS);
                setPayQr(r.data?.paymentQr || null);
                setPayQrs(r.data?.paymentQrs || {});
                if (enabled.length > 0 && !enabledSet.has(paymentMethod) && paymentMethod !== 'OTHER') {
                    setPaymentMethod(enabled[0] as Payment['paymentMethod']);
                }
            })
            .catch(() => {});
    }, [isOpen, context?.bookingId, context?.orderId, context?.totalDue]);

    const activeQr = (payQrs[paymentMethod]?.imageUrl ? payQrs[paymentMethod] : payQr) || null;

    const buildPayload = (): RecordPaymentPayload | null => {
        const num = parseFloat(amount);
        if (!num || num <= 0) {
            toast.error('Enter a valid amount');
            return null;
        }
        const payload: RecordPaymentPayload = {
            amount: num,
            paymentMethod,
        };
        const resolvedBookingId = context?.bookingId || (linkType === 'booking' ? bookingId : undefined);
        const resolvedOrderId = context?.orderId || (linkType === 'order' ? orderId : undefined);
        if (resolvedBookingId) payload.bookingId = resolvedBookingId;
        if (resolvedOrderId) payload.orderId = resolvedOrderId;
        if (transactionId) payload.transactionId = transactionId;
        if (notes) payload.notes = notes;
        return payload;
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        const payload = buildPayload();
        if (!payload) return;

        setIsSubmitting(true);
        try {
            if (onSubmit) {
                const success = await onSubmit(payload);
                if (!success) return;
            } else {
                await api.post('/finance/payments', payload);
                toast.success('Payment recorded successfully');
            }
            onSuccess?.();
            onClose();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to record payment';
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const labelStyle = { fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' } as const;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Record Payment">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {context?.label && (
                    <div style={{
                        padding: '12px',
                        backgroundColor: 'var(--notion-bg-tertiary)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--notion-border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}>
                        <div>
                            <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Payment for</div>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--notion-text)' }}>{context.label}</div>
                            {context.guestName && (
                                <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', marginTop: '2px' }}>
                                    Guest: {context.guestName}
                                </div>
                            )}
                        </div>
                        {context.totalDue !== undefined && (
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase' }}>Due</div>
                                <div style={{
                                    fontSize: '18px', fontWeight: 700,
                                    color: context.totalDue > 0 ? 'var(--notion-red)' : 'var(--notion-green)',
                                }}>
                                    NPR {context.totalDue.toLocaleString()}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {showLinkToggles && (
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        {(['none', 'booking', 'order'] as const).map(type => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => {
                                    setLinkType(type);
                                    if (type !== 'booking') setBookingId('');
                                    if (type !== 'order') setOrderId('');
                                }}
                                style={{
                                    padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)',
                                    backgroundColor: linkType === type ? 'var(--notion-blue-bg)' : 'var(--notion-bg-secondary)',
                                    color: linkType === type ? 'var(--notion-blue)' : 'var(--notion-text-secondary)',
                                    cursor: 'pointer', fontSize: '12px', fontWeight: 500,
                                }}
                            >
                                {type === 'none' ? 'Unlinked' : type === 'booking' ? 'Booking' : 'Order'}
                            </button>
                        ))}
                    </div>
                )}

                {showLinkToggles && linkType === 'booking' && (
                    <div>
                        <label style={labelStyle}>Booking ID</label>
                        <Input
                            type="text"
                            value={bookingId}
                            onChange={e => setBookingId(e.target.value)}
                            placeholder="Link payment to a booking"
                        />
                    </div>
                )}

                {showLinkToggles && linkType === 'order' && (
                    <div>
                        <label style={labelStyle}>Order ID</label>
                        <Input
                            type="text"
                            value={orderId}
                            onChange={e => setOrderId(e.target.value)}
                            placeholder="Link payment to an order"
                        />
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <div>
                        <label style={labelStyle}>Amount (NPR) *</label>
                        <Input
                            type="number"
                            min={0}
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            placeholder={context?.totalDue ? `Max NPR ${context.totalDue.toLocaleString()}` : '0.00'}
                            required
                        />
                        {context?.totalDue !== undefined && (
                            <button
                                type="button"
                                onClick={() => setAmount(String(context.totalDue))}
                                style={{
                                    fontSize: '11px', color: 'var(--notion-blue)', background: 'none',
                                    border: 'none', cursor: 'pointer', marginTop: '4px', padding: 0,
                                }}
                            >
                                Pay full amount (NPR {context.totalDue.toLocaleString()})
                            </button>
                        )}
                    </div>
                    <div>
                        <label style={labelStyle}>Payment Method *</label>
                        <Select
                            value={paymentMethod}
                            onChange={e => setPaymentMethod(e.target.value as Payment['paymentMethod'])}
                            options={methodOptions}
                            fullWidth
                        />
                    </div>
                </div>

                {paymentMethod !== 'CASH' && (
                    <div>
                        {activeQr?.imageUrl && (
                            <div style={{ textAlign: 'center', marginBottom: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                                <img src={activeQr.imageUrl} alt="Scan to pay" style={{ height: 180, maxWidth: '100%', objectFit: 'contain' }} />
                                <div style={{ fontSize: 12, color: 'var(--notion-text-secondary)', marginTop: 6 }}>
                                    {activeQr.label || `Scan to pay (${paymentMethod})`}
                                </div>
                            </div>
                        )}
                        <label style={labelStyle}>Transaction ID</label>
                        <Input
                            type="text"
                            value={transactionId}
                            onChange={e => setTransactionId(e.target.value)}
                            placeholder="Reference number"
                        />
                    </div>
                )}

                <div>
                    <label style={labelStyle}>Notes</label>
                    <Input
                        type="text"
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Optional notes"
                    />
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting || !amount} style={{ flex: 1 }}>
                        <CreditCard size={14} style={{ marginRight: '6px' }} />
                        {isSubmitting ? 'Recording...' : `Record Payment${amount ? ` (NPR ${parseFloat(amount || '0').toLocaleString()})` : ''}`}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
