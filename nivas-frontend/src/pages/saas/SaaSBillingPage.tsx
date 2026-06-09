'use client';

import { useMemo, useState } from 'react';
import {
    CreditCard,
    Package,
    Check,
    Star,
    Zap,
    Crown,
    Calendar,
    Download,
    Receipt,
    RefreshCw,
    Loader2,
    AlertCircle,
    ShieldCheck,
    Search,
    X,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageContainer from '@/components/layout/PageContainer';
import Button from '@/components/ui/Button';
import DateField from "@/components/ui/DateField";
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useSaaSBilling, type SubscriptionPackage, type Payment } from '@/lib/hooks/useSaaSBilling';
import { PERMISSIONS } from '@/lib/constants/permissions';

const getPackageIcon = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('starter')) return Zap;
    if (lowerName.includes('pro') || lowerName.includes('professional')) return Star;
    if (lowerName.includes('enterprise')) return Crown;
    return Package;
};

const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return Number.isNaN(date.getTime())
        ? '-'
        : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatCurrency = (amount?: number | null, currency = 'NPR') => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
    }).format(amount || 0);
};

const formatBillingCycle = (value?: string) => {
    if (!value) return 'Monthly';
    return value.replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
};

function TabNav({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
    const tabs = [
        { id: 'packages', label: 'Packages', icon: Package },
        { id: 'payments', label: 'Payments', icon: Receipt },
    ];

    return (
        <div style={{
            display: 'flex',
            gap: '4px',
            backgroundColor: 'var(--notion-bg-secondary)',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-4)',
        }}>
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        fontSize: '14px',
                        fontWeight: activeTab === tab.id ? '600' : '400',
                        color: activeTab === tab.id ? 'var(--notion-text)' : 'var(--notion-text-secondary)',
                        backgroundColor: activeTab === tab.id ? 'var(--notion-bg)' : 'transparent',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                    }}
                >
                    <tab.icon size={16} />
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

function PackageCard({
    pkg,
    isCurrentPlan,
    canSubscribe,
    isSubscribing,
    onSubscribe,
}: {
    pkg: SubscriptionPackage;
    isCurrentPlan: boolean;
    canSubscribe: boolean;
    isSubscribing: boolean;
    onSubscribe: (id: number, billingCycle: 'MONTHLY' | 'ANNUAL' | '2_YEAR' | '3_YEAR') => void;
}) {
    const Icon = getPackageIcon(pkg.name);
    const isPopular = pkg.name.toLowerCase().includes('pro');

    return (
        <div style={{
            backgroundColor: 'var(--notion-bg)',
            border: isCurrentPlan || isPopular ? '2px solid var(--notion-blue)' : '1px solid var(--notion-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
        }}>
            {(isCurrentPlan || isPopular) && (
                <span style={{
                    position: 'absolute',
                    top: '-10px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: '4px 12px',
                    fontSize: '11px',
                    fontWeight: '600',
                    backgroundColor: 'var(--notion-blue)',
                    color: 'var(--foreground-inverse)',
                    borderRadius: '999px',
                }}>
                    {isCurrentPlan ? 'Current Plan' : 'Popular'}
                </span>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: isCurrentPlan || isPopular ? 'var(--notion-blue-bg)' : 'var(--notion-bg-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <Icon size={22} color={isCurrentPlan || isPopular ? 'var(--notion-blue)' : 'var(--notion-text-secondary)'} />
                </div>
                <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: 'var(--notion-text)' }}>{pkg.name}</h3>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>{pkg.description}</p>
                </div>
            </div>

            <div>
                <span style={{ fontSize: '32px', fontWeight: '700', color: 'var(--notion-text)' }}>{formatCurrency(pkg.monthlyPrice)}</span>
                <span style={{ fontSize: '14px', color: 'var(--notion-text-secondary)' }}> /month</span>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                {pkg.maxRooms ? `Up to ${pkg.maxRooms} rooms` : 'Unlimited rooms'}
                {' • '}
                {pkg.maxUsers ? `${pkg.maxUsers} team members` : 'Unlimited team members'}
            </div>

            <div style={{ display: 'grid', gap: '8px', minHeight: '140px' }}>
                {pkg.features.map((feature, index) => (
                    <div key={`${pkg.id}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--notion-text)' }}>
                        <Check size={14} color="var(--notion-green)" />
                        {feature}
                    </div>
                ))}
            </div>

            <Button
                variant={isCurrentPlan ? 'secondary' : 'primary'}
                onClick={() => onSubscribe(pkg.id, 'MONTHLY')}
                disabled={!canSubscribe || isCurrentPlan || isSubscribing}
                icon={isSubscribing ? <Loader2 size={16} className="animate-spin" /> : undefined}
                fullWidth
            >
                {isCurrentPlan ? 'Current Plan' : canSubscribe ? 'Request Subscription' : 'View Only'}
            </Button>
        </div>
    );
}

function StatusBadge({ value }: { value: string }) {
    const normalized = value.toUpperCase();
    const isHealthy = normalized === 'ACTIVE' || normalized === 'TRIAL';

    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 10px',
            borderRadius: '999px',
            backgroundColor: isHealthy ? 'var(--notion-green-bg)' : 'var(--notion-yellow-bg)',
            color: isHealthy ? 'var(--notion-green)' : 'var(--notion-yellow)',
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'capitalize',
        }}>
            <ShieldCheck size={14} />
            {value.toLowerCase().replaceAll('_', ' ')}
        </span>
    );
}

export default function SaaSBillingPage() {
    const { packages, payments, subscription, hotel, stats, isLoading, error, refresh, subscribeToPlan } = useSaaSBilling();
    const { can } = usePermissions();
    const [activeTab, setActiveTab] = useState('packages');
    const [subscribingId, setSubscribingId] = useState<number | null>(null);

    const [paymentSearch, setPaymentSearch] = useState('');
    const [paymentStatusFilter, setPaymentStatusFilter] = useState<'ALL' | string>('ALL');
    const [paymentDateFrom, setPaymentDateFrom] = useState('');
    const [paymentDateTo, setPaymentDateTo] = useState('');

    const filteredPayments = useMemo(() => {
        let data = [...payments];
        if (paymentSearch.trim()) {
            const q = paymentSearch.toLowerCase();
            data = data.filter(p =>
                (p.invoiceNumber || '').toLowerCase().includes(q) ||
                (p.description || '').toLowerCase().includes(q)
            );
        }
        if (paymentStatusFilter !== 'ALL') data = data.filter(p => p.status === paymentStatusFilter);
        if (paymentDateFrom) {
            const from = new Date(paymentDateFrom).getTime();
            data = data.filter(p => new Date(p.dueDate ?? p.createdAt ?? '').getTime() >= from);
        }
        if (paymentDateTo) {
            const to = new Date(paymentDateTo).getTime() + 86400000;
            data = data.filter(p => new Date(p.dueDate ?? p.createdAt ?? '').getTime() <= to);
        }
        return data;
    }, [payments, paymentSearch, paymentStatusFilter, paymentDateFrom, paymentDateTo]);

    const paymentStatuses = useMemo(() => ['ALL', ...Array.from(new Set(payments.map(p => p.status).filter(Boolean)))], [payments]);

    const canSubscribe = can(PERMISSIONS.SAAS_ADMIN.MANAGE_SUBSCRIPTIONS);
    const apiBaseUrl = api.getBaseUrl();

    const summaryCards = useMemo(() => ([
        {
            label: 'Current Plan',
            value: stats.currentPlan || 'Not assigned',
            tone: 'var(--notion-blue-bg)',
            text: 'var(--notion-blue)',
        },
        {
            label: 'License Status',
            value: stats.licenseStatus.replaceAll('_', ' '),
            tone: 'var(--notion-green-bg)',
            text: 'var(--notion-green)',
        },
        {
            label: 'Next Renewal',
            value: formatDate(stats.nextBillingDate),
            tone: 'var(--notion-bg)',
            text: 'var(--notion-text)',
        },
        {
            label: 'Paid To Date',
            value: formatCurrency(stats.totalPaid),
            tone: 'var(--notion-yellow-bg)',
            text: 'var(--notion-yellow)',
        },
    ]), [stats.currentPlan, stats.licenseStatus, stats.nextBillingDate, stats.totalPaid]);

    const handleSubscribe = async (packageId: number, billingCycle: 'MONTHLY' | 'ANNUAL' | '2_YEAR' | '3_YEAR') => {
        setSubscribingId(packageId);
        await subscribeToPlan(packageId, billingCycle);
        setSubscribingId(null);
    };

    return (
        <DashboardLayout>
            <PageContainer title="Billing" icon={<CreditCard size={40} />}>
                <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                    <Card variant="outline" hoverEffect={false} style={{ padding: 'var(--space-5)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                            <div style={{ display: 'grid', gap: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                    <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: 'var(--notion-text)' }}>Subscription & Billing</h1>
                                    <StatusBadge value={stats.licenseStatus || 'TRIAL'} />
                                </div>
                                <p style={{ margin: 0, fontSize: '14px', color: 'var(--notion-text-secondary)', maxWidth: '720px' }}>
                                    Review your hotel's current plan, renewal timeline, and recent invoices. This page is now scoped to your hotel's actual subscription data.
                                </p>
                                {(hotel || subscription) && (
                                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                                        <span>{hotel?.name || 'Current hotel'}</span>
                                        <span>Billing cycle: {formatBillingCycle(stats.billingCycle || subscription?.billingCycle)}</span>
                                        <span>Pending amount: {formatCurrency(stats.pendingAmount)}</span>
                                    </div>
                                )}
                            </div>

                            <Button
                                variant="secondary"
                                onClick={refresh}
                                disabled={isLoading}
                                icon={isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                            >
                                Refresh
                            </Button>
                        </div>
                    </Card>

                    {error && (
                        <div style={{
                            padding: 'var(--space-4)',
                            backgroundColor: 'var(--notion-red-bg)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--notion-red)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)',
                        }}>
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
                        {summaryCards.map((card) => (
                            <div key={card.label} style={{ padding: 'var(--space-4)', backgroundColor: card.tone, border: card.label === 'Next Renewal' ? '1px solid var(--notion-border)' : 'none', borderRadius: 'var(--radius-md)' }}>
                                <div style={{ fontSize: '20px', fontWeight: '700', color: card.text }}>{card.value}</div>
                                <div style={{ fontSize: '13px', color: card.text === 'var(--notion-text)' ? 'var(--notion-text-secondary)' : card.text }}>{card.label}</div>
                            </div>
                        ))}
                    </div>

                    {!canSubscribe && (
                        <Card variant="outline" hoverEffect={false} style={{ padding: 'var(--space-4)', color: 'var(--notion-text-secondary)' }}>
                            Plan changes are restricted to users with the `saas:manage_subscriptions` permission. You can still review your current billing state and invoices here.
                        </Card>
                    )}

                    <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

                    {isLoading ? (
                        <Card variant="outline" hoverEffect={false} style={{ padding: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--notion-text-secondary)' }}>
                            <Loader2 size={16} className="animate-spin" />
                            Loading billing data...
                        </Card>
                    ) : activeTab === 'packages' ? (
                        packages.length === 0 ? (
                            <Card variant="outline" hoverEffect={false} style={{ padding: '48px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>
                                <Package size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                                <div>No packages are available right now.</div>
                            </Card>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
                                {packages.map((pkg) => (
                                    <PackageCard
                                        key={pkg.id}
                                        pkg={pkg}
                                        isCurrentPlan={subscription?.package?.id === pkg.id}
                                        canSubscribe={canSubscribe}
                                        isSubscribing={subscribingId === pkg.id}
                                        onSubscribe={handleSubscribe}
                                    />
                                ))}
                            </div>
                        )
                    ) : payments.length === 0 ? (
                        <Card variant="outline" hoverEffect={false} style={{ padding: '48px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>
                            <Receipt size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                            <div>No recent subscription payments were found.</div>
                        </Card>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                            {/* Payments Filters */}
                            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap', padding: 'var(--space-3)', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)' }}>
                                <div style={{ position: 'relative', minWidth: '200px', flex: 1, maxWidth: '320px' }}>
                                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--notion-text-muted)' }} />
                                    <input
                                        type="text"
                                        placeholder="Search invoices..."
                                        value={paymentSearch}
                                        onChange={e => setPaymentSearch(e.target.value)}
                                        style={{ width: '100%', padding: '6px 10px 6px 32px', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)', backgroundColor: 'var(--notion-bg)', color: 'var(--notion-text)', fontSize: '13px', outline: 'none' }}
                                    />
                                    {paymentSearch && (
                                        <button onClick={() => setPaymentSearch('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--notion-text-muted)' }}><X size={14} /></button>
                                    )}
                                </div>
                                <select
                                    value={paymentStatusFilter}
                                    onChange={e => setPaymentStatusFilter(e.target.value)}
                                    style={{ padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)', backgroundColor: 'var(--notion-bg)', color: 'var(--notion-text)', fontSize: '13px', cursor: 'pointer' }}
                                >
                                    {paymentStatuses.map(s => <option key={s} value={s}>{s === 'ALL' ? 'All Status' : s}</option>)}
                                </select>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <div style={{ width: 150 }}><DateField value={paymentDateFrom} onChange={setPaymentDateFrom} /></div>
                                    <span style={{ color: 'var(--notion-text-muted)', fontSize: '13px' }}>to</span>
                                    <div style={{ width: 150 }}><DateField value={paymentDateTo} onChange={setPaymentDateTo} /></div>
                                </div>
                                {(paymentSearch || paymentStatusFilter !== 'ALL' || paymentDateFrom || paymentDateTo) && (
                                    <button onClick={() => { setPaymentSearch(''); setPaymentStatusFilter('ALL'); setPaymentDateFrom(''); setPaymentDateTo(''); }} style={{ fontSize: '12px', color: 'var(--notion-blue)', background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
                                )}
                            </div>

                            <div style={{ backgroundColor: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--notion-text-secondary)', textTransform: 'uppercase' }}>Invoice</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--notion-text-secondary)', textTransform: 'uppercase' }}>Description</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--notion-text-secondary)', textTransform: 'uppercase' }}>Amount</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--notion-text-secondary)', textTransform: 'uppercase' }}>Status</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--notion-text-secondary)', textTransform: 'uppercase' }}>Billing Date</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: 'var(--notion-text-secondary)', textTransform: 'uppercase' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPayments.length === 0 ? (
                                            <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>No payments found matching filters.</td></tr>
                                        ) : filteredPayments.map((payment: Payment) => {
                                        const isPaid = payment.status === 'PAID' || payment.status === 'COMPLETED';
                                        return (
                                            <tr key={payment.id} style={{ borderTop: '1px solid var(--notion-border)' }}>
                                                <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500', color: 'var(--notion-text)' }}>{payment.invoiceNumber}</td>
                                                <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--notion-text)' }}>{payment.description}</td>
                                                <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: '600', color: 'var(--notion-text)' }}>{formatCurrency(payment.amount, payment.currency)}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <span style={{
                                                        padding: '4px 10px',
                                                        fontSize: '11px',
                                                        fontWeight: '600',
                                                        borderRadius: '999px',
                                                        backgroundColor: isPaid ? 'var(--notion-green-bg)' : payment.status === 'PENDING' ? 'var(--notion-yellow-bg)' : 'var(--notion-red-bg)',
                                                        color: isPaid ? 'var(--notion-green)' : payment.status === 'PENDING' ? 'var(--notion-yellow)' : 'var(--notion-red)',
                                                    }}>
                                                        {payment.status === 'COMPLETED' ? 'PAID' : payment.status}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>{formatDate(payment.dueDate)}</td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        icon={<Download size={14} />}
                                                        onClick={() => window.open(`${apiBaseUrl}/saas-billing/payments/${payment.id}/pdf`, '_blank', 'noopener,noreferrer')}
                                                        title="Download invoice"
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                </div>
            </PageContainer>
        </DashboardLayout>
    );
}