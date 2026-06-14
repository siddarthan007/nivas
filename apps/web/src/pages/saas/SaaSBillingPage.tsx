'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { useSaaSBilling, type SubscriptionPackage } from '@/lib/hooks/useSaaSBilling';
import {
    CreditCard,
    Package,
    Check,
    Star,
    Zap,
    Crown,
    Download,
    AlertCircle,
    Calendar,
    Shield,
    TrendingUp,
    Wallet,
} from 'lucide-react';

const getPackageIcon = (name: string) => {
    const lowerName = (name || '').toLowerCase();
    if (lowerName.includes('starter')) return Zap;
    if (lowerName.includes('pro') || lowerName.includes('professional')) return Star;
    if (lowerName.includes('enterprise')) return Crown;
    return Package;
};

const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatCurrency = (amount: number | null | undefined) =>
    new Intl.NumberFormat('en-NP', { style: 'currency', currency: 'NPR', maximumFractionDigits: 0 }).format(amount || 0);

function statsActive(pkg: SubscriptionPackage) {
    return pkg.isCurrent === true;
}

function PackageCard({ pkg, onSubscribe, isSubscribing }: {
    pkg: SubscriptionPackage;
    onSubscribe: (id: number) => void;
    isSubscribing: boolean;
}) {
    const Icon = getPackageIcon(pkg.name);
    const isPopular = (pkg.name || '').toLowerCase().includes('pro');
    const isCurrent = pkg.isCurrent && statsActive(pkg);

    return (
        <div style={{
            backgroundColor: 'var(--notion-bg)',
            border: isCurrent ? '2px solid var(--notion-green)' : isPopular ? '2px solid var(--notion-blue)' : '1px solid var(--notion-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: isPopular ? '0 8px 24px rgba(46, 170, 220, 0.08)' : 'none',
        }}>
            {isCurrent && (
                <span style={{
                    position: 'absolute',
                    top: '-10px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: '4px 12px',
                    fontSize: '11px',
                    fontWeight: '600',
                    backgroundColor: 'var(--notion-green)',
                    color: 'white',
                    borderRadius: 'var(--radius-full)',
                }}>
                    Current Plan
                </span>
            )}
            {!isCurrent && isPopular && (
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
                    borderRadius: 'var(--radius-full)',
                }}>
                    Most Popular
                </span>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: isPopular || isCurrent ? 'var(--notion-blue-bg)' : 'var(--notion-bg-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <Icon size={22} color={isPopular || isCurrent ? 'var(--notion-blue)' : 'var(--notion-text-secondary)'} />
                </div>
                <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: 'var(--notion-text)' }}>{pkg.name}</h3>
                    {pkg.description && (
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--notion-text-secondary)' }}>{pkg.description}</p>
                    )}
                </div>
            </div>

            <div style={{ marginBottom: 'var(--space-4)' }}>
                <span style={{ fontSize: '32px', fontWeight: '700', color: 'var(--notion-text)' }}>{formatCurrency(pkg.price)}</span>
                <span style={{ fontSize: '14px', color: 'var(--notion-text-secondary)' }}>/{(pkg.billingCycle || 'monthly').toLowerCase()}</span>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)' }}>
                {pkg.maxRooms ? `Up to ${pkg.maxRooms} rooms` : 'Unlimited rooms'} · {pkg.maxUsers ? `${pkg.maxUsers} users` : 'Unlimited users'}
            </div>

            <div style={{ flex: 1, marginBottom: 'var(--space-4)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
                {pkg.features.map((feature, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '12px', color: 'var(--notion-text)', padding: '2px 0' }}>
                        <Check size={13} color="var(--notion-green)" style={{ flexShrink: 0, marginTop: 2 }} />
                        <span>{feature}</span>
                    </div>
                ))}
            </div>

            <Button
                variant={isCurrent ? 'secondary' : isPopular ? 'primary' : 'secondary'}
                onClick={() => onSubscribe(pkg.id)}
                style={{ width: '100%' }}
                disabled={isSubscribing || isCurrent}
                loading={isSubscribing}
            >
                {isCurrent ? 'Current Plan' : 'Select Plan'}
            </Button>
        </div>
    );
}

function StatCard({ icon: Icon, label, value, accent }: {
    icon: typeof Wallet;
    label: string;
    value: string;
    accent?: string;
}) {
    return (
        <div style={{
            backgroundColor: 'var(--notion-bg)',
            border: '1px solid var(--notion-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
        }}>
            <div style={{
                width: 40,
                height: 40,
                borderRadius: 'var(--radius-md)',
                backgroundColor: accent || 'var(--notion-blue-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <Icon size={18} color={accent ? 'var(--notion-green)' : 'var(--notion-blue)'} />
            </div>
            <div>
                <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', fontWeight: 500 }}>{label}</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--notion-text)' }}>{value}</div>
            </div>
        </div>
    );
}

function TableSkeleton() {
    return (
        <div style={{ padding: '16px' }}>
            {[1, 2, 3].map(i => (
                <div key={i} style={{
                    height: '48px',
                    backgroundColor: 'var(--notion-bg-secondary)',
                    marginBottom: '8px',
                    borderRadius: 'var(--radius-sm)',
                    animation: 'pulse 2s infinite',
                }} />
            ))}
        </div>
    );
}

export default function SaaSBillingPage() {
    const { packages, payments, stats, isLoading, error, subscribeToPlan } = useSaaSBilling();
    const [subscribingId, setSubscribingId] = useState<number | null>(null);

    const currentPackage = packages.find(p => p.isCurrent);
    const otherPackages = packages.filter(p => !p.isCurrent);
    const licenseOk = stats.licenseStatus === 'ACTIVE' || stats.subscriptionStatus === 'ACTIVE';

    const handleSubscribe = async (packageId: number) => {
        setSubscribingId(packageId);
        await subscribeToPlan(packageId);
        setSubscribingId(null);
    };

    return (
        <div style={{ padding: 'var(--space-6) var(--space-8)', maxWidth: '1140px', margin: '0 auto' }}>
            <div style={{ marginBottom: 'var(--space-6)' }}>
                <h1 style={{
                    fontSize: '28px',
                    fontWeight: '700',
                    color: 'var(--notion-text)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    margin: 0,
                }}>
                    <CreditCard size={28} />
                    Subscription & Billing
                </h1>
                <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', marginTop: 'var(--space-2)' }}>
                    Your plan, license status, and payment history — updates live when payments are recorded.
                </p>
            </div>

            {error && (
                <div style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--notion-red-bg)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--notion-red)',
                    marginBottom: 'var(--space-4)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    fontSize: '14px',
                }}>
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}

            {isLoading ? (
                <TableSkeleton />
            ) : (
                <>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: 'var(--space-3)',
                        marginBottom: 'var(--space-5)',
                    }}>
                        <StatCard icon={Shield} label="License" value={stats.licenseStatus || 'Active'} accent={licenseOk ? 'var(--notion-green-bg)' : undefined} />
                        <StatCard icon={Calendar} label="Next renewal" value={formatDate(stats.nextBillingDate)} />
                        <StatCard icon={TrendingUp} label="Total paid" value={formatCurrency(stats.totalPaid)} />
                        <StatCard icon={Wallet} label="Outstanding" value={formatCurrency(stats.pendingAmount)} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
                        {/* Current Plan Hero */}
                        <div style={{
                            background: 'linear-gradient(135deg, var(--notion-bg) 0%, var(--notion-blue-bg) 100%)',
                            border: '1px solid var(--notion-border)',
                            borderRadius: 'var(--radius-lg)',
                            padding: 'var(--space-6)',
                            position: 'relative',
                            overflow: 'hidden',
                        }}>
                            <div style={{
                                position: 'absolute',
                                top: -40,
                                right: -40,
                                width: 160,
                                height: 160,
                                borderRadius: '50%',
                                background: 'rgba(46, 170, 220, 0.06)',
                            }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-4)', fontSize: '12px', fontWeight: 600, color: 'var(--notion-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                <CreditCard size={16} />
                                Current Plan
                            </div>
                            {currentPackage ? (
                                <>
                                    <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--notion-text)', marginBottom: '6px', letterSpacing: '-0.02em' }}>
                                        {currentPackage.name}
                                    </div>
                                    <div style={{ fontSize: '16px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-4)' }}>
                                        {formatCurrency(currentPackage.price)}
                                        <span style={{ fontWeight: 400 }}> / {(currentPackage.billingCycle || 'month').toLowerCase()}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
                                        <Badge variant={stats.subscriptionStatus === 'ACTIVE' ? 'success' : 'warning'}>
                                            {stats.subscriptionStatus || 'ACTIVE'}
                                        </Badge>
                                        {stats.nextBillingDate && (
                                            <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <Calendar size={14} />
                                                Renews {formatDate(stats.nextBillingDate)}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                                        gap: '6px 16px',
                                        borderTop: '1px solid var(--notion-border)',
                                        paddingTop: 'var(--space-4)',
                                    }}>
                                        {currentPackage.features.map((feature, idx) => (
                                            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: 'var(--notion-text)' }}>
                                                <Check size={14} color="var(--notion-green)" style={{ flexShrink: 0, marginTop: 2 }} />
                                                {feature}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div style={{ color: 'var(--notion-text-secondary)', fontSize: '14px' }}>No active plan — choose one below.</div>
                            )}
                        </div>

                        {/* Recent Payments */}
                        <div style={{
                            backgroundColor: 'var(--notion-bg)',
                            border: '1px solid var(--notion-border)',
                            borderRadius: 'var(--radius-lg)',
                            padding: 'var(--space-5)',
                        }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--notion-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-4)' }}>
                                Recent Payments
                            </div>
                            {payments.length === 0 ? (
                                <div style={{ color: 'var(--notion-text-secondary)', fontSize: '14px', padding: 'var(--space-4) 0' }}>
                                    No payments recorded yet
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                    {payments.slice(0, 6).map(payment => (
                                        <div key={payment.id} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: 'var(--space-3)',
                                            backgroundColor: 'var(--notion-bg-secondary)',
                                            borderRadius: 'var(--radius-md)',
                                        }}>
                                            <div>
                                                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--notion-text)' }}>
                                                    {formatCurrency(payment.amount)}
                                                </div>
                                                <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', marginTop: '2px' }}>
                                                    {formatDate(payment.createdAt || payment.dueDate)} · {payment.status}
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                icon={<Download size={14} />}
                                                onClick={() => window.open(`/api/v1/saas-billing/payments/${payment.id}/pdf`, '_blank')}
                                                title="Download receipt"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {otherPackages.length > 0 && (
                        <div>
                            <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--notion-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-4)' }}>
                                Available Plans
                            </h2>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
                                {otherPackages.map(pkg => (
                                    <PackageCard
                                        key={pkg.id}
                                        pkg={pkg}
                                        onSubscribe={handleSubscribe}
                                        isSubscribing={subscribingId === pkg.id}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
