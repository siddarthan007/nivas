'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from '@/lib/router';
import { useFinance, type Invoice } from '@/lib/hooks/useFinance';
import api from '@/lib/api';
import { format, parseISO } from 'date-fns';
import DualDate from '@/components/ui/DualDate';
import {
    ChevronDown,
    ChevronUp,
    Calendar,
    ArrowLeft,
    FileSpreadsheet,
    Download,
    FileText,
    CreditCard,
    RotateCcw,
    User,
    Building2,
    Hash,
    Mail,
    Phone
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import DashboardLayout from '@/components/layout/DashboardLayout';

interface LedgerEntry {
    id: string;
    date: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
    type: 'invoice' | 'payment' | 'credit_note';
    reference: string;
    details?: Record<string, any>;
}

interface CustomerLedger {
    bookingId: string;
    customerName: string;
    customerPhone?: string;
    customerEmail?: string;
    totalDebit: number;
    totalCredit: number;
    balance: number;
    entries: LedgerEntry[];
}

interface LiveFolio {
    booking: any;
    charges: any[];
    payments: any[];
    orders: any[];
    summary: {
        folioTotal: number;
        ordersTotal: number;
        totalCharges: number;
        totalPayments: number;
        balance: number;
    };
}

interface InvoiceDetailData {
    invoice: Invoice & { lineItems: { description: string; quantity: number; rate: number; amount: number }[] };
    hotel: any;
    room: { number?: string; type?: string };
    lineItems: { description: string; quantity: number; rate: number; amount: number }[];
    totals: any;
}

function AccordionRow({ entry, index, invoices, invoiceDetails, onExpand }: {
    entry: LedgerEntry;
    index: number;
    invoices: Invoice[];
    invoiceDetails: Map<string, InvoiceDetailData>;
    onExpand: (invoiceId: string) => void;
}) {
    const [expanded, setExpanded] = useState(false);

    const typeConfig = {
        invoice: { label: 'Invoice', color: 'var(--notion-blue)', bg: 'var(--notion-blue-bg)' },
        payment: { label: 'Payment', color: 'var(--notion-green)', bg: 'var(--notion-green-bg)' },
        credit_note: { label: 'Credit Note', color: 'var(--notion-orange)', bg: 'var(--notion-orange-bg)' },
    };
    const cfg = typeConfig[entry.type];

    return (
        <div style={{ borderBottom: '1px solid var(--notion-border)' }}>
            <button
                onClick={() => setExpanded(!expanded)}
                style={{
                    width: '100%',
                    display: 'grid',
                    gridTemplateColumns: '48px 120px 1fr 100px 100px 100px 100px 40px',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '13px',
                    color: 'var(--notion-text)',
                }}
            >
                <span style={{ fontWeight: 600, color: 'var(--notion-text-secondary)' }}>{String(index + 1).padStart(2, '0')}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--notion-text-secondary)' }}>
                    <Calendar size={12} />
                    <DualDate date={entry.date} format="compact" />
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: cfg.bg,
                        color: cfg.color,
                        fontSize: '11px',
                        fontWeight: 600,
                    }}>
                        {cfg.label}
                    </span>
                    <span style={{ color: 'var(--notion-text)' }}>{entry.description}</span>
                </span>
                <span style={{ textAlign: 'right', color: entry.debit ? 'var(--notion-red)' : 'var(--notion-text-secondary)' }}>
                    {entry.debit ? `NPR ${entry.debit.toLocaleString()}` : '-'}
                </span>
                <span style={{ textAlign: 'right', color: entry.credit ? 'var(--notion-green)' : 'var(--notion-text-secondary)' }}>
                    {entry.credit ? `NPR ${entry.credit.toLocaleString()}` : '-'}
                </span>
                <span style={{ textAlign: 'right', fontWeight: 600, color: entry.balance > 0 ? 'var(--notion-red)' : 'var(--notion-green)' }}>
                    NPR {Math.abs(entry.balance).toLocaleString()}
                </span>
                <span style={{ textAlign: 'center' }}>
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </span>
            </button>

            {expanded && (
                <div style={{
                    padding: '16px 24px 16px 72px',
                    backgroundColor: 'var(--notion-bg-secondary)',
                    borderTop: '1px solid var(--notion-border)',
                    fontSize: '13px',
                }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                        <DetailItem icon={<Hash size={14} />} label="Reference" value={entry.reference || '—'} />
                        <DetailItem icon={<FileText size={14} />} label="Type" value={cfg.label} />
                        <DetailItem icon={<Calendar size={14} />} label="Date" value={<DualDate date={entry.date} format="full" />} />
                        {entry.debit > 0 && <DetailItem icon={<FileText size={14} />} label="Debit Amount" value={`NPR ${entry.debit.toLocaleString()}`} highlight="red" />}
                        {entry.credit > 0 && <DetailItem icon={<CreditCard size={14} />} label="Credit Amount" value={`NPR ${entry.credit.toLocaleString()}`} highlight="green" />}
                        <DetailItem icon={<RotateCcw size={14} />} label="Running Balance" value={`NPR ${Math.abs(entry.balance).toLocaleString()} ${entry.balance >= 0 ? 'Dr' : 'Cr'}`} />
                    </div>
                    {entry.type === 'invoice' && (
                        <InvoiceBreakdown entry={entry} invoices={invoices} invoiceDetails={invoiceDetails} onExpand={onExpand} />
                    )}
                </div>
            )}
        </div>
    );
}

function InvoiceBreakdown({ entry, invoices, invoiceDetails, onExpand }: {
    entry: LedgerEntry;
    invoices: Invoice[];
    invoiceDetails: Map<string, InvoiceDetailData>;
    onExpand: (invoiceId: string) => void;
}) {
    const detail = invoiceDetails.get(entry.id);
    const inv = invoices.find(i => i.id === entry.id);

    useEffect(() => {
        if (!detail && entry.type === 'invoice') {
            onExpand(entry.id);
        }
    }, [entry.id, entry.type, detail, onExpand]);

    if (!detail && !inv) {
        return (
            <div style={{ marginTop: '12px', padding: '10px', backgroundColor: 'var(--notion-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)' }}>
                <div style={{ fontSize: '12px', color: 'var(--notion-text-muted)' }}>Loading invoice details...</div>
            </div>
        );
    }

    const lineItems = detail?.lineItems || inv?.lineItems || [];
    const subTotal = parseFloat(inv?.subTotal || detail?.invoice?.subTotal || '0') || 0;
    const serviceCharge = parseFloat(inv?.serviceCharge || detail?.invoice?.serviceCharge || '0') || 0;
    const vat = parseFloat(inv?.vatAmount || detail?.invoice?.vatAmount || '0') || 0;
    const discount = parseFloat(inv?.discountAmount || detail?.invoice?.discountAmount || '0') || 0;
    const grandTotal = parseFloat(inv?.grandTotal || detail?.invoice?.grandTotal || '0') || 0;
    const guestPan = inv?.guestPan || detail?.invoice?.guestPan || '';
    const guestPhone = inv?.guestPhone || detail?.invoice?.guestPhone || '';
    const guestEmail = inv?.guestEmail || detail?.invoice?.guestEmail || '';
    const checkIn = inv?.checkIn || detail?.invoice?.checkIn;
    const checkOut = inv?.checkOut || detail?.invoice?.checkOut;
    const roomNumber = detail?.room?.number;

    return (
        <div style={{ marginTop: '12px', padding: '10px', backgroundColor: 'var(--notion-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--notion-text-secondary)', marginBottom: '8px' }}>Invoice Breakdown</div>
            {(guestPan || guestPhone || guestEmail) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '4px', fontSize: '11px', color: 'var(--notion-text-muted)', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--notion-border)' }}>
                    {guestPan && <span>PAN: {guestPan}</span>}
                    {guestPhone && <span>Phone: {guestPhone}</span>}
                    {guestEmail && <span>Email: {guestEmail}</span>}
                    {roomNumber && <span>Room: {roomNumber}</span>}
                    {checkIn && <span>Check-in: {new Date(checkIn).toLocaleDateString()}</span>}
                    {checkOut && <span>Check-out: {new Date(checkOut).toLocaleDateString()}</span>}
                </div>
            )}
            {lineItems.length > 0 ? (
                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', marginBottom: '8px' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--notion-border)', color: 'var(--notion-text-secondary)' }}>
                            <th style={{ textAlign: 'left', padding: '4px 0', fontWeight: 500 }}>Description</th>
                            <th style={{ textAlign: 'right', padding: '4px 0', fontWeight: 500 }}>Qty</th>
                            <th style={{ textAlign: 'right', padding: '4px 0', fontWeight: 500 }}>Rate</th>
                            <th style={{ textAlign: 'right', padding: '4px 0', fontWeight: 500 }}>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lineItems.map((item, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--notion-border-light)' }}>
                                <td style={{ padding: '4px 0', color: 'var(--notion-text)' }}>{item.description}</td>
                                <td style={{ padding: '4px 0', textAlign: 'right', color: 'var(--notion-text)' }}>{item.quantity}</td>
                                <td style={{ padding: '4px 0', textAlign: 'right', color: 'var(--notion-text)' }}>NPR {item.rate.toLocaleString()}</td>
                                <td style={{ padding: '4px 0', textAlign: 'right', color: 'var(--notion-text)', fontWeight: 500 }}>NPR {item.amount.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <div style={{ fontSize: '12px', color: 'var(--notion-text-muted)', marginBottom: '8px' }}>No line items available</div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12px', paddingTop: '6px', borderTop: '1px solid var(--notion-border)' }}>
                <span>Subtotal</span><span style={{ fontWeight: 500, textAlign: 'right' }}>NPR {subTotal.toLocaleString()}</span>
                {serviceCharge > 0 && <><span>Service Charge</span><span style={{ fontWeight: 500, textAlign: 'right' }}>NPR {serviceCharge.toLocaleString()}</span></>}
                <span>VAT</span><span style={{ fontWeight: 500, textAlign: 'right' }}>NPR {vat.toLocaleString()}</span>
                {discount > 0 && <><span>Discount</span><span style={{ fontWeight: 500, textAlign: 'right', color: 'var(--notion-green)' }}>-NPR {discount.toLocaleString()}</span></>}
                <span style={{ fontWeight: 700 }}>Grand Total</span><span style={{ fontWeight: 700, textAlign: 'right' }}>NPR {grandTotal.toLocaleString()}</span>
            </div>
        </div>
    );
}

function DetailItem({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: React.ReactNode; highlight?: 'red' | 'green' }) {
    const color = highlight === 'red' ? 'var(--notion-red)' : highlight === 'green' ? 'var(--notion-green)' : 'var(--notion-text)';
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--notion-text-secondary)' }}>{icon}</span>
            <div>
                <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)' }}>{label}</div>
                <div style={{ fontWeight: 500, color }}>{value}</div>
            </div>
        </div>
    );
}

export default function CustomerLedgerDetailPage() {
    const searchParams = useSearchParams();
    const bookingId = decodeURIComponent(searchParams.get('bookingId') || '');
    const guestId = decodeURIComponent(searchParams.get('guestId') || '');
    const { invoices, payments, creditNotes, isLoading, fetchInvoices, fetchPayments, fetchCreditNotes } = useFinance();
    const [filterType, setFilterType] = useState<'all' | 'invoice' | 'payment' | 'credit_note'>('all');
    const [invoiceDetails, setInvoiceDetails] = useState<Map<string, InvoiceDetailData>>(new Map());
    const [liveFolio, setLiveFolio] = useState<LiveFolio | null>(null);
    const [isFolioLoading, setIsFolioLoading] = useState(false);

    const fetchLiveFolio = useCallback(async () => {
        if (bookingId) {
            setIsFolioLoading(true);
            try {
                const res = await api.get<LiveFolio>(`/billing/bookings/${encodeURIComponent(bookingId)}/folio`);
                if (res.data) setLiveFolio(res.data);
            } catch {
                setLiveFolio(null);
            } finally {
                setIsFolioLoading(false);
            }
        } else if (guestId) {
            setIsFolioLoading(true);
            try {
                const res = await api.get<LiveFolio>(`/billing/customer/${encodeURIComponent(guestId)}/folio`);
                if (res.data) setLiveFolio(res.data);
            } catch {
                setLiveFolio(null);
            } finally {
                setIsFolioLoading(false);
            }
        }
    }, [bookingId, guestId]);

    useEffect(() => {
        fetchInvoices(200);
        fetchPayments(200);
        fetchCreditNotes(200);
        fetchLiveFolio();
    }, [fetchInvoices, fetchPayments, fetchCreditNotes, fetchLiveFolio]);

    const handleExpandInvoice = useCallback(async (invoiceId: string) => {
        if (invoiceDetails.has(invoiceId)) return;
        try {
            const res = await api.get<InvoiceDetailData>(`/invoices/${invoiceId}`);
            if (res.data) {
                setInvoiceDetails(prev => {
                    const next = new Map(prev);
                    next.set(invoiceId, res.data!);
                    return next;
                });
            }
        } catch (e) {
            // silently fail — fallback to list data
        }
    }, [invoiceDetails]);

    const ledger: CustomerLedger | null = useMemo(() => {
        if (!bookingId) return null;
        const map = new Map<string, CustomerLedger>();

        invoices.forEach(inv => {
            const bid = inv.bookingId || inv.id;
            if (!map.has(bid)) {
                map.set(bid, {
                    bookingId: bid,
                    customerName: inv.guestName || 'Unknown',
                    totalDebit: 0,
                    totalCredit: 0,
                    balance: 0,
                    entries: [],
                });
            }
            const ledger = map.get(bid)!;
            const amount = parseFloat(inv.grandTotal) || 0;
            ledger.totalDebit += amount;
            ledger.entries.push({
                id: inv.id,
                date: inv.createdAt,
                description: `Invoice ${inv.invoiceNumber}`,
                debit: amount,
                credit: 0,
                balance: 0,
                type: 'invoice',
                reference: inv.invoiceNumber,
            });
        });

        payments.forEach(pay => {
            const bid = pay.bookingId || pay.id;
            const name = invoices.find(i => i.bookingId === pay.bookingId)?.guestName || 'Payment';
            if (!map.has(bid)) {
                map.set(bid, {
                    bookingId: bid,
                    customerName: name,
                    totalDebit: 0,
                    totalCredit: 0,
                    balance: 0,
                    entries: [],
                });
            }
            const ledger = map.get(bid)!;
            const amount = parseFloat(pay.amount) || 0;
            ledger.totalCredit += amount;
            ledger.entries.push({
                id: pay.id,
                date: pay.createdAt,
                description: `Payment (${pay.paymentMethod})`,
                debit: 0,
                credit: amount,
                balance: 0,
                type: 'payment',
                reference: pay.transactionId || pay.id,
            });
        });

        creditNotes.forEach(cn => {
            const original = invoices.find(i => i.id === cn.originalInvoiceId);
            const bid = original?.bookingId || cn.originalInvoiceId;
            const name = original?.guestName || cn.originalInvoice?.guestName || 'Credit Note';
            if (!map.has(bid)) {
                map.set(bid, {
                    bookingId: bid,
                    customerName: name,
                    totalDebit: 0,
                    totalCredit: 0,
                    balance: 0,
                    entries: [],
                });
            }
            const ledger = map.get(bid)!;
            const amount = parseFloat(cn.amount) || 0;
            ledger.totalCredit += amount;
            ledger.entries.push({
                id: cn.id,
                date: cn.createdAt,
                description: `Credit Note ${cn.creditNoteNumber}`,
                debit: 0,
                credit: amount,
                balance: 0,
                type: 'credit_note',
                reference: cn.creditNoteNumber,
            });
        });

        const result = Array.from(map.values()).find(l => l.bookingId === bookingId);
        if (!result) return null;
        result.entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        let running = 0;
        result.entries.forEach(e => {
            running += e.debit - e.credit;
            e.balance = running;
        });
        result.balance = running;
        return result;
    }, [invoices, payments, creditNotes, bookingId]);

    const filteredEntries = useMemo(() => {
        if (!ledger) return [];
        if (filterType === 'all') return ledger.entries;
        return ledger.entries.filter(e => e.type === filterType);
    }, [ledger, filterType]);

    const exportToExcel = useCallback(() => {
        if (!ledger) return;
        const rows: string[][] = [];

        rows.push(['Nivas PMS - Customer Ledger Report']);
        rows.push(['Guest:', ledger.customerName]);
        rows.push(['Booking ID:', ledger.bookingId]);
        rows.push(['Total Debits:', `NPR ${ledger.totalDebit.toLocaleString()}`]);
        rows.push(['Total Credits:', `NPR ${ledger.totalCredit.toLocaleString()}`]);
        rows.push(['Closing Balance:', `NPR ${Math.abs(ledger.balance).toLocaleString()} ${ledger.balance >= 0 ? 'Dr' : 'Cr'}`]);
        rows.push([]);

        rows.push(['#', 'Date', 'Type', 'Description', 'Reference', 'Debit', 'Credit', 'Balance', 'PAN', 'Phone', 'Email', 'Check-in', 'Check-out', 'Room']);
        ledger.entries.forEach((entry, idx) => {
            const inv = entry.type === 'invoice' ? invoices.find(i => i.id === entry.id) : null;
            rows.push([
                String(idx + 1),
                new Date(entry.date).toLocaleDateString(),
                entry.type,
                entry.description,
                entry.reference || '',
                entry.debit ? entry.debit.toString() : '',
                entry.credit ? entry.credit.toString() : '',
                entry.balance.toString(),
                inv?.guestPan || '',
                inv?.guestPhone || '',
                inv?.guestEmail || '',
                inv?.checkIn ? new Date(inv.checkIn).toLocaleDateString() : '',
                inv?.checkOut ? new Date(inv.checkOut).toLocaleDateString() : '',
                inv?.booking?.guestName || '',
            ]);
        });
        rows.push([]);

        rows.push(['Invoice Line Items Detail']);
        rows.push(['Invoice #', 'Description', 'Qty', 'Rate', 'Amount']);
        ledger.entries.filter(e => e.type === 'invoice').forEach(entry => {
            const detail = invoiceDetails.get(entry.id);
            const items = detail?.lineItems || [];
            if (items.length === 0) {
                rows.push([entry.reference, 'No line items available', '', '', '']);
            } else {
                items.forEach(item => {
                    rows.push([entry.reference, item.description, String(item.quantity), item.rate.toString(), item.amount.toString()]);
                });
            }
        });

        const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ledger-${ledger.customerName.replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [ledger, invoices, invoiceDetails]);

    if (isLoading) {
        return (
            <DashboardLayout>
                <div className="page-center-column">
                    <div className="animate-spin loading-spinner" />
                </div>
            </DashboardLayout>
        );
    }

    if (!ledger && !liveFolio) {
        return (
            <DashboardLayout>
                <div style={{ padding: 'var(--space-8)', maxWidth: '1200px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--notion-text-secondary)' }}>
                        <User size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                        <h2>Customer not found</h2>
                        <p>No ledger data for {guestId ? `guest "${guestId.slice(0, 8)}..."` : `booking "${bookingId.slice(0, 8)}..."`}</p>
                        <Button variant="secondary" onClick={() => window.close()} style={{ marginTop: '16px' }}>
                            <ArrowLeft size={14} style={{ marginRight: '6px' }} /> Close Tab
                        </Button>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    const stats = ledger ? [
        { label: 'Total Debits', value: `NPR ${ledger.totalDebit.toLocaleString()}`, color: 'var(--notion-red)' },
        { label: 'Total Credits', value: `NPR ${ledger.totalCredit.toLocaleString()}`, color: 'var(--notion-green)' },
        { label: 'Balance', value: `NPR ${Math.abs(ledger.balance).toLocaleString()} ${ledger.balance >= 0 ? 'Dr' : 'Cr'}`, color: ledger.balance > 0 ? 'var(--notion-red)' : 'var(--notion-green)' },
        { label: 'Transactions', value: String(ledger.entries.length), color: 'var(--notion-text)' },
    ] : liveFolio ? [
        { label: 'Folio Charges', value: `NPR ${liveFolio.summary.folioTotal.toLocaleString()}`, color: 'var(--notion-red)' },
        { label: 'Orders', value: `NPR ${liveFolio.summary.ordersTotal.toLocaleString()}`, color: 'var(--notion-orange)' },
        { label: 'Payments', value: `NPR ${liveFolio.summary.totalPayments.toLocaleString()}`, color: 'var(--notion-green)' },
        { label: 'Balance', value: `NPR ${Math.abs(liveFolio.summary.balance).toLocaleString()} ${liveFolio.summary.balance >= 0 ? 'Dr' : 'Cr'}`, color: liveFolio.summary.balance > 0 ? 'var(--notion-red)' : 'var(--notion-green)' },
    ] : [];

    const displayName = ledger?.customerName || liveFolio?.booking?.guest?.fullName || liveFolio?.booking?.guest?.name || 'Guest';

    return (
        <DashboardLayout>
            <div style={{ padding: 'var(--space-8)', maxWidth: '1200px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '50%',
                                backgroundColor: 'var(--notion-blue)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', fontWeight: 700, fontSize: '18px'
                            }}>
                                {displayName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--notion-text)' }}>{displayName}</h1>
                                <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'flex', gap: 'var(--space-3)', marginTop: '4px' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Building2 size={12} /> Guest Ledger</span>
                                    {ledger && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Hash size={12} /> {ledger.entries.length} entries</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <Button variant="secondary" size="sm" onClick={exportToExcel} icon={<FileSpreadsheet size={14} />}>Export Excel</Button>
                        <Button variant="secondary" size="sm" onClick={() => window.close()} icon={<ArrowLeft size={14} />}>Close</Button>
                    </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                    {stats.map(s => (
                        <Card key={s.label}>
                            <div style={{ padding: 'var(--space-4)' }}>
                                <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', marginBottom: '4px' }}>{s.label}</div>
                                <div style={{ fontSize: '18px', fontWeight: 700, color: s.color }}>{s.value}</div>
                            </div>
                        </Card>
                    ))}
                </div>

                {/* Live Folio Balance */}
                {liveFolio && (
                    <div style={{ marginBottom: 'var(--space-6)' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--notion-text)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <RotateCcw size={14} />
                            Live Folio Balance
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
                            <Card><div style={{ padding: 'var(--space-3)' }}>
                                <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>Folio Charges</div>
                                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--notion-text)' }}>NPR {liveFolio.summary.folioTotal.toLocaleString()}</div>
                            </div></Card>
                            <Card><div style={{ padding: 'var(--space-3)' }}>
                                <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>Orders Total</div>
                                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--notion-text)' }}>NPR {liveFolio.summary.ordersTotal.toLocaleString()}</div>
                            </div></Card>
                            <Card><div style={{ padding: 'var(--space-3)' }}>
                                <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>Payments</div>
                                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--notion-green)' }}>NPR {liveFolio.summary.totalPayments.toLocaleString()}</div>
                            </div></Card>
                            <Card><div style={{ padding: 'var(--space-3)' }}>
                                <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>Balance Due</div>
                                <div style={{ fontSize: '16px', fontWeight: 700, color: liveFolio.summary.balance > 0 ? 'var(--notion-red)' : 'var(--notion-green)' }}>
                                    NPR {Math.abs(liveFolio.summary.balance).toLocaleString()} {liveFolio.summary.balance >= 0 ? 'Dr' : 'Cr'}
                                </div>
                            </div></Card>
                        </div>

                        {/* Recent live charges + orders */}
                        {(liveFolio.charges.length > 0 || liveFolio.orders.length > 0) && (
                            <div style={{ marginTop: 'var(--space-3)', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)', overflow: 'hidden' }}>
                                <div style={{ padding: '10px 16px', backgroundColor: 'var(--notion-bg-tertiary)', fontSize: '12px', fontWeight: 600, color: 'var(--notion-text-secondary)', borderBottom: '1px solid var(--notion-border)' }}>
                                    Recent Charges & Orders
                                </div>
                                {liveFolio.charges.map((charge: any) => (
                                    <div key={`c-${charge.id}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid var(--notion-border)', fontSize: '13px' }}>
                                        <span style={{ color: 'var(--notion-text)' }}>{charge.description} <span style={{ color: 'var(--notion-text-muted)', fontSize: '11px' }}>({charge.type})</span></span>
                                        <span style={{ color: 'var(--notion-red)', fontWeight: 500 }}>NPR {parseFloat(charge.amount || 0).toLocaleString()}</span>
                                    </div>
                                ))}
                                {liveFolio.orders.map((order: any) => (
                                    <div key={`o-${order.id}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid var(--notion-border)', fontSize: '13px' }}>
                                        <span style={{ color: 'var(--notion-text)' }}>Order #{order.orderNumber} <span style={{ color: 'var(--notion-text-muted)', fontSize: '11px' }}>({order.orderType})</span></span>
                                        <span style={{ color: 'var(--notion-red)', fontWeight: 500 }}>NPR {parseFloat(order.totalAmount || 0).toLocaleString()}</span>
                                    </div>
                                ))}
                                {liveFolio.payments.map((pay: any) => (
                                    <div key={`p-${pay.id}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid var(--notion-border)', fontSize: '13px' }}>
                                        <span style={{ color: 'var(--notion-text)' }}>Payment <span style={{ color: 'var(--notion-text-muted)', fontSize: '11px' }}>({pay.paymentMethod})</span></span>
                                        <span style={{ color: 'var(--notion-green)', fontWeight: 500 }}>NPR {parseFloat(pay.amount || 0).toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {ledger && (
                    <>
                        {/* Filters */}
                        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
                            {(['all', 'invoice', 'payment', 'credit_note'] as const).map(t => (
                                <button
                                    key={t}
                                    onClick={() => setFilterType(t)}
                                    style={{
                                        padding: '6px 14px',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid',
                                        borderColor: filterType === t ? 'var(--notion-border)' : 'transparent',
                                        backgroundColor: filterType === t ? 'var(--notion-bg-tertiary)' : 'transparent',
                                        color: filterType === t ? 'var(--notion-text)' : 'var(--notion-text-secondary)',
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                        fontWeight: filterType === t ? 600 : 400,
                                    }}
                                >
                                    {t === 'all' ? 'All Entries' : t === 'credit_note' ? 'Credit Notes' : t.charAt(0).toUpperCase() + t.slice(1) + 's'}
                                </button>
                            ))}
                        </div>

                        {/* Ledger Table */}
                        <Card>
                            <div style={{ overflowX: 'auto' }}>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '48px 120px 1fr 100px 100px 100px 100px 40px',
                                    gap: '8px',
                                    padding: '12px 16px',
                                    backgroundColor: 'var(--notion-bg-secondary)',
                                    borderBottom: '1px solid var(--notion-border)',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    color: 'var(--notion-text-secondary)',
                                }}>
                                    <span>#</span>
                                    <span>Date</span>
                                    <span>Description</span>
                                    <span style={{ textAlign: 'right' }}>Debit</span>
                                    <span style={{ textAlign: 'right' }}>Credit</span>
                                    <span style={{ textAlign: 'right' }}>Balance</span>
                                    <span></span>
                                </div>
                                <div>
                                    {filteredEntries.map((entry, idx) => (
                                        <AccordionRow key={entry.id} entry={entry} index={idx} invoices={invoices} invoiceDetails={invoiceDetails} onExpand={handleExpandInvoice} />
                                    ))}
                                    {filteredEntries.length === 0 && (
                                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--notion-text-secondary)', fontSize: '13px' }}>
                                            No entries match the selected filter.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>
                    </>
                )}

                {/* Footer summary */}
                <div style={{ marginTop: 'var(--space-6)', padding: 'var(--space-4)', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                        Generated on <DualDate date={new Date()} format="full" />
                    </div>
                    {ledger && (
                        <div style={{ fontSize: '15px', fontWeight: 700, color: ledger.balance > 0 ? 'var(--notion-red)' : 'var(--notion-green)' }}>
                            Closing Balance: NPR {Math.abs(ledger.balance).toLocaleString()} {ledger.balance >= 0 ? 'Dr' : 'Cr'}
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
