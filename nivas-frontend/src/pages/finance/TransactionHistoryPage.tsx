'use client';

import { useState, useMemo, useEffect } from 'react';
import { api } from '@/lib/api';
import { Search, Filter, CreditCard, Receipt, ArrowDownLeft, ArrowUpRight, RefreshCw } from 'lucide-react';
import { format, parseISO, isWithinInterval, startOfDay } from 'date-fns';
import DualDate from '@/components/ui/DualDate';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import CustomDatePicker from '@/components/ui/DatePicker';

type TxType = 'all' | 'in' | 'out';
interface GlTxn { id: string; date: string; description: string; reference?: string; direction: 'in' | 'out'; amount: number }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function TransactionHistoryPage(_props: any) {
    const [searchQuery, setSearchQuery] = useState('');
    const [txType, setTxType] = useState<TxType>('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [rows, setRows] = useState<GlTxn[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Single source of truth = the GL cash ledger. Captures EVERY money movement —
    // guest payments, F&B orders, supplier payments, expenses, refunds.
    const load = async () => {
        setIsLoading(true);
        try {
            const qs = [dateFrom && `from=${dateFrom}`, dateTo && `to=${dateTo}`].filter(Boolean).join('&');
            const res = await api.get<GlTxn[]>(`/gl/cash-transactions${qs ? `?${qs}` : ''}`);
            setRows(res.data || []);
        } catch { setRows([]); } finally { setIsLoading(false); }
    };
    useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [dateFrom, dateTo]);

    const transactions = useMemo(() => rows.map(t => ({
        id: t.id, date: t.date, type: t.direction as TxType,
        description: t.description, amount: Number(t.amount) || 0,
        direction: t.direction, status: 'Posted', reference: t.reference || '',
        method: undefined as string | undefined,
    })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [rows]);

    const filtered = useMemo(() => {
        let result = transactions;
        if (txType !== 'all') result = result.filter(t => t.direction === txType);
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(t =>
                t.description.toLowerCase().includes(q) ||
                t.reference.toLowerCase().includes(q)
            );
        }
        if (dateFrom || dateTo) {
            const from = dateFrom ? startOfDay(new Date(dateFrom)) : new Date(0);
            const to = dateTo ? startOfDay(new Date(dateTo)) : new Date(8640000000000000);
            result = result.filter(t => isWithinInterval(startOfDay(new Date(t.date)), { start: from, end: to }));
        }
        return result;
    }, [transactions, txType, searchQuery, dateFrom, dateTo]);

    const totals = useMemo(() => {
        const inflow = filtered.filter(t => t.direction === 'in').reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const outflow = filtered.filter(t => t.direction === 'out').reduce((s, t) => s + (Number(t.amount) || 0), 0);
        return { inflow, outflow, net: inflow - outflow };
    }, [filtered]);

    if (isLoading) {
        return <div className="page-center-column"><div className="animate-spin loading-spinner" /></div>;
    }

    const typeBadge = (type: string) => {
        const config: Record<string, { bg: string; color: string; label: string }> = {
            in: { bg: 'rgba(0,128,0,0.1)', color: 'var(--notion-green)', label: 'Money in' },
            out: { bg: 'rgba(217,49,13,0.1)', color: 'var(--notion-red)', label: 'Money out' },
        };
        const c = config[type] || config.in;
        return (
            <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: c!.bg,
                color: c!.color,
                fontSize: '11px',
                fontWeight: 600,
            }}>
                {type === 'in' ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
                {c!.label}
            </span>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <p style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>All financial transactions with filters</p>
                </div>
                <Button variant="secondary" onClick={() => window.location.reload()}>
                    <RefreshCw size={14} style={{ marginRight: '6px' }} /> Refresh
                </Button>
            </div>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
                <Card><div style={{ padding: 'var(--space-4)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--notion-text-muted)', marginBottom: '4px' }}>Inflow</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--notion-green)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ArrowDownLeft size={18} /> NPR {totals.inflow.toLocaleString()}
                    </div>
                </div></Card>
                <Card><div style={{ padding: 'var(--space-4)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--notion-text-muted)', marginBottom: '4px' }}>Outflow</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--notion-red)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ArrowUpRight size={18} /> NPR {totals.outflow.toLocaleString()}
                    </div>
                </div></Card>
                <Card><div style={{ padding: 'var(--space-4)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--notion-text-muted)', marginBottom: '4px' }}>Net</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: totals.net >= 0 ? 'var(--notion-green)' : 'var(--notion-red)' }}>
                        NPR {Math.abs(totals.net).toLocaleString()}
                    </div>
                </div></Card>
            </div>

            {/* Filters */}
            <div style={{
                display: 'flex',
                gap: 'var(--space-3)',
                alignItems: 'center',
                flexWrap: 'wrap',
                padding: 'var(--space-3)',
                backgroundColor: 'var(--notion-bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--notion-border)',
            }}>
                <div style={{ position: 'relative', minWidth: '220px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--notion-text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Search transactions..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '6px 10px 6px 32px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--notion-border)',
                            backgroundColor: 'var(--notion-bg)',
                            color: 'var(--notion-text)',
                            fontSize: '13px',
                            outline: 'none',
                        }}
                    />
                </div>
                <select
                    value={txType}
                    onChange={e => setTxType(e.target.value as TxType)}
                    style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--notion-border)',
                        backgroundColor: 'var(--notion-bg)',
                        color: 'var(--notion-text)',
                        fontSize: '13px',
                    }}
                >
                    <option value="all">All</option>
                    <option value="in">Money in</option>
                    <option value="out">Money out</option>
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <CustomDatePicker
                        selected={dateFrom ? new Date(dateFrom) : null}
                        onChange={d => setDateFrom(d ? (d.toISOString().split('T')[0] || '') : '')}
                        placeholder="From"
                        fullWidth={false}
                    />
                    <span style={{ color: 'var(--notion-text-muted)', fontSize: '13px' }}>to</span>
                    <CustomDatePicker
                        selected={dateTo ? new Date(dateTo) : null}
                        onChange={d => setDateTo(d ? (d.toISOString().split('T')[0] || '') : '')}
                        placeholder="To"
                        fullWidth={false}
                    />
                </div>
                {(searchQuery || txType !== 'all' || dateFrom || dateTo) && (
                    <button
                        onClick={() => { setSearchQuery(''); setTxType('all'); setDateFrom(''); setDateTo(''); }}
                        style={{ fontSize: '12px', color: 'var(--notion-blue)', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                        Clear all
                    </button>
                )}
            </div>

            {/* Table */}
            <Card>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--notion-divider)', backgroundColor: 'var(--notion-bg-secondary)' }}>
                                <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--notion-text-secondary)', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase' }}>Date</th>
                                <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--notion-text-secondary)', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase' }}>Type</th>
                                <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--notion-text-secondary)', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase' }}>Reference</th>
                                <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--notion-text-secondary)', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase' }}>Description</th>
                                <th style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--notion-text-secondary)', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase' }}>Amount</th>
                                <th style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--notion-text-secondary)', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>No transactions found</td></tr>
                            ) : (
                                filtered.map(tx => (
                                    <tr key={tx.id} style={{ borderBottom: '1px solid var(--notion-divider)' }}>
                                        <td style={{ padding: '8px 14px', color: 'var(--notion-text)' }}><DualDate date={tx.date} format="compact" /></td>
                                        <td style={{ padding: '8px 14px' }}>{typeBadge(tx.type)}</td>
                                        <td style={{ padding: '8px 14px', color: 'var(--notion-text)', fontFamily: 'monospace', fontSize: '12px' }}>{tx.reference}</td>
                                        <td style={{ padding: '8px 14px', color: 'var(--notion-text)' }}>{tx.description}{tx.method ? ` — ${tx.method}` : ''}</td>
                                        <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: tx.direction === 'in' ? 'var(--notion-green)' : 'var(--notion-red)' }}>
                                            {tx.direction === 'in' ? '+' : '-'}NPR {tx.amount.toLocaleString()}
                                        </td>
                                        <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                                            <span style={{
                                                fontSize: '11px',
                                                padding: '2px 6px',
                                                borderRadius: 'var(--radius-sm)',
                                                backgroundColor: tx.status === 'Completed' || tx.status === 'Synced' ? 'rgba(0,128,0,0.1)' : tx.status === 'Voided' ? 'rgba(224,62,62,0.1)' : 'rgba(107,114,128,0.1)',
                                                color: tx.status === 'Completed' || tx.status === 'Synced' ? 'var(--notion-green)' : tx.status === 'Voided' ? 'var(--notion-red)' : 'var(--notion-text-muted)',
                                            }}>{tx.status}</span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
