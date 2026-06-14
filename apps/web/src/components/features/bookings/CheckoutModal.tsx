'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, Receipt, CreditCard, User, Bed, Calendar, Calculator, AlertCircle, RefreshCw, CheckCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { SkeletonList } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface PaymentInput {
    id: string;
    method: string;
    amount: string;
    transactionId: string;
    notes: string;
}

export interface CheckoutPreview {
    bookingId: string;
    guestName: string;
    guestId: string | null;
    roomNumber: string;
    roomType: string;
    checkIn: string;
    checkOut: string;
    charges: {
        roomCharges: number;
        foodBeverage: number;
        extras: number;
        subTotal: number;
        serviceCharge: number;
        vat: number;
        discount: number;
        grandTotal: number;
    };
    payments: {
        totalPaid: number;
        paymentList: Array<{
            id: string;
            method: string;
            amount: number;
            date: string;
        }>;
    };
    balanceDue: number;
    creditBalance?: number;
    billingSummary?: {
        creditBalance?: number;
    };
    itemized: Array<{
        description: string;
        category: 'ROOM' | 'F&B' | 'EXTRA';
        quantity: number;
        rate: number;
        amount: number;
        date: string;
    }>;
}

interface CheckoutModalProps {
    isOpen: boolean;
    bookingId: string | null;
    onClose: () => void;
    onPreview: (bookingId: string) => Promise<CheckoutPreview>;
    onCheckout: (bookingId: string, data: {
        payments: { method: string; amount: number; transactionId?: string; notes?: string }[];
        discount?: number;
        couponId?: number;
        guestPan?: string;
        payLater?: boolean;
        creditReason?: string;
    }) => Promise<any>;
}

const PAYMENT_METHODS = [
    { value: 'CASH', label: 'Cash' },
    { value: 'CARD', label: 'Card' },
    { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
    { value: 'FONEPAY', label: 'Fonepay' },
    { value: 'WALLET', label: 'Wallet' },
    { value: 'CREDIT', label: 'Credit / Pay Later' },
];

export default function CheckoutModal({ isOpen, bookingId, onClose, onPreview, onCheckout }: CheckoutModalProps) {
    const [preview, setPreview] = useState<CheckoutPreview | null>(null);
    const [loading, setLoading] = useState(false);
    const [payments, setPayments] = useState<PaymentInput[]>([]);
    const [discount, setDiscount] = useState('');
    const [couponCode, setCouponCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState<{ couponId: number; code: string } | null>(null);
    const [couponLoading, setCouponLoading] = useState(false);
    const [guestPan, setGuestPan] = useState('');
    const [payLater, setPayLater] = useState(false);
    const [creditReason, setCreditReason] = useState('');
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');
    const [amenities, setAmenities] = useState<{ id: number; name: string; price: number }[]>([]);
    const [amenityId, setAmenityId] = useState('');
    const [amenityQty, setAmenityQty] = useState('1');
    const [addingAmenity, setAddingAmenity] = useState(false);

    const loadPreview = useCallback(async () => {
        if (!bookingId || !isOpen) return;
        setLoading(true);
        setError('');
        try {
            const data = await onPreview(bookingId);
            setPreview(data);
            setPayments([]);
            setDiscount('');
            setCouponCode('');
            setAppliedCoupon(null);
            setGuestPan('');
            setPayLater(false);
            setCreditReason('');
        } catch (err: any) {
            setError(err?.message || 'Failed to load checkout preview');
        } finally {
            setLoading(false);
        }
    }, [bookingId, isOpen, onPreview]);

    useEffect(() => {
        if (isOpen && bookingId) {
            loadPreview();
            api.get<{ id: number; name: string; price: number }[]>('/amenities?active=true')
                .then(res => setAmenities((res.data || []).map(a => ({ id: a.id, name: a.name, price: Number(a.price) }))))
                .catch(() => setAmenities([]));
        }
    }, [isOpen, bookingId, loadPreview]);

    const addAmenityCharge = async () => {
        if (!bookingId || !amenityId) return;
        setAddingAmenity(true);
        try {
            await api.post('/amenities/charge', { bookingId, amenityId: Number(amenityId), quantity: Number(amenityQty) || 1 });
            const amen = amenities.find(a => a.id === Number(amenityId));
            toast.success(`${amen?.name || 'Charge'} added to folio`);
            setAmenityId('');
            setAmenityQty('1');
            await loadPreview(); // reflect the new charge in the bill
        } catch (e: any) {
            toast.error(e?.message || 'Failed to add charge');
        } finally {
            setAddingAmenity(false);
        }
    };

    const addPayment = () => {
        setPayments(prev => [...prev, {
            id: crypto.randomUUID(),
            method: 'CASH',
            amount: '',
            transactionId: '',
            notes: ''
        }]);
    };

    const removePayment = (id: string) => {
        setPayments(prev => prev.filter(p => p.id !== id));
    };

    const updatePayment = (id: string, field: keyof PaymentInput, value: string) => {
        setPayments(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const applyCoupon = async () => {
        const code = couponCode.trim();
        if (!code || !preview) return;
        setCouponLoading(true);
        try {
            const res = await api.post<{ couponId: number; code: string; discount: number }>(
                '/coupons/validate', { code, amount: preview.charges.grandTotal, scope: 'ROOM' }
            );
            if (res.data?.discount != null) {
                setDiscount(String(res.data.discount));
                setAppliedCoupon({ couponId: res.data.couponId, code: res.data.code });
                toast.success(`Coupon ${res.data.code} — NPR ${res.data.discount.toFixed(2)} off`);
            }
        } catch (e: any) {
            toast.error(e?.message || 'Invalid coupon');
            setAppliedCoupon(null);
        } finally {
            setCouponLoading(false);
        }
    };
    const removeCoupon = () => { setAppliedCoupon(null); setCouponCode(''); setDiscount(''); };

    const totalPaymentInput = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const discountAmt = parseFloat(discount) || 0;
    const creditBal = preview?.creditBalance || 0;
    const balanceAfterDiscount = Math.max(0, (preview?.balanceDue || 0) - discountAmt - creditBal);
    const remainingBalance = Math.max(0, balanceAfterDiscount - totalPaymentInput);

    const handleCheckout = async () => {
        if (!bookingId || !preview) return;
        if (remainingBalance > 0.01 && !payLater) {
            setError('Balance remains. Enable "Pay Later" to record as credit, or add more payment.');
            return;
        }
        setProcessing(true);
        setError('');
        try {
            const paymentData = payments
                .filter(p => parseFloat(p.amount) > 0)
                .map(p => ({
                    method: p.method,
                    amount: parseFloat(p.amount),
                    transactionId: p.transactionId || undefined,
                    notes: p.notes || undefined,
                }));
            await onCheckout(bookingId, {
                payments: paymentData,
                discount: discountAmt > 0 ? discountAmt : undefined,
                couponId: appliedCoupon?.couponId,
                guestPan: guestPan || undefined,
                payLater: payLater || remainingBalance > 0.01,
                creditReason: payLater ? creditReason || 'Guest opted to pay later' : undefined,
            });
            onClose();
        } catch (err: any) {
            setError(err?.message || 'Checkout failed');
        } finally {
            setProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
        }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{
                backgroundColor: 'var(--notion-bg)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--notion-border)',
                width: '100%',
                maxWidth: '720px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 'var(--space-4)',
                    borderBottom: '1px solid var(--notion-border)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <Receipt size={20} color="var(--notion-text)" />
                        <div>
                            <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--notion-text)' }}>Checkout</h2>
                            <p style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Guest bill & payment</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                        <X size={20} color="var(--notion-text-secondary)" />
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)' }}>
                    {loading ? (
                        <SkeletonList items={3} />
                    ) : error && !preview ? (
                        <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--notion-red)' }}>
                            <AlertCircle size={32} style={{ marginBottom: 'var(--space-3)' }} />
                            <p>{error}</p>
                        </div>
                    ) : preview ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                            {/* Guest Info */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                gap: 'var(--space-3)',
                                backgroundColor: 'var(--notion-bg-secondary)',
                                borderRadius: 'var(--radius-lg)',
                                padding: 'var(--space-4)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                    <User size={14} color="var(--notion-text-secondary)" />
                                    <span style={{ fontSize: '13px', color: 'var(--notion-text)' }}>
                                        <strong>{preview.guestName}</strong>
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                    <Bed size={14} color="var(--notion-text-secondary)" />
                                    <span style={{ fontSize: '13px', color: 'var(--notion-text)' }}>
                                        Room {preview.roomNumber} ({preview.roomType})
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                    <Calendar size={14} color="var(--notion-text-secondary)" />
                                    <span style={{ fontSize: '13px', color: 'var(--notion-text)' }}>
                                        {new Date(preview.checkIn).toLocaleDateString()} - {new Date(preview.checkOut).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>

                            {/* Itemized Bill */}
                            <div>
                                <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--notion-text)', marginBottom: 'var(--space-3)' }}>
                                    Bill Details
                                </h3>
                                <div style={{
                                    border: '1px solid var(--notion-border)',
                                    borderRadius: 'var(--radius-lg)',
                                    overflow: 'hidden',
                                }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                        <thead>
                                            <tr style={{ backgroundColor: 'var(--notion-bg-secondary)', borderBottom: '1px solid var(--notion-border)' }}>
                                                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>Item</th>
                                                <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>Qty</th>
                                                <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>Rate</th>
                                                <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {preview.itemized.map((item, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                                    <td style={{ padding: '8px 12px', color: 'var(--notion-text)' }}>
                                                        <span style={{
                                                            fontSize: '10px',
                                                            padding: '2px 6px',
                                                            borderRadius: 'var(--radius-sm)',
                                                            backgroundColor: item.category === 'ROOM' ? 'var(--notion-blue-bg)' : item.category === 'F&B' ? 'var(--notion-orange-bg)' : 'var(--notion-gray-bg)',
                                                            color: item.category === 'ROOM' ? 'var(--notion-blue)' : item.category === 'F&B' ? 'var(--notion-orange)' : 'var(--notion-text-secondary)',
                                                            fontWeight: '600',
                                                            marginRight: '6px',
                                                        }}>
                                                            {item.category}
                                                        </span>
                                                        {item.description}
                                                    </td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>{item.quantity}</td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--notion-text-secondary)' }}>NPR {item.rate.toLocaleString()}</td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '500', color: 'var(--notion-text)' }}>NPR {item.amount.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Add extra charge (amenity) to the folio */}
                            {amenities.length > 0 && (
                                <div>
                                    <label style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>
                                        Add Extra Charge
                                    </label>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <select
                                            value={amenityId}
                                            onChange={e => setAmenityId(e.target.value)}
                                            style={{ flex: 2, padding: '8px 10px', fontSize: '13px', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', background: 'var(--notion-bg)', color: 'var(--notion-text)' }}
                                        >
                                            <option value="">Select amenity / charge…</option>
                                            {amenities.map(a => <option key={a.id} value={a.id}>{a.name} — NPR {a.price.toFixed(2)}</option>)}
                                        </select>
                                        <Input type="number" min={1} value={amenityQty} onChange={e => setAmenityQty(e.target.value)} style={{ width: '70px' }} />
                                        <Button variant="secondary" onClick={addAmenityCharge} disabled={addingAmenity || !amenityId} style={{ whiteSpace: 'nowrap' }}>
                                            {addingAmenity ? '…' : 'Add'}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Bill Summary */}
                            <div style={{
                                backgroundColor: 'var(--notion-bg-secondary)',
                                borderRadius: 'var(--radius-lg)',
                                padding: 'var(--space-4)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 'var(--space-2)',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                    <span style={{ color: 'var(--notion-text-secondary)' }}>Room Charges</span>
                                    <span style={{ color: 'var(--notion-text)' }}>NPR {preview.charges.roomCharges.toLocaleString()}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                    <span style={{ color: 'var(--notion-text-secondary)' }}>Food & Beverage</span>
                                    <span style={{ color: 'var(--notion-text)' }}>NPR {preview.charges.foodBeverage.toLocaleString()}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                    <span style={{ color: 'var(--notion-text-secondary)' }}>Subtotal</span>
                                    <span style={{ color: 'var(--notion-text)' }}>NPR {preview.charges.subTotal.toLocaleString()}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                    <span style={{ color: 'var(--notion-text-secondary)' }}>Service Charge</span>
                                    <span style={{ color: 'var(--notion-text)' }}>NPR {preview.charges.serviceCharge.toLocaleString()}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                    <span style={{ color: 'var(--notion-text-secondary)' }}>VAT</span>
                                    <span style={{ color: 'var(--notion-text)' }}>NPR {preview.charges.vat.toLocaleString()}</span>
                                </div>
                                {discountAmt > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                        <span style={{ color: 'var(--notion-red)' }}>Discount</span>
                                        <span style={{ color: 'var(--notion-red)' }}>-NPR {discountAmt.toLocaleString()}</span>
                                    </div>
                                )}
                                <div style={{ borderTop: '1px solid var(--notion-border)', marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)', display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: '700' }}>
                                    <span style={{ color: 'var(--notion-text)' }}>Grand Total</span>
                                    <span style={{ color: 'var(--notion-text)' }}>NPR {preview.charges.grandTotal.toLocaleString()}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                    <span style={{ color: 'var(--notion-text-secondary)' }}>Already Paid</span>
                                    <span style={{ color: 'var(--notion-green)' }}>NPR {preview.payments.totalPaid.toLocaleString()}</span>
                                </div>
                                {creditBal > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                        <span style={{ color: 'var(--notion-text-secondary)' }}>Guest Credit</span>
                                        <span style={{ color: 'var(--notion-blue)' }}>-NPR {creditBal.toLocaleString()}</span>
                                    </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: '700' }}>
                                    <span style={{ color: 'var(--notion-text)' }}>Balance Due</span>
                                    <span style={{ color: remainingBalance > 0.01 ? 'var(--notion-orange)' : 'var(--notion-green)' }}>
                                        NPR {remainingBalance.toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {/* Existing Payments */}
                            {preview.payments.paymentList.length > 0 && (
                                <div>
                                    <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--notion-text)', marginBottom: 'var(--space-3)' }}>
                                        Previous Payments
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                        {preview.payments.paymentList.map(p => (
                                            <div key={p.id} style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: 'var(--space-3)',
                                                backgroundColor: 'var(--notion-bg-secondary)',
                                                borderRadius: 'var(--radius-md)',
                                                border: '1px solid var(--notion-border)',
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                    <CreditCard size={14} color="var(--notion-text-secondary)" />
                                                    <span style={{ fontSize: '13px', color: 'var(--notion-text)', fontWeight: '500' }}>{p.method.replace('_', ' ')}</span>
                                                    <span style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>{new Date(p.date).toLocaleDateString()}</span>
                                                </div>
                                                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--notion-green)' }}>NPR {p.amount.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* New Payments */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                                    <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--notion-text)' }}>
                                        Record Payment
                                    </h3>
                                    <Button size="sm" variant="secondary" onClick={addPayment}>
                                        <Plus size={14} style={{ marginRight: '4px' }} /> Add
                                    </Button>
                                </div>
                                {payments.length === 0 && (
                                    <p style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', fontStyle: 'italic' }}>
                                        No new payments. Click "Add" to record a payment.
                                    </p>
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                    {payments.map(p => (
                                        <div key={p.id} style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr 1fr auto',
                                            gap: 'var(--space-2)',
                                            alignItems: 'end',
                                            padding: 'var(--space-3)',
                                            backgroundColor: 'var(--notion-bg-secondary)',
                                            borderRadius: 'var(--radius-md)',
                                            border: '1px solid var(--notion-border)',
                                        }}>
                                            <div>
                                                <label style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>Method</label>
                                                <select
                                                    value={p.method}
                                                    onChange={e => updatePayment(p.id, 'method', e.target.value)}
                                                    style={{
                                                        width: '100%',
                                                        padding: '6px 10px',
                                                        borderRadius: 'var(--radius-md)',
                                                        border: '1px solid var(--notion-border)',
                                                        backgroundColor: 'var(--notion-bg)',
                                                        color: 'var(--notion-text)',
                                                        fontSize: '13px',
                                                    }}
                                                >
                                                    {PAYMENT_METHODS.map(m => (
                                                        <option key={m.value} value={m.value}>{m.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>Amount</label>
                                                <Input
                                                    type="number"
                                                    value={p.amount}
                                                    onChange={e => updatePayment(p.id, 'amount', e.target.value)}
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>Ref / TXN ID</label>
                                                <Input
                                                    value={p.transactionId}
                                                    onChange={e => updatePayment(p.id, 'transactionId', e.target.value)}
                                                    placeholder="Optional"
                                                />
                                            </div>
                                            <button
                                                onClick={() => removePayment(p.id)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    padding: '6px',
                                                    color: 'var(--notion-red)',
                                                }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Promo code */}
                            <div>
                                <label style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>
                                    Promo Code
                                </label>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <Input
                                        value={couponCode}
                                        onChange={e => setCouponCode(e.target.value.toUpperCase())}
                                        placeholder="Apply a coupon"
                                        disabled={!!appliedCoupon}
                                    />
                                    {appliedCoupon ? (
                                        <Button variant="secondary" onClick={removeCoupon} style={{ color: 'var(--notion-red)', whiteSpace: 'nowrap' }}>Remove</Button>
                                    ) : (
                                        <Button variant="secondary" onClick={applyCoupon} disabled={couponLoading || !couponCode.trim()} style={{ whiteSpace: 'nowrap' }}>{couponLoading ? '…' : 'Apply'}</Button>
                                    )}
                                </div>
                                {appliedCoupon && <div style={{ fontSize: '11px', color: 'var(--notion-green)', marginTop: '4px' }}>Coupon {appliedCoupon.code} applied</div>}
                            </div>

                            {/* Discount & PAN */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                <div>
                                    <label style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>
                                        Discount Amount
                                    </label>
                                    <Input
                                        type="number"
                                        value={discount}
                                        onChange={e => setDiscount(e.target.value)}
                                        placeholder="0.00"
                                        disabled={!!appliedCoupon}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>
                                        Guest PAN
                                    </label>
                                    <Input
                                        value={guestPan}
                                        onChange={e => setGuestPan(e.target.value)}
                                        placeholder="PAN Number"
                                    />
                                </div>
                            </div>

                            {/* Pay Later / Credit */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-3)',
                                padding: 'var(--space-3)',
                                backgroundColor: payLater ? 'var(--notion-orange-bg)' : 'var(--notion-bg-secondary)',
                                borderRadius: 'var(--radius-lg)',
                                border: `1px solid ${payLater ? 'var(--notion-orange)' : 'var(--notion-border)'}`,
                            }}>
                                <input
                                    type="checkbox"
                                    id="payLater"
                                    checked={payLater}
                                    onChange={e => setPayLater(e.target.checked)}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                                <div style={{ flex: 1 }}>
                                    <label htmlFor="payLater" style={{ fontSize: '14px', fontWeight: '600', color: 'var(--notion-text)', cursor: 'pointer' }}>
                                        Pay Later / Credit
                                    </label>
                                    <p style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', marginTop: '2px' }}>
                                        Record remaining balance as accounts receivable. Guest can pay later.
                                    </p>
                                </div>
                            </div>
                            {payLater && (
                                <div>
                                    <label style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>
                                        Credit Reason
                                    </label>
                                    <Input
                                        value={creditReason}
                                        onChange={e => setCreditReason(e.target.value)}
                                        placeholder="e.g., Corporate billing, Guest will pay tomorrow..."
                                    />
                                </div>
                            )}

                            {/* Error */}
                            {error && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-2)',
                                    padding: 'var(--space-3)',
                                    backgroundColor: 'var(--notion-red-bg)',
                                    borderRadius: 'var(--radius-md)',
                                    color: 'var(--notion-red)',
                                    fontSize: '13px',
                                }}>
                                    <AlertCircle size={16} />
                                    {error}
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>

                {/* Footer */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 'var(--space-4)',
                    borderTop: '1px solid var(--notion-border)',
                    gap: 'var(--space-3)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <Calculator size={16} color="var(--notion-text-secondary)" />
                        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--notion-text)' }}>
                            Balance: <span style={{ color: remainingBalance > 0.01 ? 'var(--notion-orange)' : 'var(--notion-green)' }}>
                                NPR {remainingBalance.toLocaleString()}
                            </span>
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                        <Button 
                            variant="secondary" 
                            onClick={onClose} 
                            disabled={processing}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '10px 20px',
                                borderRadius: 'var(--radius-md)',
                                fontWeight: '500',
                                transition: 'all 0.2s ease',
                            }}
                        >
                            <X size={16} />
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleCheckout}
                            disabled={processing || loading || !preview}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '10px 24px',
                                borderRadius: 'var(--radius-md)',
                                fontWeight: '600',
                                transition: 'all 0.2s ease',
                                boxShadow: remainingBalance <= 0.01 ? '0 4px 12px rgba(34, 197, 94, 0.3)' : '0 4px 12px rgba(249, 115, 22, 0.3)',
                            }}
                        >
                            {processing ? (
                                <>
                                    <RefreshCw size={16} className="animate-spin" />
                                    Processing...
                                </>
                            ) : payLater ? (
                                <>
                                    <CreditCard size={16} />
                                    Checkout with Credit
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={16} />
                                    Complete Checkout
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
