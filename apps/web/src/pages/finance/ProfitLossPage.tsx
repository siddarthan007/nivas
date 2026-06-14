'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { RefreshCw, TrendingUp, TrendingDown, Download } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import CustomDatePicker from '@/components/ui/DatePicker';
import { SkeletonCard } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import { exportToCsv } from '@/lib/utils/export';
import { toast } from 'sonner';

interface PLLine { code: string; name: string; amount: number }
interface PLData {
    fromDate: string;
    toDate: string;
    revenue: PLLine[];
    expense: PLLine[];
    totalRevenue: number;
    totalExpense: number;
    netProfit: number;
}

const startOfYear = () => `${new Date().getFullYear()}-01-01`;
const today = () => new Date().toISOString().split('T')[0] || '';
const npr = (n: number) => `NPR ${Math.round(n).toLocaleString()}`;

export default function ProfitLossPage() {
    const [data, setData] = useState<PLData | null>(null);
    const [loading, setLoading] = useState(true);
    const [from, setFrom] = useState(startOfYear());
    const [to, setTo] = useState(today());

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<PLData>(`/finance/gl/profit-loss?from=${from}&to=${to}`);
            if (res.data) setData(res.data);
        } catch {
            toast.error('Failed to load P&L');
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [from, to]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleExport = () => {
        if (!data) return;
        exportToCsv(`profit-loss-${from}_${to}.csv`, [
            ['Profit & Loss', `${from} to ${to}`],
            [],
            ['REVENUE', ''],
            ...data.revenue.map(r => [r.name, r.amount.toFixed(2)]),
            ['Total Revenue', data.totalRevenue.toFixed(2)],
            [],
            ['EXPENSES', ''],
            ...data.expense.map(r => [r.name, r.amount.toFixed(2)]),
            ['Total Expenses', data.totalExpense.toFixed(2)],
            [],
            ['Net Profit', data.netProfit.toFixed(2)],
        ]);
        toast.success('P&L exported');
    };

    const Section = ({ title, color, lines, total }: { title: string; color: string; lines: PLLine[]; total: number }) => (
        <Card>
            <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--notion-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--notion-text)' }}>{title}</span>
                <span style={{ fontWeight: 700, fontSize: '16px', color }}>{npr(total)}</span>
            </div>
            <div style={{ padding: 'var(--space-2)' }}>
                {lines.length === 0 ? (
                    <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--notion-text-secondary)', fontSize: '13px' }}>No entries</div>
                ) : lines.map((l, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--notion-divider)' }}>
                        <span style={{ fontSize: '13px', color: 'var(--notion-text)' }}>{l.name}</span>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--notion-text)' }}>{npr(l.amount)}</span>
                    </div>
                ))}
            </div>
        </Card>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
                    <CustomDatePicker label="From" selected={new Date(from)} onChange={d => d && setFrom(d.toISOString().split('T')[0] || '')} maxDate={new Date(to)} fullWidth={false} />
                    <CustomDatePicker label="To" selected={new Date(to)} onChange={d => d && setTo(d.toISOString().split('T')[0] || '')} maxDate={new Date()} fullWidth={false} />
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <Button variant="secondary" onClick={fetchData} disabled={loading}><RefreshCw size={14} style={{ marginRight: '6px' }} /> Refresh</Button>
                    <Button variant="secondary" onClick={handleExport} disabled={!data}><Download size={14} style={{ marginRight: '6px' }} /> Export</Button>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                    <SkeletonCard />
                    <SkeletonCard />
                </div>
            ) : !data ? (
                <EmptyState
                    title="No profit & loss data"
                    description="No revenue or expense data available for the selected period."
                    action={<Button variant="secondary" onClick={fetchData}><RefreshCw size={14} style={{ marginRight: '6px' }} /> Refresh</Button>}
                />
            ) : (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
                        <Card><div style={{ padding: 'var(--space-4)' }}>
                            <div style={{ fontSize: '12px', color: 'var(--notion-text-muted)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><TrendingUp size={12} /> Revenue</div>
                            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--notion-green)' }}>{npr(data.totalRevenue)}</div>
                        </div></Card>
                        <Card><div style={{ padding: 'var(--space-4)' }}>
                            <div style={{ fontSize: '12px', color: 'var(--notion-text-muted)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><TrendingDown size={12} /> Expenses</div>
                            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--notion-red)' }}>{npr(data.totalExpense)}</div>
                        </div></Card>
                        <Card><div style={{ padding: 'var(--space-4)' }}>
                            <div style={{ fontSize: '12px', color: 'var(--notion-text-muted)', marginBottom: '4px' }}>Net Profit</div>
                            <div style={{ fontSize: '22px', fontWeight: 700, color: data.netProfit >= 0 ? 'var(--notion-green)' : 'var(--notion-red)' }}>{npr(data.netProfit)}</div>
                        </div></Card>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
                        <Section title="Revenue" color="var(--notion-green)" lines={data.revenue} total={data.totalRevenue} />
                        <Section title="Expenses" color="var(--notion-red)" lines={data.expense} total={data.totalExpense} />
                    </div>
                </>
            )}
        </div>
    );
}
