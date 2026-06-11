'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { RefreshCw, TrendingUp, TrendingDown, Scale } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { toast } from 'sonner';

interface BalanceItem {
    name: string;
    amount: number;
    category: 'asset' | 'liability' | 'equity';
}

export default function BalanceSheetPage() {
    const [items, setItems] = useState<BalanceItem[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.get<any>('/finance/gl/balance-sheet');
            const d = res.data || {};
            const mapped: BalanceItem[] = [
                ...(d.assets || []).map((a: any) => ({ name: a.name, amount: Number(a.amount) || 0, category: 'asset' as const })),
                ...(d.liabilities || []).map((a: any) => ({ name: a.name, amount: Number(a.amount) || 0, category: 'liability' as const })),
                ...(d.equity || []).map((a: any) => ({ name: a.name, amount: Number(a.amount) || 0, category: 'equity' as const })),
            ];
            setItems(mapped);
        } catch (err: any) {
            toast.error('Failed to load balance sheet data');
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const assets = items.filter(i => i.category === 'asset');
    const liabilities = items.filter(i => i.category === 'liability');
    const equity = items.filter(i => i.category === 'equity');

    const totalAssets = assets.reduce((s, i) => s + Math.abs(i.amount), 0);
    const totalLiabilities = liabilities.reduce((s, i) => s + Math.abs(i.amount), 0);
    const totalEquity = equity.reduce((s, i) => s + Math.abs(i.amount), 0);

    if (loading) {
        return <div className="page-center-column"><div className="animate-spin loading-spinner" /></div>;
    }

    const Section = ({ title, color, items, total }: { title: string; color: string; items: BalanceItem[]; total: number }) => (
        <Card>
            <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--notion-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }} />
                    <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--notion-text)' }}>{title}</span>
                </div>
                <span style={{ fontWeight: 700, fontSize: '16px', color }}>NPR {total.toLocaleString()}</span>
            </div>
            <div style={{ padding: 'var(--space-2)' }}>
                {items.length === 0 ? (
                    <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--notion-text-secondary)', fontSize: '13px' }}>No items</div>
                ) : (
                    items.map((item, i) => (
                        <div key={i} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderBottom: '1px solid var(--notion-divider)',
                        }}>
                            <span style={{ fontSize: '13px', color: 'var(--notion-text)' }}>{item.name}</span>
                            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--notion-text)' }}>NPR {Math.abs(item.amount).toLocaleString()}</span>
                        </div>
                    ))
                )}
            </div>
        </Card>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Assets, liabilities, and equity snapshot</p>
                <Button variant="secondary" onClick={fetchData}><RefreshCw size={14} style={{ marginRight: '6px' }} /> Refresh</Button>
            </div>

            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
                <Card><div style={{ padding: 'var(--space-4)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--notion-text-muted)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <TrendingUp size={12} /> Total Assets
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--notion-green)' }}>NPR {totalAssets.toLocaleString()}</div>
                </div></Card>
                <Card><div style={{ padding: 'var(--space-4)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--notion-text-muted)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <TrendingDown size={12} /> Total Liabilities
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--notion-red)' }}>NPR {totalLiabilities.toLocaleString()}</div>
                </div></Card>
                <Card><div style={{ padding: 'var(--space-4)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--notion-text-muted)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Scale size={12} /> Equity
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--notion-blue)' }}>NPR {totalEquity.toLocaleString()}</div>
                </div></Card>
                <Card><div style={{ padding: 'var(--space-4)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--notion-text-muted)', marginBottom: '4px' }}>Check</div>
                    <div style={{
                        fontSize: '22px',
                        fontWeight: 700,
                        color: Math.abs(totalAssets - totalLiabilities - totalEquity) < 1 ? 'var(--notion-green)' : 'var(--notion-red)',
                    }}>
                        {Math.abs(totalAssets - totalLiabilities - totalEquity) < 1 ? 'Balanced' : 'Unbalanced'}
                    </div>
                </div></Card>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
                <Section title="Assets" color="var(--notion-green)" items={assets} total={totalAssets} />
                <Section title="Liabilities" color="var(--notion-red)" items={liabilities} total={totalLiabilities} />
                <Section title="Equity" color="var(--notion-blue)" items={equity} total={totalEquity} />
            </div>
        </div>
    );
}
