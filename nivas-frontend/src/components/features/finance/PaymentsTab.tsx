'use client';

import { useState, useMemo } from 'react';
import { DollarSign, XCircle, CreditCard, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import Button from '@/components/ui/Button';
import { SkeletonList } from '@/components/ui/Skeleton';
import type { Payment } from '@/lib/hooks/useFinance';

type SortField = 'date' | 'amount' | 'method';
type SortDir = 'asc' | 'desc';

const methodColors: Record<string, string> = {
    CASH: 'var(--notion-green)',
    CARD: 'var(--notion-blue)',
    ESEWA: 'var(--notion-green)',
    KHALTI: 'var(--notion-purple)',
    CONNECT_IPS: 'var(--notion-blue)',
    FONEPAY: 'var(--notion-orange)',
    BANK_TRANSFER: 'var(--notion-text)',
    OTHER: 'var(--notion-text-secondary)',
};

interface PaymentsTabProps {
    payments: Payment[];
    isLoading: boolean;
    onVoid: (payment: Payment) => void;
    onRecordPayment: () => void;
}

export default function PaymentsTab({ payments, isLoading, onVoid, onRecordPayment }: PaymentsTabProps) {
    const [search, setSearch] = useState('');
    const [methodFilter, setMethodFilter] = useState<string>('all');
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('desc');
        }
    };

    const methods = useMemo(() => {
        const set = new Set(payments.map(p => p.paymentMethod));
        return Array.from(set);
    }, [payments]);

    const filtered = useMemo(() => {
        let data = [...payments];

        if (search.trim()) {
            const q = search.toLowerCase();
            data = data.filter(p =>
                (p.transactionId || '').toLowerCase().includes(q) ||
                p.paymentMethod.toLowerCase().includes(q) ||
                (p.notes || '').toLowerCase().includes(q)
            );
        }

        if (methodFilter !== 'all') {
            data = data.filter(p => p.paymentMethod === methodFilter);
        }

        data.sort((a, b) => {
            let cmp = 0;
            if (sortField === 'date') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            else if (sortField === 'amount') cmp = (parseFloat(a.amount) || 0) - (parseFloat(b.amount) || 0);
            else if (sortField === 'method') cmp = a.paymentMethod.localeCompare(b.paymentMethod);
            return sortDir === 'asc' ? cmp : -cmp;
        });

        return data;
    }, [payments, search, methodFilter, sortField, sortDir]);

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown size={14} style={{ opacity: 0.4 }} />;
        return sortDir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
    };

    if (isLoading) return <SkeletonList items={6} />;

    if (payments.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--notion-text-secondary)', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)' }}>
                <CreditCard size={48} style={{ opacity: 0.3, marginBottom: 'var(--space-4)' }} />
                <p style={{ fontSize: '16px', fontWeight: '500', marginBottom: 'var(--space-2)' }}>No payments recorded</p>
                <p style={{ fontSize: '13px', marginBottom: 'var(--space-4)' }}>Record your first payment to start tracking revenue.</p>
                <Button onClick={onRecordPayment}>Record Payment</Button>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--notion-text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Search payments..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            width: '100%', padding: '7px 10px 7px 32px', borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--notion-border)', backgroundColor: 'var(--notion-bg)',
                            color: 'var(--notion-text)', fontSize: '13px', outline: 'none',
                        }}
                    />
                </div>
                <select
                    value={methodFilter}
                    onChange={e => setMethodFilter(e.target.value)}
                    style={{
                        padding: '7px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)',
                        backgroundColor: 'var(--notion-bg)', color: 'var(--notion-text)', fontSize: '13px', cursor: 'pointer',
                    }}
                >
                    <option value="all">All Methods</option>
                    {methods.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                </select>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                {filtered.length} of {payments.length} payments
                {filtered.length > 0 && (
                    <span style={{ marginLeft: '12px', fontWeight: 600 }}>
                        Total: NPR {filtered.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0).toLocaleString()}
                    </span>
                )}
            </div>

            {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--notion-text-secondary)' }}>
                    No payments match your filters
                </div>
            ) : (
                <div style={{ border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: 'var(--notion-bg-secondary)', borderBottom: '1px solid var(--notion-border)' }}>
                                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, color: 'var(--notion-text-secondary)' }}>
                                    <button onClick={() => toggleSort('method')} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Method <SortIcon field="method" />
                                    </button>
                                </th>
                                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 500, color: 'var(--notion-text-secondary)' }}>
                                    <button onClick={() => toggleSort('amount')} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginLeft: 'auto' }}>
                                        Amount <SortIcon field="amount" />
                                    </button>
                                </th>
                                <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--notion-text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reference</th>
                                <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--notion-text-secondary)' }}>
                                    <button onClick={() => toggleSort('date')} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Date <SortIcon field="date" />
                                    </button>
                                </th>
                                <th style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--notion-text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(payment => (
                                <tr key={payment.id} style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                    <td style={{ padding: '10px 14px' }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                            <DollarSign size={14} style={{ color: methodColors[payment.paymentMethod] || 'var(--notion-text)' }} />
                                            <span style={{ color: 'var(--notion-text)', fontWeight: 500 }}>{payment.paymentMethod.replace('_', ' ')}</span>
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--notion-green)' }}>
                                        +NPR {(parseFloat(payment.amount) || 0).toLocaleString()}
                                    </td>
                                    <td style={{ padding: '10px 14px', color: 'var(--notion-text-secondary)', fontSize: '13px' }}>
                                        {payment.transactionId || '—'}
                                    </td>
                                    <td style={{ padding: '10px 14px', color: 'var(--notion-text-secondary)', fontSize: '13px' }}>
                                        {new Date(payment.createdAt).toLocaleString()}
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                        <button
                                            onClick={() => onVoid(payment)}
                                            title="Void payment"
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--notion-red)', padding: '4px', borderRadius: 'var(--radius-sm)', display: 'inline-flex', alignItems: 'center' }}
                                            className="hover-bg"
                                        >
                                            <XCircle size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
