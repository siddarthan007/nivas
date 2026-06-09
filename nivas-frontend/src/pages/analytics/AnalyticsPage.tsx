'use client';

import { useState } from 'react';
import { useSaaSAnalytics } from '@/lib/hooks/useAnalytics';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DatePicker from '@/components/ui/DatePicker';
import { Card } from '@/components/ui/Card';
import {
    TrendingUp,
    Users,
    Building2,
    DollarSign,
    Activity,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    Receipt,
    CreditCard,
    FileText,
    AlertTriangle,
    Search,
    X,
    Eye
} from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar
} from 'recharts';

export default function AnalyticsPage() {
    const { overview, payments, isLoading, error } = useSaaSAnalytics();
    const [searchQuery, setSearchQuery] = useState('');
    const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
    const [startDate, endDate] = dateRange;

    if (isLoading) {
        return (
            <DashboardLayout>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', padding: 'var(--space-8)' }}>
                    <div style={{ color: 'var(--notion-text-secondary)' }}>Loading analytics...</div>
                </div>
            </DashboardLayout>
        );
    }

    if (error) {
        return (
            <DashboardLayout>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', padding: 'var(--space-8)' }}>
                    <div style={{ color: 'var(--notion-red)' }}>Error: {error}</div>
                </div>
            </DashboardLayout>
        );
    }

    const { totalRevenue = 0, activeTenants = 0, totalTenants = 0, expiringLicenses = 0, revenueHistory = [], tenantGrowth = [] } = overview || {};
    const totalPayments = payments.length;
    const pendingPayments = payments.filter(p => p.status === 'PENDING' || p.status === 'OVERDUE').length;

    const filteredPayments = payments.filter(p => {
        const matchesSearch = !searchQuery ||
            (p.hotelName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.invoiceNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.paymentMethod || '').toLowerCase().includes(searchQuery.toLowerCase());
        const paymentDate = p.createdAt ? new Date(p.createdAt) : null;
        const matchesDate = !startDate || !paymentDate || paymentDate >= startDate;
        const matchesEndDate = !endDate || !paymentDate || paymentDate <= new Date(endDate.getTime() + 86400000);
        return matchesSearch && matchesDate && matchesEndDate;
    });

    return (
        <DashboardLayout>
            <div style={{ padding: 'var(--space-8)' }}>
                {/* Header */}
                <div style={{ marginBottom: 'var(--space-6)' }}>
                    <h1 style={{
                        fontSize: '28px',
                        fontWeight: '600',
                        color: 'var(--notion-text)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                        marginBottom: 'var(--space-2)'
                    }}>
                        <TrendingUp size={28} />
                        SaaS Analytics
                    </h1>
                    <p style={{ color: 'var(--notion-text-secondary)', fontSize: '14px' }}>
                        Platform performance, revenue, and payment ledger
                    </p>
                </div>

                {/* KPI Cards */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 'var(--space-4)',
                    marginBottom: 'var(--space-6)'
                }}>
                    <KPICard title="License Revenue" value={`Rs ${totalRevenue.toLocaleString()}`} icon={DollarSign} color="var(--notion-green)" bg="var(--notion-green-bg)" />
                    <KPICard title="Active Tenants" value={activeTenants} icon={Building2} color="var(--notion-blue)" bg="var(--notion-blue-bg)" />
                    <KPICard title="Total Tenants" value={totalTenants} icon={Users} color="var(--notion-orange)" bg="var(--notion-yellow-bg)" />
                    <KPICard title="Expiring Licenses" value={expiringLicenses} icon={Activity} color="var(--notion-purple)" bg="var(--notion-purple-bg)" />
                    <KPICard title="Total Payments" value={totalPayments} icon={Receipt} color="var(--notion-green)" bg="var(--notion-green-bg)" />
                    <KPICard title="Pending/Overdue" value={pendingPayments} icon={AlertTriangle} color="var(--notion-red)" bg="var(--notion-red-bg)" />
                </div>

                {/* Charts Row 1 */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                    gap: 'var(--space-4)',
                    marginBottom: 'var(--space-6)'
                }}>
                    {/* Revenue Trends */}
                    <div style={{ backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)', padding: 'var(--space-5)' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--notion-text)', marginBottom: 'var(--space-4)' }}>Revenue Trend (6 Months)</h3>
                        <div style={{ height: '300px', width: '100%', minWidth: '1px', minHeight: '1px', overflow: 'hidden' }}>
                            <ResponsiveContainer width="100%" aspect={16 / 9}>
                                <LineChart data={revenueHistory}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--notion-border)" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'var(--notion-text-secondary)', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--notion-text-secondary)', fontSize: 12 }} />
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--notion-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)', boxShadow: 'var(--shadow-lg)' }} />
                                    <Line type="monotone" dataKey="amount" stroke="var(--notion-green)" strokeWidth={2} dot={{ fill: 'var(--notion-green)', r: 4 }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Tenant Growth */}
                    <div style={{ backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)', padding: 'var(--space-5)' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--notion-text)', marginBottom: 'var(--space-4)' }}>Growth (New Tenants)</h3>
                        <div style={{ height: '300px', width: '100%', minWidth: '1px', minHeight: '1px', overflow: 'hidden' }}>
                            <ResponsiveContainer width="100%" aspect={16 / 9}>
                                <BarChart data={tenantGrowth}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--notion-border)" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'var(--notion-text-secondary)', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--notion-text-secondary)', fontSize: 12 }} />
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--notion-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)', boxShadow: 'var(--shadow-lg)' }} cursor={{ fill: 'var(--notion-bg-hover)' }} />
                                    <Bar dataKey="count" fill="var(--notion-blue)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* SaaS Ledger */}
                <div style={{ backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)', padding: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--notion-text)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <FileText size={18} />
                            Ledger — All Payments
                        </h3>
                        <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>{filteredPayments.length} records</span>
                    </div>
                    {/* Filters */}
                    <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--notion-text-muted)', pointerEvents: 'none' }} />
                            <input
                                type="text"
                                placeholder="Search tenant or invoice..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px 12px 8px 32px',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--notion-border)',
                                    backgroundColor: 'var(--notion-bg)',
                                    color: 'var(--notion-text)',
                                    fontSize: '13px',
                                    outline: 'none'
                                }}
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--notion-text-muted)' }}>
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        <div style={{ width: '260px' }}>
                            <DatePicker
                                selectsRange
                                startDate={startDate}
                                endDate={endDate}
                                onChange={(update: any) => setDateRange(update)}
                                placeholder="Filter by date range"
                            />
                        </div>
                    </div>

                    {filteredPayments.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--notion-text-secondary)', padding: 'var(--space-6)', fontSize: '14px' }}>
                            No payments found matching your filters.
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                        <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--notion-text-secondary)', fontWeight: '500' }}>Date</th>
                                        <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--notion-text-secondary)', fontWeight: '500' }}>Tenant</th>
                                        <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--notion-text-secondary)', fontWeight: '500' }}>Invoice</th>
                                        <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--notion-text-secondary)', fontWeight: '500' }}>Method</th>
                                        <th style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--notion-text-secondary)', fontWeight: '500' }}>Amount</th>
                                        <th style={{ textAlign: 'center', padding: '10px 12px', color: 'var(--notion-text-secondary)', fontWeight: '500' }}>Status</th>
                                        <th style={{ textAlign: 'center', padding: '10px 12px', color: 'var(--notion-text-secondary)', fontWeight: '500' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPayments.map(p => (
                                        <tr key={p.id} style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                            <td style={{ padding: '10px 12px', color: 'var(--notion-text)' }}>{new Date(p.createdAt).toLocaleDateString()}</td>
                                            <td style={{ padding: '10px 12px', color: 'var(--notion-text)' }}>{p.hotelName}</td>
                                            <td style={{ padding: '10px 12px', color: 'var(--notion-text-secondary)' }}>{p.invoiceNumber || '-'}</td>
                                            <td style={{ padding: '10px 12px', color: 'var(--notion-text-secondary)' }}>{p.paymentMethod || 'Manual'}</td>
                                            <td style={{ padding: '10px 12px', color: 'var(--notion-text)', textAlign: 'right', fontWeight: '500' }}>Rs {parseFloat(p.amount).toLocaleString()}</td>
                                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                                <span style={{
                                                    fontSize: '11px',
                                                    fontWeight: '600',
                                                    padding: '2px 8px',
                                                    borderRadius: 'var(--radius-sm)',
                                                    backgroundColor: p.status === 'COMPLETED' || p.status === 'PAID' ? 'var(--notion-green-bg)' : p.status === 'PENDING' || p.status === 'OVERDUE' ? 'var(--notion-yellow-bg)' : 'var(--notion-red-bg)',
                                                    color: p.status === 'COMPLETED' || p.status === 'PAID' ? 'var(--notion-green)' : p.status === 'PENDING' || p.status === 'OVERDUE' ? 'var(--notion-orange)' : 'var(--notion-red)',
                                                }}>
                                                    {p.status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => window.open(`/api/v1/saas-billing/payments/${p.id}/pdf`, '_blank')}
                                                    title="View Invoice"
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        color: 'var(--notion-blue)',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        fontSize: '12px'
                                                    }}
                                                >
                                                    <Eye size={14} />
                                                    <span>Invoice</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}

function KPICard({ title, value, icon: Icon, color, bg }: any) {
    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--notion-border)',
            padding: 'var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-4)'
        }}>
            <div style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: color
            }}>
                <Icon size={24} />
            </div>
            <div>
                <div style={{
                    fontSize: '13px',
                    color: 'var(--notion-text-secondary)',
                    fontWeight: '500'
                }}>
                    {title}
                </div>
                <div style={{
                    fontSize: '24px',
                    fontWeight: '600',
                    color: 'var(--notion-text)',
                    lineHeight: '1.2'
                }}>
                    {value}
                </div>
            </div>
        </div>
    );
}
