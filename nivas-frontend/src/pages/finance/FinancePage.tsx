'use client';

import { useState, useEffect } from 'react';
import { useFinance } from '@/lib/hooks/useFinance';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import {
    Receipt,
    CreditCard,
    FileText,
    Clock,
    RefreshCw,
    Download,
    Plus,
    AlertTriangle,
    CheckCircle,
    XCircle,
    DollarSign,
    Moon,
} from 'lucide-react';
import NightAuditPanel from './NightAuditPage';
import type { Invoice, Payment, CreditNote, RecordPaymentPayload } from '@/lib/hooks/useFinance';

// Tab Navigation
function TabNav({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
    const tabs = [
        { id: 'invoices', label: 'Invoices', icon: FileText },
        { id: 'payments', label: 'Payments', icon: CreditCard },
        { id: 'credit-notes', label: 'Credit Notes', icon: XCircle },
        { id: 'shifts', label: 'Shifts', icon: Clock },
        { id: 'night-audit', label: 'Night Audit', icon: Moon },
        { id: 'exports', label: 'Exports', icon: Download },
    ];

    return (
        <div style={{
            display: 'flex',
            gap: 'var(--space-1)',
            borderBottom: '1px solid var(--notion-divider)',
            marginBottom: 'var(--space-6)',
        }}>
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        padding: 'var(--space-3) var(--space-4)',
                        fontSize: '14px',
                        fontWeight: activeTab === tab.id ? '600' : '400',
                        color: activeTab === tab.id ? 'var(--notion-text)' : 'var(--notion-text-secondary)',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderBottom: activeTab === tab.id ? '2px solid var(--notion-blue)' : '2px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 150ms ease',
                    }}
                >
                    <tab.icon size={16} />
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

// Invoice Card
function InvoiceCard({ invoice, onSync, onVoid }: { invoice: Invoice; onSync: () => void; onVoid: () => void }) {
    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--notion-border)',
            padding: 'var(--space-4)',
            opacity: invoice.isVoided ? 0.6 : 1,
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                <div>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--notion-text)' }}>
                        {invoice.invoiceNumber}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                        {invoice.booking?.guestName || invoice.guestName}
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--notion-green)' }}>
                        ₹{(parseFloat(invoice.grandTotal) || 0).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)' }}>
                        {new Date(invoice.createdAt).toLocaleDateString()}
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
                {invoice.isVoided && (
                    <span style={{
                        padding: '2px 8px',
                        fontSize: '11px',
                        fontWeight: '500',
                        backgroundColor: 'var(--notion-red-bg)',
                        color: 'var(--notion-red)',
                        borderRadius: 'var(--radius-sm)',
                    }}>
                        VOIDED
                    </span>
                )}
                <span style={{
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontWeight: '500',
                    backgroundColor: invoice.cbmsSynced ? 'var(--notion-green-bg)' : 'var(--notion-orange-bg)',
                    color: invoice.cbmsSynced ? 'var(--notion-green)' : 'var(--notion-orange)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                }}>
                    {invoice.cbmsSynced ? <CheckCircle size={10} /> : <AlertTriangle size={10} />}
                    {invoice.cbmsSynced ? 'CBMS Synced' : 'Pending Sync'}
                </span>
            </div>

            {!invoice.isVoided && (
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <Button size="sm" variant="secondary" onClick={() => window.open(`/api/v1/invoices/${invoice.id}/pdf`, '_blank')}>
                        <Download size={12} style={{ marginRight: '4px' }} />
                        PDF
                    </Button>
                    {!invoice.cbmsSynced && (
                        <Button size="sm" variant="secondary" onClick={onSync}>
                            <RefreshCw size={12} style={{ marginRight: '4px' }} />
                            Sync CBMS
                        </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={onVoid}>
                        <XCircle size={12} style={{ marginRight: '4px' }} />
                        Void
                    </Button>
                </div>
            )}
        </div>
    );
}

// Payment Card
function PaymentCard({ payment, onVoid }: { payment: Payment; onVoid: () => void }) {
    const methodColors: Record<string, string> = {
        CASH: 'var(--notion-green)',
        CARD: 'var(--notion-blue)',
        ESEWA: 'var(--notion-green)',
        KHALTI: 'var(--notion-purple)',
        UPI: 'var(--notion-orange)',
        BANK_TRANSFER: 'var(--notion-text)',
        OTHER: 'var(--notion-text-secondary)',
    };

    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--notion-border)',
            padding: 'var(--space-4)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--notion-bg-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <DollarSign size={20} style={{ color: methodColors[payment.paymentMethod] || 'var(--notion-text)' }} />
                </div>
                <div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--notion-text)' }}>
                        {payment.paymentMethod.replace('_', ' ')}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>
                        {new Date(payment.createdAt).toLocaleString()}
                    </div>
                </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--notion-green)' }}>
                        +₹{(parseFloat(payment.amount) || 0).toLocaleString()}
                    </div>
                    {payment.transactionId && (
                        <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)' }}>
                            Ref: {payment.transactionId}
                        </div>
                    )}
                </div>
                <Button size="sm" variant="ghost" onClick={onVoid} style={{ color: 'var(--notion-red)' }}>
                    <XCircle size={14} style={{ marginRight: '4px' }} />
                    Void
                </Button>
            </div>
        </div>
    );
}

// Record Payment Modal
function RecordPaymentModal({ isOpen, onClose, onSubmit }: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: RecordPaymentPayload) => Promise<boolean>;
}) {
    const [formData, setFormData] = useState<RecordPaymentPayload>({
        amount: 0,
        paymentMethod: 'CASH',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const success = await onSubmit(formData);
        setIsSubmitting(false);
        if (success) {
            setFormData({ amount: 0, paymentMethod: 'CASH' });
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Record Payment">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                        Amount (₹) *
                    </label>
                    <Input
                        type="number"
                        min={0}
                        value={formData.amount}
                        onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                        required
                    />
                </div>

                <div>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                        Payment Method *
                    </label>
                    <select
                        value={formData.paymentMethod}
                        onChange={e => setFormData({ ...formData, paymentMethod: e.target.value as any })}
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            fontSize: '14px',
                            border: '1px solid var(--notion-border)',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--notion-bg-secondary)',
                            color: 'var(--notion-text)',
                        }}
                    >
                        <option value="CASH">Cash</option>
                        <option value="CARD">Card</option>
                        <option value="ESEWA">eSewa</option>
                        <option value="KHALTI">Khalti</option>
                        <option value="UPI">UPI</option>
                        <option value="CONNECT_IPS">Connect IPS</option>
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                        <option value="OTHER">Other</option>
                    </select>
                </div>

                <div>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                        Transaction ID
                    </label>
                    <Input
                        type="text"
                        value={formData.transactionId || ''}
                        onChange={e => setFormData({ ...formData, transactionId: e.target.value })}
                        placeholder="For digital payments"
                    />
                </div>

                <div>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                        Notes
                    </label>
                    <Input
                        type="text"
                        value={formData.notes || ''}
                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Optional notes"
                    />
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting || formData.amount <= 0} style={{ flex: 1 }}>
                        {isSubmitting ? 'Recording...' : 'Record Payment'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

// Shift Panel
function ShiftPanel({ currentShift, onStart, onEnd, isLoading }: {
    currentShift: any;
    onStart: (startFloat: number) => void;
    onEnd: (endCashCount: number, notes?: string) => void;
    isLoading: boolean;
}) {
    const [startFloat, setStartFloat] = useState(0);
    const [endCashCount, setEndCashCount] = useState(0);
    const [notes, setNotes] = useState('');

    if (currentShift) {
        return (
            <div style={{
                backgroundColor: 'var(--notion-bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--notion-border)',
                padding: 'var(--space-6)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--notion-green-bg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <Clock size={24} style={{ color: 'var(--notion-green)' }} />
                    </div>
                    <div>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--notion-text)' }}>
                            Shift Active
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                            Started: {new Date(currentShift.startTime).toLocaleString()}
                        </div>
                    </div>
                </div>

                <div style={{ marginBottom: 'var(--space-4)' }}>
                    <div style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-2)' }}>
                        Starting Float: ₹{(parseFloat(currentShift.startFloat) || 0).toLocaleString()}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                    <Input
                        type="number"
                        min={0}
                        value={endCashCount}
                        onChange={e => setEndCashCount(parseFloat(e.target.value) || 0)}
                        placeholder="Count cash in drawer"
                    />
                </div>
                <Input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="End of shift notes (optional)"
                    style={{ marginBottom: 'var(--space-3)' }}
                />
                <Button onClick={() => onEnd(endCashCount, notes)} disabled={isLoading} style={{ width: '100%' }}>
                    End Shift & Count Cash
                </Button>
            </div>
        );
    }

    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--notion-border)',
            padding: 'var(--space-6)',
            textAlign: 'center',
        }}>
            <Clock size={48} style={{ color: 'var(--notion-text-secondary)', opacity: 0.5, marginBottom: 'var(--space-4)' }} />
            <div style={{ fontSize: '16px', fontWeight: '500', color: 'var(--notion-text)', marginBottom: 'var(--space-4)' }}>
                No Active Shift
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', marginBottom: 'var(--space-3)' }}>
                <Input
                    type="number"
                    min={0}
                    value={startFloat}
                    onChange={e => setStartFloat(parseFloat(e.target.value) || 0)}
                    placeholder="Starting float amount"
                    style={{ maxWidth: '200px' }}
                />
            </div>
            <Button onClick={() => onStart(startFloat)} disabled={isLoading}>
                Start Shift
            </Button>
        </div>
    );
}

// Exports Panel
function ExportsPanel({ onExportTally, onExportAnnex5, onRetryFailed }: {
    onExportTally: (date?: string, type?: 'sales' | 'purchase' | 'receipt') => void;
    onExportAnnex5: (date?: string, type?: 'sales' | 'purchase') => void;
    onRetryFailed: () => void;
}) {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
            {/* Tally Exports */}
            <div style={{
                backgroundColor: 'var(--notion-bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--notion-border)',
                padding: 'var(--space-4)',
            }}>
                <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--notion-text)', marginBottom: 'var(--space-3)' }}>
                    Tally Exports (XML)
                </div>
                <Input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    style={{ marginBottom: 'var(--space-3)' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <Button variant="secondary" onClick={() => onExportTally(date, 'sales')}>
                        <Download size={14} style={{ marginRight: '6px' }} />
                        Sales XML
                    </Button>
                    <Button variant="secondary" onClick={() => onExportTally(date, 'purchase')}>
                        <Download size={14} style={{ marginRight: '6px' }} />
                        Purchase XML
                    </Button>
                    <Button variant="secondary" onClick={() => onExportTally(date, 'receipt')}>
                        <Download size={14} style={{ marginRight: '6px' }} />
                        Receipt XML
                    </Button>
                </div>
            </div>

            {/* IRD Annex 5 */}
            <div style={{
                backgroundColor: 'var(--notion-bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--notion-border)',
                padding: 'var(--space-4)',
            }}>
                <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--notion-text)', marginBottom: 'var(--space-3)' }}>
                    IRD Annex 5 (CSV)
                </div>
                <Input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    style={{ marginBottom: 'var(--space-3)' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <Button variant="secondary" onClick={() => onExportAnnex5(date, 'sales')}>
                        <Download size={14} style={{ marginRight: '6px' }} />
                        Sales Register
                    </Button>
                    <Button variant="secondary" onClick={() => onExportAnnex5(date, 'purchase')}>
                        <Download size={14} style={{ marginRight: '6px' }} />
                        Purchase Register
                    </Button>
                </div>
            </div>

            {/* CBMS Retry */}
            <div style={{
                backgroundColor: 'var(--notion-bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--notion-border)',
                padding: 'var(--space-4)',
            }}>
                <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--notion-text)', marginBottom: 'var(--space-3)' }}>
                    CBMS Sync
                </div>
                <p style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)' }}>
                    Retry syncing all invoices that failed CBMS submission.
                </p>
                <Button variant="secondary" onClick={onRetryFailed}>
                    <RefreshCw size={14} style={{ marginRight: '6px' }} />
                    Retry Failed Syncs
                </Button>
            </div>
        </div>
    );
}

// Main Page
export default function FinancePage() {
    const {
        invoices,
        payments,
        creditNotes,
        currentShift,
        isLoading,
        fetchInvoices,
        fetchPayments,
        fetchCreditNotes,
        checkCurrentShift,
        syncInvoiceCbms,
        createCreditNote,
        recordPayment,
        voidPayment,
        startShift,
        endShift,
        exportTally,
        exportAnnex5,
        retryFailedCbms,
    } = useFinance();

    const [activeTab, setActiveTab] = useState('invoices');
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [voidInvoice, setVoidInvoice] = useState<Invoice | null>(null);
    const [voidReason, setVoidReason] = useState('');

    useEffect(() => {
        fetchInvoices();
        fetchPayments();
        fetchCreditNotes();
        checkCurrentShift();
    }, [fetchInvoices, fetchPayments, fetchCreditNotes, checkCurrentShift]);

    const handleVoidInvoice = async () => {
        if (!voidInvoice || !voidReason.trim()) return;
        await createCreditNote(voidInvoice.id, voidReason);
        setVoidInvoice(null);
        setVoidReason('');
    };

    const handleVoidPayment = async (payment: Payment) => {
        if (!confirm(`Void this ${(payment.paymentMethod || '').replace('_', ' ')} payment of ₹${(parseFloat(payment.amount) || 0).toLocaleString()}? This action cannot be undone.`)) return;
        await voidPayment(payment.id);
    };

    const stats = {
        totalInvoices: invoices.length,
        totalPayments: payments.reduce((sum, p) => sum + parseFloat(p.amount), 0),
        pendingSync: invoices.filter(i => !i.cbmsSynced && !i.isVoided).length,
        voidedCount: invoices.filter(i => i.isVoided).length,
    };

    return (
        <DashboardLayout>
            <div style={{ padding: 'var(--space-8)' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                    <div>
                        <h1 style={{
                            fontSize: '28px',
                            fontWeight: '600',
                            color: 'var(--notion-text)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-3)',
                        }}>
                            <Receipt size={28} />
                            Finance
                        </h1>
                        <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', marginTop: 'var(--space-1)' }}>
                            Manage invoices, payments, and accounting exports
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                        <Button variant="secondary" onClick={() => { fetchInvoices(); fetchPayments(); }} disabled={isLoading}>
                            <RefreshCw size={14} style={{ marginRight: '6px' }} />
                            Refresh
                        </Button>
                        <Button onClick={() => setIsPaymentModalOpen(true)}>
                            <Plus size={14} style={{ marginRight: '6px' }} />
                            Record Payment
                        </Button>
                    </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
                    {[
                        { label: 'Invoices', value: stats.totalInvoices, color: 'var(--notion-text)' },
                        { label: 'Revenue', value: `₹${(stats.totalPayments ?? 0).toLocaleString()}`, color: 'var(--notion-green)' },
                        { label: 'Pending Sync', value: stats.pendingSync, color: 'var(--notion-orange)' },
                        { label: 'Voided', value: stats.voidedCount, color: 'var(--notion-red)' },
                    ].map(stat => (
                        <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <span style={{ fontSize: '20px', fontWeight: '600', color: stat.color }}>{stat.value}</span>
                            <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>{stat.label}</span>
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

                {/* Tab Content */}
                {activeTab === 'invoices' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
                        {isLoading ? (
                            Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} style={{
                                    height: '160px',
                                    backgroundColor: 'var(--notion-bg-secondary)',
                                    borderRadius: 'var(--radius-lg)',
                                    animation: 'pulse 1.5s ease-in-out infinite',
                                }} />
                            ))
                        ) : invoices.length === 0 ? (
                            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-12)', color: 'var(--notion-text-secondary)' }}>
                                <FileText size={48} style={{ opacity: 0.3, marginBottom: 'var(--space-4)' }} />
                                <p>No invoices yet</p>
                            </div>
                        ) : (
                            invoices.map(invoice => (
                                <InvoiceCard
                                    key={invoice.id}
                                    invoice={invoice}
                                    onSync={() => syncInvoiceCbms(invoice.id)}
                                    onVoid={() => setVoidInvoice(invoice)}
                                />
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'payments' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        {payments.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: 'var(--space-12)',
                                color: 'var(--notion-text-secondary)',
                                backgroundColor: 'var(--notion-bg-secondary)',
                                borderRadius: 'var(--radius-lg)',
                                border: '1px solid var(--notion-border)',
                            }}>
                                <CreditCard size={48} style={{ opacity: 0.3, marginBottom: 'var(--space-4)' }} />
                                <p style={{ fontSize: '16px', fontWeight: '500', marginBottom: 'var(--space-2)' }}>No payments recorded</p>
                                <p style={{ fontSize: '13px', marginBottom: 'var(--space-4)' }}>Record your first payment to start tracking revenue.</p>
                                <Button onClick={() => setIsPaymentModalOpen(true)}>
                                    <Plus size={14} style={{ marginRight: '6px' }} />
                                    Record Payment
                                </Button>
                            </div>
                        ) : (
                            payments.map(payment => (
                                <PaymentCard
                                    key={payment.id}
                                    payment={payment}
                                    onVoid={() => handleVoidPayment(payment)}
                                />
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'credit-notes' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        {creditNotes.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: 'var(--space-12)',
                                color: 'var(--notion-text-secondary)',
                                backgroundColor: 'var(--notion-bg-secondary)',
                                borderRadius: 'var(--radius-lg)',
                                border: '1px solid var(--notion-border)',
                            }}>
                                <XCircle size={48} style={{ opacity: 0.3, marginBottom: 'var(--space-4)' }} />
                                <p style={{ fontSize: '16px', fontWeight: '500', marginBottom: 'var(--space-2)' }}>No credit notes</p>
                                <p style={{ fontSize: '13px' }}>Credit notes are created when invoices are voided. Go to the Invoices tab to void an invoice.</p>
                            </div>
                        ) : (
                            creditNotes.map(cn => (
                                <div key={cn.id} style={{
                                    backgroundColor: 'var(--notion-bg-secondary)',
                                    borderRadius: 'var(--radius-lg)',
                                    border: '1px solid var(--notion-border)',
                                    padding: 'var(--space-4)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                }}>
                                    <div>
                                        <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--notion-text)' }}>
                                            {cn.creditNoteNumber}
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>
                                            Void: {cn.originalInvoice?.invoiceNumber} - {cn.reason}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--notion-red)' }}>
                                            -₹{(parseFloat(cn.amount) || 0).toLocaleString()}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)' }}>
                                            {new Date(cn.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'shifts' && (
                    <ShiftPanel
                        currentShift={currentShift}
                        onStart={startShift}
                        onEnd={endShift}
                        isLoading={isLoading}
                    />
                )}

                {activeTab === 'night-audit' && (
                    <NightAuditPanel />
                )}

                {activeTab === 'exports' && (
                    <ExportsPanel
                        onExportTally={exportTally}
                        onExportAnnex5={exportAnnex5}
                        onRetryFailed={retryFailedCbms}
                    />
                )}
            </div>

            {/* Record Payment Modal */}
            <RecordPaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                onSubmit={recordPayment}
            />

            {/* Void Invoice Modal */}
            <Modal isOpen={!!voidInvoice} onClose={() => setVoidInvoice(null)} title="Void Invoice">
                <div style={{ marginBottom: 'var(--space-4)' }}>
                    <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)' }}>
                        This will create a credit note and void invoice <strong>{voidInvoice?.invoiceNumber}</strong>.
                    </p>
                </div>
                <div style={{ marginBottom: 'var(--space-4)' }}>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                        Reason for voiding *
                    </label>
                    <Input
                        type="text"
                        value={voidReason}
                        onChange={e => setVoidReason(e.target.value)}
                        placeholder="e.g., Guest cancellation, duplicate entry"
                        required
                    />
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <Button variant="secondary" onClick={() => setVoidInvoice(null)} style={{ flex: 1 }}>
                        Cancel
                    </Button>
                    <Button onClick={handleVoidInvoice} disabled={!voidReason.trim()} style={{ flex: 1 }}>
                        Void Invoice
                    </Button>
                </div>
            </Modal>
        </DashboardLayout>
    );
}
