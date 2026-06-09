'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { CreditCard, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

const PAYMENT_METHODS = [
    { value: 'CASH', label: 'Cash' },
    { value: 'CARD', label: 'Card' },
    { value: 'ESEWA', label: 'eSewa' },
    { value: 'KHALTI', label: 'Khalti' },
    { value: 'CONNECT_IPS', label: 'ConnectIPS' },
    { value: 'FONEPAY', label: 'Fonepay' },
    { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
    { value: 'OTHER', label: 'Other' },
];

interface RecordPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    /** Pre-fill context */
    context?: {
        bookingId?: string;
        orderId?: string;
        guestName?: string;
        totalDue?: number;
        label?: string;
    };
}

export default function RecordPaymentModal({ isOpen, onClose, onSuccess, context }: RecordPaymentModalProps) {
    const [amount, setAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('CASH');
    const [transactionId, setTransactionId] = useState('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [payQr, setPayQr] = useState<{ imageUrl?: string; label?: string } | null>(null);
    const [payQrs, setPayQrs] = useState<Record<string, { imageUrl?: string; label?: string }>>({});

    useEffect(() => {
        if (!isOpen) return;
        api.get<any>('/settings/payment').then(r => {
            setPayQr(r.data?.paymentQr || null);
            setPayQrs(r.data?.paymentQrs || {});
        }).catch(() => {});
    }, [isOpen]);

    // Show the QR linked to the selected method; fall back to a generic one.
    const activeQr = (payQrs[paymentMethod]?.imageUrl ? payQrs[paymentMethod] : payQr) || null;

    const handleSubmit = async () => {
        const num = parseFloat(amount);
        if (!num || num <= 0) {
            toast.error('Enter a valid amount');
            return;
        }
        setIsSubmitting(true);
        try {
            await api.post('/finance/payments', {
                bookingId: context?.bookingId || undefined,
                orderId: context?.orderId || undefined,
                amount: num,
                paymentMethod,
                transactionId: transactionId || undefined,
                notes: notes || undefined,
            });
            toast.success('Payment recorded successfully');
            setAmount('');
            setTransactionId('');
            setNotes('');
            setPaymentMethod('CASH');
            onSuccess?.();
            onClose();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Failed to record payment');
        } finally {
            setIsSubmitting(false);
        }
    };

    const labelStyle = { fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' } as const;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Record Payment">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {/* Context Info */}
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
                            <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--notion-text)' }}>{context.label}</div>
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
                                    fontSize: '18px', fontWeight: '700',
                                    color: context.totalDue > 0 ? 'var(--notion-red)' : 'var(--notion-green)',
                                }}>
                                    Rs {context.totalDue.toLocaleString()}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <div>
                        <label style={labelStyle}>Amount *</label>
                        <Input
                            type="number"
                            value={amount}
                            onChange={(e: any) => setAmount(e.target.value)}
                            placeholder={context?.totalDue ? `Max Rs ${context.totalDue.toLocaleString()}` : '0.00'}
                        />
                        {context?.totalDue && (
                            <button
                                type="button"
                                onClick={() => setAmount(String(context.totalDue))}
                                style={{
                                    fontSize: '11px', color: 'var(--notion-blue)', background: 'none',
                                    border: 'none', cursor: 'pointer', marginTop: '4px', padding: 0,
                                }}
                            >
                                Pay full amount (Rs {context.totalDue.toLocaleString()})
                            </button>
                        )}
                    </div>
                    <div>
                        <label style={labelStyle}>Payment Method *</label>
                        <Select
                            value={paymentMethod}
                            onChange={(e: any) => setPaymentMethod(e.target.value)}
                            options={PAYMENT_METHODS}
                        />
                    </div>
                </div>

                {paymentMethod !== 'CASH' && (
                    <div>
                        {activeQr?.imageUrl && (
                            <div style={{ textAlign: 'center', marginBottom: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                                <img src={activeQr.imageUrl} alt="Scan to pay" style={{ height: 180, maxWidth: '100%', objectFit: 'contain' }} />
                                <div style={{ fontSize: 12, color: 'var(--notion-text-secondary)', marginTop: 6 }}>{activeQr.label || `Scan to pay (${paymentMethod})`}</div>
                            </div>
                        )}
                        <label style={labelStyle}>Transaction ID</label>
                        <Input
                            value={transactionId}
                            onChange={(e: any) => setTransactionId(e.target.value)}
                            placeholder="Reference number"
                        />
                    </div>
                )}

                <div>
                    <label style={labelStyle}>Notes</label>
                    <Input
                        value={notes}
                        onChange={(e: any) => setNotes(e.target.value)}
                        placeholder="Payment notes (optional)"
                    />
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                    <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || !amount} style={{ flex: 1 }}>
                        <CreditCard size={14} style={{ marginRight: '6px' }} />
                        {isSubmitting ? 'Recording...' : `Record Payment${amount ? ` (Rs ${parseFloat(amount || '0').toLocaleString()})` : ''}`}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
