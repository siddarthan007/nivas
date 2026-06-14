'use client';

import { useEffect } from 'react';
import { TrendingUp, FileText, DollarSign, ArrowRight } from 'lucide-react';
import { useFinanceDashboard } from '@/lib/hooks/useFinance';
import { Skeleton, SkeletonList } from '@/components/ui/Skeleton';
import Button from '@/components/ui/Button';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface FinanceDashboardTabProps {
    onNavigate: (tab: string) => void;
}

const chartTooltipStyle = { background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: '8px', fontSize: '12px' } as const;
const chartAxisStyle = { fontSize: 11, fill: 'var(--notion-text-secondary)' };

export default function FinanceDashboardTab({ onNavigate }: FinanceDashboardTabProps) {
    const { summary, isLoading, fetchDashboardData } = useFinanceDashboard();

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    if (isLoading || !summary) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <Skeleton variant="card" height={120} />
                <SkeletonList items={3} />
            </div>
        );
    }

    const quickLinks = [
        { tab: 'invoices', label: 'Invoices', icon: FileText, value: summary.recentInvoices.length },
        { tab: 'payments', label: 'Payments', icon: DollarSign, value: summary.recentPayments.length },
        { tab: 'customer-ledger', label: 'Customer Ledger', icon: TrendingUp },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
                {[
                    { label: 'Revenue (30d)', value: `NPR ${summary.totalRevenueMtd.toLocaleString()}`, color: 'var(--notion-green)' },
                    { label: 'Accounts Receivable', value: `NPR ${summary.accountsReceivable.toLocaleString()}`, color: 'var(--notion-blue)' },
                    { label: 'Cash & Bank', value: `NPR ${summary.cashBankBalance.toLocaleString()}`, color: 'var(--notion-text)' },
                    { label: 'Accounts Payable', value: `NPR ${summary.accountsPayable.toLocaleString()}`, color: 'var(--notion-orange)' },
                ].map(stat => (
                    <div key={stat.label} style={{
                        padding: 'var(--space-4)',
                        backgroundColor: 'var(--notion-bg-secondary)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--notion-border)',
                    }}>
                        <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', marginBottom: '4px' }}>{stat.label}</div>
                        <div style={{ fontSize: '20px', fontWeight: '700', color: stat.color }}>{stat.value}</div>
                    </div>
                ))}
            </div>

            {summary.revenueTrend.length > 0 && (
                <div style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--notion-bg-secondary)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--notion-border)',
                    height: 280,
                }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: 'var(--space-3)', color: 'var(--notion-text)' }}>
                        Revenue trend
                    </div>
                    <ResponsiveContainer width="100%" height="85%">
                        <AreaChart data={summary.revenueTrend}>
                            <defs>
                                <linearGradient id="financeRevenueFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--notion-blue)" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="var(--notion-blue)" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--notion-border)" vertical={false} />
                            <XAxis dataKey="date" tick={chartAxisStyle} axisLine={false} tickLine={false} tickFormatter={(v) => {
                                const d = new Date(v);
                                return isNaN(d.getTime()) ? v : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            }} />
                            <YAxis tick={chartAxisStyle} axisLine={false} tickLine={false} tickFormatter={(v) => `NPR ${Number(v).toLocaleString()}`} />
                            <Tooltip
                                contentStyle={chartTooltipStyle}
                                formatter={(v: any) => [`NPR ${Number(v).toLocaleString()}`, 'Revenue']}
                                cursor={{ fill: 'var(--notion-bg-tertiary)' }}
                            />
                            <Area type="monotone" dataKey="revenue" stroke="var(--notion-blue)" strokeWidth={2} fill="url(#financeRevenueFill)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                {quickLinks.map(link => (
                    <Button key={link.tab} variant="secondary" onClick={() => onNavigate(link.tab)}>
                        <link.icon size={14} style={{ marginRight: '6px' }} />
                        {link.label}
                        {link.value != null && ` (${link.value})`}
                        <ArrowRight size={14} style={{ marginLeft: '6px' }} />
                    </Button>
                ))}
            </div>
        </div>
    );
}
