'use client';

import { useEffect } from 'react';
import { BarChart3, Building2, DollarSign, FileText, CreditCard, BookOpen, TrendingUp } from 'lucide-react';
import Button from '@/components/ui/Button';
import { SkeletonList, SkeletonCard } from '@/components/ui/Skeleton';
import { useFinanceDashboard } from '@/lib/hooks/useFinance';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface FinanceDashboardTabProps {
    onNavigate: (tab: string) => void;
}

export default function FinanceDashboardTab({ onNavigate }: FinanceDashboardTabProps) {
    const { summary, isLoading, fetchDashboardData } = useFinanceDashboard();

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    if (isLoading || !summary) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                <SkeletonList items={1} />
                <SkeletonCard />
            </div>
        );
    }

    const formatCurrency = (val: number) => {
        if (val >= 100000) return `Rs ${(val / 100000).toFixed(1)}L`;
        if (val >= 1000) return `Rs ${(val / 1000).toFixed(1)}K`;
        return `Rs ${val.toFixed(0)}`;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            {/* Key Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
                <div style={{ backgroundColor: 'var(--notion-bg-secondary)', padding: 'var(--space-5)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                        <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', fontWeight: '500' }}>Total Revenue (MTD)</span>
                        <BarChart3 size={16} color="var(--notion-green)" />
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--notion-text)' }}>
                        {formatCurrency(summary.totalRevenueMtd)}
                    </div>
                </div>
                <div style={{ backgroundColor: 'var(--notion-bg-secondary)', padding: 'var(--space-5)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                        <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', fontWeight: '500' }}>Accounts Receivable</span>
                        <Building2 size={16} color="var(--notion-blue)" />
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--notion-text)' }}>
                        {formatCurrency(summary.accountsReceivable)}
                    </div>
                </div>
                <div style={{ backgroundColor: 'var(--notion-bg-secondary)', padding: 'var(--space-5)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                        <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', fontWeight: '500' }}>Accounts Payable</span>
                        <Building2 size={16} color="var(--notion-orange)" />
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--notion-text)' }}>
                        {formatCurrency(summary.accountsPayable)}
                    </div>
                </div>
                <div style={{ backgroundColor: 'var(--notion-bg-secondary)', padding: 'var(--space-5)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                        <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', fontWeight: '500' }}>Cash & Bank Balance</span>
                        <DollarSign size={16} color="var(--notion-text)" />
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--notion-text)' }}>
                        {formatCurrency(summary.cashBankBalance)}
                    </div>
                </div>
            </div>

            {/* Quick Actions & Chart */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 'var(--space-6)' }}>
                {/* Chart */}
                <div style={{ backgroundColor: 'var(--notion-bg-secondary)', padding: 'var(--space-5)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)' }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: 'var(--space-4)' }}>Revenue Trend</div>
                    {summary.revenueTrend?.length > 0 ? (
                        <ResponsiveContainer width="100%" height={240}>
                            <AreaChart data={summary.revenueTrend} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--notion-green)" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="var(--notion-green)" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--notion-divider)" vertical={false} />
                                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--notion-text-secondary)' }} tickLine={false} axisLine={false} tickFormatter={(v: string) => { const d = new Date(v); return `${d.getDate()}/${d.getMonth()+1}`; }} />
                                <YAxis tick={{ fontSize: 11, fill: 'var(--notion-text-secondary)' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
                                <Tooltip content={({ active, payload, label }: any) => {
                                    if (!active || !payload?.length) return null;
                                    return (
                                        <div style={{ backgroundColor: 'var(--notion-bg)', padding: '8px', border: '1px solid var(--notion-border)', borderRadius: '4px', fontSize: '12px' }}>
                                            <div style={{ color: 'var(--notion-text-secondary)', marginBottom: '4px' }}>{label}</div>
                                            <div style={{ fontWeight: '600' }}>Rs {payload[0].value.toLocaleString()}</div>
                                        </div>
                                    );
                                }} />
                                <Area type="monotone" dataKey="amount" stroke="var(--notion-green)" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--notion-text-secondary)', fontSize: '13px' }}>
                            No revenue data available
                        </div>
                    )}
                </div>

                {/* Quick Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: 'var(--space-2)' }}>Quick Links</div>
                    <Button variant="secondary" onClick={() => onNavigate('invoices')} style={{ justifyContent: 'flex-start', padding: 'var(--space-3)' }}>
                        <FileText size={16} style={{ marginRight: '8px' }} /> View All Invoices
                    </Button>
                    <Button variant="secondary" onClick={() => onNavigate('payments')} style={{ justifyContent: 'flex-start', padding: 'var(--space-3)' }}>
                        <CreditCard size={16} style={{ marginRight: '8px' }} /> View All Payments
                    </Button>
                    <Button variant="secondary" onClick={() => onNavigate('general-ledger')} style={{ justifyContent: 'flex-start', padding: 'var(--space-3)' }}>
                        <BookOpen size={16} style={{ marginRight: '8px' }} /> General Ledger
                    </Button>
                    <Button variant="secondary" onClick={() => onNavigate('revenue')} style={{ justifyContent: 'flex-start', padding: 'var(--space-3)' }}>
                        <TrendingUp size={16} style={{ marginRight: '8px' }} /> Revenue Analytics
                    </Button>
                </div>
            </div>

            {/* Recent Activity */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
                {/* Recent Invoices */}
                <div>
                    <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: 'var(--space-4)' }}>Recent Invoices</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        {summary.recentInvoices.length > 0 ? summary.recentInvoices.map(inv => (
                            <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3)', backgroundColor: 'var(--notion-bg-secondary)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)' }}>
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: '500' }}>{inv.invoiceNumber}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>{inv.booking?.guestName || inv.guestName}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '13px', fontWeight: '600' }}>Rs {Number(inv.grandTotal).toLocaleString()}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)' }}>{new Date(inv.createdAt).toLocaleDateString()}</div>
                                </div>
                            </div>
                        )) : (
                            <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>No recent invoices</div>
                        )}
                    </div>
                </div>

                {/* Recent Payments */}
                <div>
                    <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: 'var(--space-4)' }}>Recent Payments</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        {summary.recentPayments.length > 0 ? summary.recentPayments.map(pay => (
                            <div key={pay.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3)', backgroundColor: 'var(--notion-bg-secondary)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)' }}>
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: '500' }}>{pay.paymentMethod.replace('_', ' ')}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>{pay.transactionId || 'Manual'}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--notion-green)' }}>+Rs {Number(pay.amount).toLocaleString()}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)' }}>{new Date(pay.createdAt).toLocaleDateString()}</div>
                                </div>
                            </div>
                        )) : (
                            <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>No recent payments</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
