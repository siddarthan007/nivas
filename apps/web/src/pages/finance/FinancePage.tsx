'use client';

import { useState, useEffect } from 'react';
import { useFinance } from '@/lib/hooks/useFinance';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useHotelPlan } from '@/lib/hooks/useHotelPlan';
import Modal from '@/components/ui/Modal';
import { usePasswordConfirm } from '@/components/ui/usePasswordConfirm';
import { usePermissions } from '@/lib/hooks/usePermissions';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { RefreshCw, Plus, Receipt } from 'lucide-react';
import type { Invoice, Payment } from '@/lib/hooks/useFinance';
import { computeNetPayments } from '@/lib/utils/finance';

// Sub-pages
import NightAuditPanel from './NightAuditPage';
import GLPage from './GLPage';
import CustomerLedgerPage from './CustomerLedgerPage';
import { CustomerLedgerDetailPanel } from './CustomerLedgerDetailPage';
import TransactionHistoryPage from './TransactionHistoryPage';
import BalanceSheetPage from './BalanceSheetPage';
import ProfitLossPage from './ProfitLossPage';

// Modular tab components
import FinanceSidebar from '@/components/features/finance/FinanceSidebar';
import FinanceDashboardTab from '@/components/features/finance/FinanceDashboardTab';
import InvoicesTab from '@/components/features/finance/InvoicesTab';
import PaymentsTab from '@/components/features/finance/PaymentsTab';
import CreditNotesTab from '@/components/features/finance/CreditNotesTab';
import CreditSettlementTab from '@/components/features/finance/CreditSettlementTab';
import ShiftsTab from '@/components/features/finance/ShiftsTab';
import ExportsTab from '@/components/features/finance/ExportsTab';
import RecordPaymentModal from '@/components/features/finance/RecordPaymentModal';

function getTabTitle(tab: string): string {
    const titles: Record<string, string> = {
        overview: 'Dashboard',
        'general-ledger': 'General Ledger',
        revenue: 'Revenue Analytics',
        invoices: 'Invoices',
        outstanding: 'Outstanding / Credit Settlement',
        payments: 'Payments',
        'credit-notes': 'Credit Notes',
        'customer-ledger': 'Customer Ledger',
        transactions: 'Transaction History',
        'profit-loss': 'Profit & Loss',
        'balance-sheet': 'Balance Sheet',
        shifts: 'Shifts',
        'night-audit': 'Night Audit',
        exports: 'Exports & Compliance',
    };
    return titles[tab] || 'Finance';
}

export default function FinancePage() {
    const { confirm: pwConfirm, modal: pwModal } = usePasswordConfirm();
    const { can } = usePermissions();
    const {
        invoices,
        payments,
        creditNotes,
        currentShift,
        isLoading,
        invoiceLimit,
        paymentLimit,
        creditNoteLimit,
        fetchInvoices,
        fetchPayments,
        fetchCreditNotes,
        checkCurrentShift,
        createCreditNote,
        recordPayment,
        voidPayment,
        startShift,
        endShift,
        exportTally,
        exportAnnex5,
    } = useFinance();

    const { impersonation, user } = useAuth();
    const { plan } = useHotelPlan();

    const showLicenseBanner = (() => {
        if (!user?.hotelId || user?.userType === 'SUPER_ADMIN') return false;
        const status = plan.licenseStatus;
        const days = plan.daysRemaining;
        if (status === 'EXPIRED' || plan.isTrialExpired) return true;
        if (status === 'TRIAL' && days !== null && days <= 7) return true;
        if (status === 'ACTIVE' && days !== null && days <= 30) return true;
        if (status === 'PAUSED') return true;
        return false;
    })();

    const topOffset = (impersonation.isImpersonating ? 50 : 0) + (showLicenseBanner ? 36 : 0);

    const [activeTab, setActiveTab] = useState('overview');
    const [ledgerGuestId, setLedgerGuestId] = useState<string | null>(null);
    const [ledgerBookingId, setLedgerBookingId] = useState<string | null>(null);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [voidInvoice, setVoidInvoice] = useState<Invoice | null>(null);
    const [voidReason, setVoidReason] = useState('');
    const [voidPaymentTarget, setVoidPaymentTarget] = useState<Payment | null>(null);

    // Deep link support: read ?tab= and ?bookingId= from URL on initial load
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tabFromUrl = params.get('tab');
        const bookingIdFromUrl = params.get('bookingId');
        const guestIdFromUrl = params.get('guestId');
        // Only accept known tabs — a bad/legacy deep link must not blank the page.
        const VALID_TABS = ['overview', 'invoices', 'payments', 'credit-notes', 'customer-ledger', 'shifts', 'exports', 'night-audit', 'general-ledger', 'outstanding', 'transactions', 'profit-loss', 'balance-sheet'];
        if (tabFromUrl && VALID_TABS.includes(tabFromUrl)) {
            setActiveTab(tabFromUrl);
        }
        if (guestIdFromUrl) setLedgerGuestId(guestIdFromUrl);
        if (bookingIdFromUrl) setLedgerBookingId(bookingIdFromUrl);
        if (bookingIdFromUrl) {
            // Store for CustomerLedgerPage to pick up via localStorage event
            localStorage.setItem('finance_selected_booking', bookingIdFromUrl);
        }
    }, []);

    const openLedgerDetail = (opts: { guestId?: string; bookingId?: string }) => {
        const params = new URLSearchParams(window.location.search);
        params.set('tab', 'customer-ledger');
        params.delete('guestId');
        params.delete('bookingId');
        if (opts.guestId) params.set('guestId', opts.guestId);
        else if (opts.bookingId) params.set('bookingId', opts.bookingId);
        window.history.replaceState({}, '', `/hotel/finance?${params.toString()}`);
        setActiveTab('customer-ledger');
        setLedgerGuestId(opts.guestId ?? null);
        setLedgerBookingId(opts.bookingId ?? null);
    };

    const closeLedgerDetail = () => {
        const params = new URLSearchParams(window.location.search);
        params.delete('guestId');
        params.delete('bookingId');
        params.set('tab', 'customer-ledger');
        window.history.replaceState({}, '', `/hotel/finance?${params.toString()}`);
        setLedgerGuestId(null);
        setLedgerBookingId(null);
    };

    useEffect(() => {
        fetchInvoices();
        fetchPayments();
        fetchCreditNotes();
        checkCurrentShift();
    }, [fetchInvoices, fetchPayments, fetchCreditNotes, checkCurrentShift]);

    const handleVoidInvoice = async () => {
        if (!voidInvoice || !voidReason.trim()) return;
        const pw = await pwConfirm('Void invoice', 'Re-enter your password to void this invoice via credit note.');
        if (!pw) return;
        await createCreditNote(voidInvoice.id, voidReason, pw);
        setVoidInvoice(null);
        setVoidReason('');
    };

    const handleVoidPayment = (payment: Payment) => {
        setVoidPaymentTarget(payment);
    };

    const confirmVoidPayment = async () => {
        if (!voidPaymentTarget) return;
        const pw = await pwConfirm('Void payment', 'Re-enter your password to void this payment.');
        if (!pw) return;
        await voidPayment(voidPaymentTarget.id, pw);
        setVoidPaymentTarget(null);
    };

    const paymentStats = computeNetPayments(payments);
    const stats = {
        totalInvoices: invoices.length,
        totalRevenue: invoices
            .filter(i => !i.isVoided)
            .reduce((sum, i) => sum + (parseFloat(i.grandTotal) || 0), 0),
        netPayments: paymentStats.netTotal,
        activePaymentCount: paymentStats.activeCount,
        reversalCount: paymentStats.reversalCount,
        voidedCount: invoices.filter(i => i.isVoided).length,
    };

    return (
        <>
            <style>{`
                @media (max-width: 900px) {
                    .finance-shell { flex-direction: column !important; }
                    .finance-shell-sidebar {
                        width: 100% !important;
                        height: auto !important;
                        max-height: none !important;
                        position: relative !important;
                        top: 0 !important;
                    }
                }
            `}</style>
            {pwModal}
            <div className="finance-shell" style={{ display: 'flex' }}>
                <div className="finance-shell-sidebar" style={{
                    width: '240px',
                    flexShrink: 0,
                    position: 'sticky',
                    top: `${topOffset}px`,
                    alignSelf: 'flex-start',
                    height: `calc(100vh - ${topOffset}px)`,
                    overflowY: 'auto',
                    zIndex: 30,
                }}>
                    <FinanceSidebar activeTab={activeTab} onTabChange={(tab) => {
                        setActiveTab(tab);
                        const params = new URLSearchParams(window.location.search);
                        params.set('tab', tab);
                        if (tab !== 'customer-ledger') {
                            params.delete('guestId');
                            params.delete('bookingId');
                            setLedgerGuestId(null);
                            setLedgerBookingId(null);
                        }
                        window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
                    }} />
                </div>

                <div style={{ flex: 1, padding: 'var(--space-6)', backgroundColor: 'var(--notion-bg)', minHeight: '100vh' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                        <div>
                            <h1 style={{
                                fontSize: '24px',
                                fontWeight: '700',
                                color: 'var(--notion-text)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-3)',
                            }}>
                                <Receipt size={24} />
                                {getTabTitle(activeTab)}
                            </h1>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                            {['overview', 'invoices', 'payments', 'credit-notes', 'customer-ledger', 'shifts', 'exports', 'night-audit'].includes(activeTab) && (
                                <Button variant="secondary" onClick={() => { fetchInvoices(); fetchPayments(); fetchCreditNotes(); checkCurrentShift(); }} disabled={isLoading}>
                                    <RefreshCw size={14} style={{ marginRight: '6px' }} />
                                    Refresh
                                </Button>
                            )}
                            {activeTab === 'payments' && can('finance:record_payment') && (
                                <Button onClick={() => setIsPaymentModalOpen(true)}>
                                    <Plus size={14} style={{ marginRight: '6px' }} />
                                    Record Payment
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Mini stats strip for Sales tabs */}
                    {['invoices', 'payments', 'credit-notes', 'customer-ledger'].includes(activeTab) && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
                            <div style={{ display: 'flex', gap: 'var(--space-6)', padding: 'var(--space-4)', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)', flexWrap: 'wrap' }}>
                                {activeTab === 'payments' ? (
                                    <>
                                        {[
                                            { label: 'Net Payments', value: `NPR ${(stats.netPayments ?? 0).toLocaleString()}`, color: 'var(--notion-green)' },
                                            { label: 'Active', value: stats.activePaymentCount, color: 'var(--notion-text)' },
                                            { label: 'Reversals', value: stats.reversalCount, color: 'var(--notion-red)' },
                                        ].map(stat => (
                                            <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                <span style={{ fontSize: '20px', fontWeight: '600', color: stat.color }}>{stat.value}</span>
                                                <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>{stat.label}</span>
                                            </div>
                                        ))}
                                    </>
                                ) : (
                                    [
                                        { label: 'Invoices', value: stats.totalInvoices, color: 'var(--notion-text)' },
                                        { label: 'Revenue', value: `NPR ${(stats.totalRevenue ?? 0).toLocaleString()}`, color: 'var(--notion-green)' },
                                        { label: 'Voided', value: stats.voidedCount, color: 'var(--notion-red)' },
                                    ].map(stat => (
                                        <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                            <span style={{ fontSize: '20px', fontWeight: '600', color: stat.color }}>{stat.value}</span>
                                            <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>{stat.label}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>
                                {activeTab === 'payments' && `Showing last ${paymentLimit} payments`}
                                {activeTab === 'invoices' && `Showing last ${invoiceLimit} invoices`}
                                {activeTab === 'credit-notes' && `Showing last ${creditNoteLimit} credit notes`}
                                {activeTab === 'customer-ledger' && 'Full transaction history with pagination'}
                            </div>
                        </div>
                    )}

                    {/* Tab Content */}
                    {activeTab === 'overview' && (
                        <FinanceDashboardTab onNavigate={setActiveTab} />
                    )}

                    {activeTab === 'general-ledger' && <GLPage />}
                    {activeTab === 'customer-ledger' && (ledgerGuestId || ledgerBookingId) ? (
                        <CustomerLedgerDetailPanel
                            guestId={ledgerGuestId || undefined}
                            bookingId={ledgerBookingId || undefined}
                            onBack={closeLedgerDetail}
                        />
                    ) : activeTab === 'customer-ledger' ? (
                        <CustomerLedgerPage
                            invoices={invoices}
                            payments={payments}
                            creditNotes={creditNotes}
                            isLoading={isLoading}
                            onOpenDetail={openLedgerDetail}
                        />
                    ) : null}
                    {activeTab === 'transactions' && <TransactionHistoryPage invoices={invoices} payments={payments} creditNotes={creditNotes} isLoading={isLoading} />}
                    {activeTab === 'profit-loss' && <ProfitLossPage />}
                    {activeTab === 'balance-sheet' && <BalanceSheetPage />}
                    {activeTab === 'night-audit' && <NightAuditPanel />}

                    {activeTab === 'invoices' && (
                        <InvoicesTab
                            invoices={invoices}
                            isLoading={isLoading}
                            onVoid={setVoidInvoice}
                        />
                    )}

                    {activeTab === 'outstanding' && (
                        <CreditSettlementTab invoices={invoices as any} onRecordPayment={recordPayment} />
                    )}

                    {activeTab === 'payments' && (
                        <PaymentsTab
                            payments={payments}
                            isLoading={isLoading}
                            onVoid={handleVoidPayment}
                            onRecordPayment={() => setIsPaymentModalOpen(true)}
                        />
                    )}

                    {activeTab === 'credit-notes' && (
                        <CreditNotesTab creditNotes={creditNotes} isLoading={isLoading} />
                    )}

                    {activeTab === 'shifts' && (
                        <ShiftsTab
                            currentShift={currentShift}
                            isLoading={isLoading}
                            onStart={startShift}
                            onEnd={endShift}
                        />
                    )}

                    {activeTab === 'exports' && (
                        <ExportsTab
                            onExportTally={exportTally}
                            onExportAnnex5={exportAnnex5}
                        />
                    )}
                </div>
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

            {/* Void Payment Modal */}
            <Modal isOpen={!!voidPaymentTarget} onClose={() => setVoidPaymentTarget(null)} title="Void Payment">
                <div style={{ marginBottom: 'var(--space-4)' }}>
                    <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)' }}>
                        Void this <strong>{(voidPaymentTarget?.paymentMethod || '').replace('_', ' ')}</strong> payment of <strong>NPR {(parseFloat(voidPaymentTarget?.amount || '0') || 0).toLocaleString()}</strong>?
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--notion-red)', marginTop: '8px' }}>
                        This action cannot be undone.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <Button variant="secondary" onClick={() => setVoidPaymentTarget(null)} style={{ flex: 1 }}>
                        Cancel
                    </Button>
                    <Button onClick={confirmVoidPayment} style={{ flex: 1, backgroundColor: 'var(--notion-red)', color: 'var(--foreground-inverse)' }}>
                        Void Payment
                    </Button>
                </div>
            </Modal>
        </>
    );
}
