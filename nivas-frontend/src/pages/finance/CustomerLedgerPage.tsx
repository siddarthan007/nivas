'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Invoice, Payment, CreditNote } from '@/lib/hooks/useFinance';
import { Search, Calendar, ExternalLink, Eye, ArrowUpDown, ArrowUp, ArrowDown, Filter } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import DualDate from '@/components/ui/DualDate';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

interface LedgerEntry {
    id: string;
    date: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
    type: 'invoice' | 'payment' | 'credit_note';
    reference: string;
}

interface CustomerLedger {
    bookingId: string;
    customerName: string;
    customerPhone: string;
    totalDebit: number;
    totalCredit: number;
    balance: number;
    entries: LedgerEntry[];
}

interface CustomerLedgerPageProps {
    invoices: Invoice[];
    payments: Payment[];
    creditNotes: CreditNote[];
    isLoading: boolean;
}

export default function CustomerLedgerPage({ invoices, payments, creditNotes, isLoading }: CustomerLedgerPageProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [balanceFilter, setBalanceFilter] = useState<'all' | 'outstanding' | 'settled'>('all');
    const [sortBy, setSortBy] = useState<'name' | 'debits' | 'credits' | 'balance' | 'activity'>('name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    const sortByColumn = (field: 'name' | 'debits' | 'credits' | 'balance' | 'activity') => {
        if (sortBy === field) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
        else { setSortBy(field); setSortDir('asc'); }
    };
    const sortArrow = (field: string) => (sortBy === field ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

    // Deep link support: read pre-selected booking from FinancePage URL params
    useEffect(() => {
        const stored = localStorage.getItem('finance_selected_booking');
        if (stored) {
            setSelectedBookingId(stored);
            setDetailOpen(true);
            localStorage.removeItem('finance_selected_booking');
        }
    }, []);

    const ledgers: CustomerLedger[] = useMemo(() => {
        const map = new Map<string, CustomerLedger>();

        invoices.forEach(inv => {
            const bid = inv.bookingId || inv.id;
            if (!map.has(bid)) {
                map.set(bid, {
                    bookingId: bid,
                    customerName: inv.guestName || 'Unknown',
                    customerPhone: '',
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
            // The customer ledger is for GUEST/booking receivables only. Walk-in /
            // restaurant order payments (no bookingId) are direct F&B sales — skip
            // them so they don't pile up as a bogus "Payment" customer.
            if (!pay.bookingId) return;
            const bid = pay.bookingId;
            const name = invoices.find(i => i.bookingId === pay.bookingId)?.guestName || 'Guest';
            if (!map.has(bid)) {
                map.set(bid, {
                    bookingId: bid,
                    customerName: name,
                    customerPhone: '',
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
                    customerPhone: '',
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

        const result = Array.from(map.values());
        result.forEach(l => {
            l.entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            let running = 0;
            l.entries.forEach(e => {
                running += e.debit - e.credit;
                e.balance = running;
            });
            l.balance = running;
        });
        return result;
    }, [invoices, payments, creditNotes]);

    const filtered = useMemo(() => {
        let data = [...ledgers];

        // Search
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            data = data.filter(l => l.customerName.toLowerCase().includes(q));
        }

        // Balance filter
        if (balanceFilter === 'outstanding') data = data.filter(l => Math.abs(l.balance) > 0.01);
        if (balanceFilter === 'settled') data = data.filter(l => Math.abs(l.balance) <= 0.01);

        // Sort
        data.sort((a, b) => {
            let cmp = 0;
            if (sortBy === 'name') cmp = a.customerName.localeCompare(b.customerName);
            else if (sortBy === 'debits') cmp = a.totalDebit - b.totalDebit;
            else if (sortBy === 'credits') cmp = a.totalCredit - b.totalCredit;
            else if (sortBy === 'balance') cmp = a.balance - b.balance;
            else if (sortBy === 'activity') cmp = a.entries.length - b.entries.length;
            return sortDir === 'asc' ? cmp : -cmp;
        });

        return data;
    }, [ledgers, searchQuery, balanceFilter, sortBy, sortDir]);

    const activeLedger = selectedBookingId ? ledgers.find(l => l.bookingId === selectedBookingId) || null : null;

    const openDetail = (bookingId: string) => {
        setSelectedBookingId(bookingId);
        setDetailOpen(true);
    };

    const closeDetail = () => {
        setDetailOpen(false);
        setSelectedBookingId(null);
    };

    const openInNewTab = (bookingId: string) => {
        const url = `${window.location.origin}/hotel/finance/customer-ledger?bookingId=${encodeURIComponent(bookingId)}`;
        window.open(url, '_blank');
    };

    if (isLoading) {
        return <div className="page-center-column"><div className="animate-spin loading-spinner" /></div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <p style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Guest-wise transaction history and outstanding balances</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <div style={{ position: 'relative', width: '220px' }}>
                        <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--notion-text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Search customer..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%', padding: '6px 10px 6px 32px', borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--notion-border)', backgroundColor: 'var(--notion-bg)',
                                color: 'var(--notion-text)', fontSize: '13px', outline: 'none',
                            }}
                        />
                    </div>
                    <select
                        value={balanceFilter}
                        onChange={e => setBalanceFilter(e.target.value as any)}
                        style={{
                            padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)',
                            backgroundColor: 'var(--notion-bg)', color: 'var(--notion-text)', fontSize: '13px', cursor: 'pointer',
                        }}
                    >
                        <option value="all">All Balances</option>
                        <option value="outstanding">Outstanding</option>
                        <option value="settled">Settled</option>
                    </select>
                    <select
                        value={`${sortBy}-${sortDir}`}
                        onChange={e => {
                            const [field, dir] = e.target.value.split('-') as [any, 'asc' | 'desc'];
                            setSortBy(field);
                            setSortDir(dir);
                        }}
                        style={{
                            padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)',
                            backgroundColor: 'var(--notion-bg)', color: 'var(--notion-text)', fontSize: '13px', cursor: 'pointer',
                        }}
                    >
                        <option value="name-asc">Name A→Z</option>
                        <option value="name-desc">Name Z→A</option>
                        <option value="balance-desc">Highest Balance</option>
                        <option value="balance-asc">Lowest Balance</option>
                        <option value="activity-desc">Most Active</option>
                    </select>
                </div>
            </div>

            {/* Summary */}
            <div style={{ display: 'flex', gap: 'var(--space-6)', padding: 'var(--space-3)', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)' }}>
                <div>
                    <span style={{ fontSize: '11px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Customers</span>
                    <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--notion-text)' }}>{filtered.length}</div>
                </div>
                <div>
                    <span style={{ fontSize: '11px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Outstanding</span>
                    <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--notion-red)' }}>
                        NPR {filtered.filter(l => l.balance > 0).reduce((s, l) => s + l.balance, 0).toLocaleString()}
                    </div>
                </div>
                <div>
                    <span style={{ fontSize: '11px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Settled</span>
                    <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--notion-green)' }}>
                        NPR {filtered.filter(l => l.balance <= 0).reduce((s, l) => s + Math.abs(l.balance), 0).toLocaleString()}
                    </div>
                </div>
            </div>

            {/* Customer List Table */}
            <div style={{ border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ backgroundColor: 'var(--notion-bg-secondary)', borderBottom: '1px solid var(--notion-border)' }}>
                            <th onClick={() => sortByColumn('name')} style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--notion-text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', userSelect: 'none' }}>Guest{sortArrow('name')}</th>
                            <th onClick={() => sortByColumn('debits')} style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--notion-text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', userSelect: 'none' }}>Debits{sortArrow('debits')}</th>
                            <th onClick={() => sortByColumn('credits')} style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--notion-text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', userSelect: 'none' }}>Credits{sortArrow('credits')}</th>
                            <th onClick={() => sortByColumn('balance')} style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--notion-text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', userSelect: 'none' }}>Balance{sortArrow('balance')}</th>
                            <th onClick={() => sortByColumn('activity')} style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--notion-text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', userSelect: 'none' }}>Txns{sortArrow('activity')}</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--notion-text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(ledger => (
                            <tr key={ledger.bookingId} style={{ borderBottom: '1px solid var(--notion-border)', cursor: 'pointer' }} onClick={() => openDetail(ledger.bookingId)}>
                                <td style={{ padding: '12px 16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                        <div style={{
                                            width: '32px', height: '32px', borderRadius: '50%',
                                            backgroundColor: 'var(--notion-blue)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: 'white', fontWeight: 700, fontSize: '12px', flexShrink: 0,
                                        }}>
                                            {ledger.customerName.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, color: 'var(--notion-text)' }}>{ledger.customerName}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--notion-text-muted)', fontFamily: 'monospace' }}>{ledger.bookingId.slice(0, 8)}...</div>
                                        </div>
                                    </div>
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--notion-text)' }}>NPR {ledger.totalDebit.toLocaleString()}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--notion-text)' }}>NPR {ledger.totalCredit.toLocaleString()}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: ledger.balance > 0 ? 'var(--notion-red)' : 'var(--notion-green)' }}>
                                    NPR {Math.abs(ledger.balance).toLocaleString()}
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>{ledger.entries.length}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); openDetail(ledger.bookingId); }}
                                            title="View detail"
                                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--notion-text-secondary)', padding: '4px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center' }}
                                            className="hover-bg"
                                        >
                                            <Eye size={16} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); openInNewTab(ledger.bookingId); }}
                                            title="Open in new tab"
                                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--notion-text-secondary)', padding: '4px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center' }}
                                            className="hover-bg"
                                        >
                                            <ExternalLink size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Detail Modal */}
            <Modal
                isOpen={detailOpen && !!activeLedger}
                onClose={closeDetail}
                title={activeLedger ? `${activeLedger.customerName} — Ledger` : 'Customer Ledger'}
                size="xl"
            >
                {activeLedger && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    backgroundColor: 'var(--notion-blue)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--foreground-inverse)',
                                    fontWeight: 700,
                                    fontSize: '16px',
                                }}>
                                    {activeLedger.customerName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '16px' }}>{activeLedger.customerName}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>{activeLedger.entries.length} transactions</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--notion-text-muted)' }}>Balance</div>
                                    <div style={{
                                        fontSize: '20px',
                                        fontWeight: 700,
                                        color: activeLedger.balance > 0 ? 'var(--notion-red)' : 'var(--notion-green)',
                                    }}>
                                        NPR {Math.abs(activeLedger.balance).toLocaleString()}
                                    </div>
                                </div>
                                <Button variant="secondary" size="sm" onClick={() => openInNewTab(activeLedger.bookingId)}>
                                    <ExternalLink size={14} style={{ marginRight: '6px' }} />
                                    New Tab
                                </Button>
                            </div>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                                <thead style={{ backgroundColor: 'var(--notion-bg-secondary)', borderBottom: '1px solid var(--notion-border)', color: 'var(--notion-text-secondary)' }}>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 500 }}>Date</th>
                                        <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 500 }}>Reference</th>
                                        <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 500 }}>Description</th>
                                        <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 500 }}>Debit</th>
                                        <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 500 }}>Credit</th>
                                        <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 500 }}>Balance</th>
                                    </tr>
                                </thead>
                                <tbody style={{ borderTop: '1px solid var(--notion-border)' }}>
                                    {activeLedger.entries.map(entry => (
                                        <tr key={entry.id} style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                            <td style={{ padding: '12px 16px', color: 'var(--notion-text)' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Calendar size={12} style={{ color: 'var(--notion-text-muted)' }} />
                                                    <DualDate date={entry.date} format="compact" />
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px 16px', color: 'var(--notion-text)' }}>{entry.reference}</td>
                                            <td style={{ padding: '12px 16px', color: 'var(--notion-text)' }}>
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    padding: '2px 8px',
                                                    borderRadius: 'var(--radius-full)',
                                                    backgroundColor: entry.type === 'invoice' ? 'var(--notion-blue-bg)' : entry.type === 'payment' ? 'var(--notion-green-bg)' : 'var(--notion-orange-bg)',
                                                    color: entry.type === 'invoice' ? 'var(--notion-blue)' : entry.type === 'payment' ? 'var(--notion-green)' : 'var(--notion-orange)',
                                                    fontSize: '11px',
                                                    fontWeight: 600,
                                                }}>
                                                    {entry.type === 'invoice' ? 'Invoice' : entry.type === 'payment' ? 'Payment' : 'Credit'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--notion-text)' }}>{entry.debit ? `NPR ${entry.debit.toLocaleString()}` : '-'}</td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--notion-text)' }}>{entry.credit ? `NPR ${entry.credit.toLocaleString()}` : '-'}</td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: entry.balance > 0 ? 'var(--notion-red)' : 'var(--notion-green)' }}>
                                                NPR {Math.abs(entry.balance).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
