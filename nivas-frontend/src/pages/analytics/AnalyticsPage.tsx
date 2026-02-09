'use client';

import { useSaaSAnalytics } from '@/lib/hooks/useAnalytics';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import {
    TrendingUp,
    Users,
    Building2,
    DollarSign,
    Activity,
    Calendar,
    ArrowUpRight,
    ArrowDownRight
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
    const { overview, isLoading, error } = useSaaSAnalytics();



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
                        Overview of platform performance and growth
                    </p>
                </div>

                {/* KPI Cards */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: 'var(--space-4)',
                    marginBottom: 'var(--space-6)'
                }}>
                    <KPICard title="Total Revenue" value={`₹${totalRevenue.toLocaleString()}`} icon={DollarSign} color="var(--notion-green)" bg="var(--notion-green-bg)" />
                    <KPICard title="Active Tenants" value={activeTenants} icon={Building2} color="var(--notion-blue)" bg="var(--notion-blue-bg)" />
                    <KPICard title="Total Tenants" value={totalTenants} icon={Users} color="var(--notion-orange)" bg="var(--notion-yellow-bg)" />
                    <KPICard title="Expiring Licenses" value={expiringLicenses} icon={Activity} color="var(--notion-purple)" bg="var(--notion-purple-bg)" />
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
                        <div style={{ height: '300px', width: '100%', minWidth: 0 }}>
                            <ResponsiveContainer width="100%" height="100%">
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
                        <div style={{ height: '300px', width: '100%', minWidth: 0 }}>
                            <ResponsiveContainer width="100%" height="100%">
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
