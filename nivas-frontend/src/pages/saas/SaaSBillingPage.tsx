'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageContainer from '@/components/layout/PageContainer';
import Button from '@/components/ui/Button';
import { useSaaSBilling, type SubscriptionPackage, type Payment, type CreatePackagePayload, type RecordPaymentPayload } from '@/lib/hooks/useSaaSBilling';
import {
    CreditCard,
    Package,
    Plus,
    Check,
    Star,
    Zap,
    Crown,
    Building2,
    Calendar,
    DollarSign,
    Download,
    Receipt,
    RefreshCw,
    Loader2,
    AlertCircle,
    X,
    Trash2
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

// Helpers
const getPackageIcon = (name: string) => {
    const lowerName = (name || '').toLowerCase();
    if (lowerName.includes('starter')) return Zap;
    if (lowerName.includes('pro') || lowerName.includes('professional')) return Star;
    if (lowerName.includes('enterprise')) return Crown;
    return Package;
};

const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const formatCurrency = (amount: number | null | undefined) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);

// Tab Navigation
function TabNav({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
    const tabs = [
        { id: 'packages', label: 'Packages', icon: Package },
        { id: 'payments', label: 'Payments', icon: Receipt }
    ];

    return (
        <div style={{
            display: 'flex',
            gap: '4px',
            backgroundColor: 'var(--notion-bg-secondary)',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-4)'
        }}>
            {tabs.map(tab => (
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
                        cursor: 'pointer'
                    }}
                >
                    <tab.icon size={16} />
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

// Package Card
function PackageCard({ pkg, onSubscribe, isSubscribing }: {
    pkg: SubscriptionPackage;
    onSubscribe: (id: number) => void;
    isSubscribing: boolean;
}) {
    const Icon = getPackageIcon(pkg.name);
    const isPopular = (pkg.name || '').toLowerCase().includes('pro');

    return (
        <div style={{
            backgroundColor: 'var(--notion-bg)',
            border: isPopular ? '2px solid var(--notion-blue)' : '1px solid var(--notion-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {isPopular && (
                <span style={{
                    position: 'absolute',
                    top: '-10px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: '4px 12px',
                    fontSize: '11px',
                    fontWeight: '600',
                    backgroundColor: 'var(--notion-blue)',
                    color: 'white',
                    borderRadius: 'var(--radius-full)'
                }}>
                    Most Popular
                </span>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: isPopular ? 'var(--notion-blue-bg)' : 'var(--notion-bg-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Icon size={22} color={isPopular ? 'var(--notion-blue)' : 'var(--notion-text-secondary)'} />
                </div>
                <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: 'var(--notion-text)' }}>{pkg.name}</h3>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--notion-text-secondary)' }}>{pkg.description}</p>
                </div>
            </div>

            <div style={{ marginBottom: 'var(--space-4)' }}>
                <span style={{ fontSize: '32px', fontWeight: '700', color: 'var(--notion-text)' }}>{formatCurrency(pkg.price)}</span>
                <span style={{ fontSize: '14px', color: 'var(--notion-text-secondary)' }}>/{(pkg.billingCycle || '').toLowerCase()}</span>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)' }}>
                {pkg.maxRooms ? `Up to ${pkg.maxRooms} rooms` : 'Unlimited rooms'} • {pkg.maxStaff ? `${pkg.maxStaff} staff` : 'Unlimited staff'}
            </div>

            <div style={{ flex: 1, marginBottom: 'var(--space-4)' }}>
                {pkg.features.map((feature, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--notion-text)', padding: '4px 0' }}>
                        <Check size={14} color="var(--notion-green)" />
                        {feature}
                    </div>
                ))}
            </div>

            <Button
                variant={isPopular ? 'primary' : 'secondary'}
                onClick={() => onSubscribe(pkg.id)}
                style={{ width: '100%' }}
                disabled={isSubscribing}
                icon={isSubscribing ? <Loader2 size={16} className="animate-spin" /> : undefined}
            >
                {pkg.isActive ? 'Current Plan' : 'Subscribe'}
            </Button>
        </div>
    );
}

// Loading skeleton
function TableSkeleton() {
    return (
        <div style={{ padding: '16px' }}>
            {[1, 2, 3].map(i => (
                <div key={i} style={{
                    height: '48px',
                    backgroundColor: 'var(--notion-bg-secondary)',
                    marginBottom: '8px',
                    borderRadius: 'var(--radius-sm)',
                    animation: 'pulse 2s infinite'
                }} />
            ))}
        </div>
    );
}

export default function SaaSBillingPage() {
    const { packages, payments, stats, isLoading, error, refresh, subscribeToPlan } = useSaaSBilling();

    const [activeTab, setActiveTab] = useState('packages');
    const [subscribingId, setSubscribingId] = useState<number | null>(null);

    // Stats Computation

    const computedStats = useMemo(() => ({
        totalRevenue: payments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0),
        pendingPayments: payments.filter(p => p.status === 'PENDING').length,
        activePackages: packages.filter(p => p.isActive).length,
        totalTransactions: payments.length
    }), [packages, payments]);

    const handleSubscribe = async (packageId: number) => {
        setSubscribingId(packageId);
        await subscribeToPlan(packageId);
        setSubscribingId(null);
    };

    return (
        <DashboardLayout>
            <PageContainer>
                <div style={{ padding: 'var(--space-6)', maxWidth: '1400px', margin: '0 auto' }}>
                    {/* Header */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 'var(--space-6)',
                        flexWrap: 'wrap',
                        gap: 'var(--space-3)'
                    }}>
                        <div>
                            <h1 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--notion-text)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <CreditCard size={24} />
                                SaaS Billing
                            </h1>
                            <p style={{ color: 'var(--notion-text-secondary)', fontSize: '14px' }}>
                                Manage subscription packages and payments
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            <Button
                                variant="secondary"
                                onClick={refresh}
                                disabled={isLoading}
                                icon={isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                            >
                                Refresh
                            </Button>
                            {activeTab === 'payments' && (
                                <Button variant="secondary" icon={<Download size={16} />}>Export</Button>
                            )}
                        </div>
                    </div>

                    {/* Error State */}
                    {error && (
                        <div style={{
                            padding: 'var(--space-4)',
                            backgroundColor: 'var(--notion-red-bg)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--notion-red)',
                            marginBottom: 'var(--space-4)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)'
                        }}>
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    {/* Tabs */}
                    <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

                    {/* Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                        <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--notion-green-bg)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--notion-green)' }}>{formatCurrency(computedStats.totalRevenue)}</div>
                            <div style={{ fontSize: '13px', color: 'var(--notion-green)' }}>Total Revenue</div>
                        </div>
                        <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: '24px', fontWeight: '700' }}>{computedStats.totalTransactions}</div>
                            <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Transactions</div>
                        </div>
                        <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--notion-yellow-bg)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--notion-yellow)' }}>{computedStats.pendingPayments}</div>
                            <div style={{ fontSize: '13px', color: 'var(--notion-yellow)' }}>Pending</div>
                        </div>
                        <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--notion-blue-bg)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--notion-blue)' }}>{computedStats.activePackages}</div>
                            <div style={{ fontSize: '13px', color: 'var(--notion-blue)' }}>Active Packages</div>
                        </div>
                    </div>

                    {/* Content */}
                    {isLoading ? (
                        <TableSkeleton />
                    ) : activeTab === 'packages' ? (
                        packages.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--notion-text-secondary)' }}>
                                <Package size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                                <div>No packages found</div>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
                                {packages.map(pkg => (
                                    <PackageCard
                                        key={pkg.id}
                                        pkg={pkg}
                                        onSubscribe={handleSubscribe}
                                        isSubscribing={subscribingId === pkg.id}
                                    />
                                ))}
                            </div>
                        )
                    ) : (
                        payments.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--notion-text-secondary)' }}>
                                <Receipt size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                                <div>No payments found</div>
                            </div>
                        ) : (
                            <div style={{ backgroundColor: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--notion-text-secondary)', textTransform: 'uppercase' }}>Invoice</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--notion-text-secondary)', textTransform: 'uppercase' }}>Description</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--notion-text-secondary)', textTransform: 'uppercase' }}>Amount</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--notion-text-secondary)', textTransform: 'uppercase' }}>Status</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--notion-text-secondary)', textTransform: 'uppercase' }}>Due Date</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: 'var(--notion-text-secondary)', textTransform: 'uppercase' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {payments.map(payment => (
                                            <tr key={payment.id} style={{ borderTop: '1px solid var(--notion-border)' }}>
                                                <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500', color: 'var(--notion-text)' }}>
                                                    {payment.invoiceNumber}
                                                </td>
                                                <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--notion-text)' }}>
                                                    {payment.description}
                                                </td>
                                                <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: '600', color: 'var(--notion-text)' }}>
                                                    {formatCurrency(payment.amount)}
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <span style={{
                                                        padding: '4px 10px',
                                                        fontSize: '11px',
                                                        fontWeight: '600',
                                                        borderRadius: 'var(--radius-full)',
                                                        backgroundColor: payment.status === 'PAID' ? 'var(--notion-green-bg)' : payment.status === 'PENDING' ? 'var(--notion-yellow-bg)' : 'var(--notion-red-bg)',
                                                        color: payment.status === 'PAID' ? 'var(--notion-green)' : payment.status === 'PENDING' ? 'var(--notion-yellow)' : 'var(--notion-red)'
                                                    }}>
                                                        {payment.status}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                                                    {formatDate(payment.dueDate)}
                                                </td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        icon={<Download size={14} />}
                                                        onClick={() => window.open(`/api/v1/saas-billing/payments/${payment.id}/pdf`, '_blank')}
                                                        title="Download Invoice"
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}
                </div>
            </PageContainer>
        </DashboardLayout>
    );
}
