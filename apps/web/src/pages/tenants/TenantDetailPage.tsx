'use client';

import { useState, useEffect, useCallback } from 'react';
import Button from '@/components/ui/Button';
import { useTenants } from '@/lib/hooks/useTenants';
import {
    ArrowLeft,
    Building2,
    Crown,
    DollarSign,
    Eye,
    Key,
    Loader2,
    Mail,
    MapPin,
    Phone,
    Users,
} from 'lucide-react';
import { toast } from 'sonner';

function getTenantIdFromPath(): string | null {
    const m = window.location.pathname.match(/^\/admin\/tenants\/([^/]+)$/);
    return m?.[1] ? decodeURIComponent(m[1]) : null;
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>{label}</span>
            <span style={{ fontSize: '14px', color: 'var(--notion-text)' }}>{value || '—'}</span>
        </div>
    );
}

export default function TenantDetailPage() {
    const tenantId = getTenantIdFromPath();
    const { getTenantDetails, getPaymentHistory, impersonateOwner, activateLicense } = useTenants();

    const [loading, setLoading] = useState(true);
    const [detail, setDetail] = useState<any>(null);
    const [usage, setUsage] = useState<any>(null);
    const [payments, setPayments] = useState<any[]>([]);
    const [activating, setActivating] = useState(false);

    const load = useCallback(async () => {
        if (!tenantId) return;
        setLoading(true);
        try {
            const [{ detail: d, usage: u }, paymentList] = await Promise.all([
                getTenantDetails(tenantId),
                getPaymentHistory(tenantId),
            ]);
            setDetail(d);
            setUsage(u);
            setPayments(paymentList);
        } catch {
            toast.error('Failed to load tenant details');
        } finally {
            setLoading(false);
        }
    }, [tenantId, getTenantDetails, getPaymentHistory]);

    useEffect(() => { load(); }, [load]);

    if (!tenantId) {
        return (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
                <p>Invalid tenant</p>
                <a href="/admin/tenants" style={{ color: 'var(--notion-blue)' }}>Back to tenants</a>
            </div>
        );
    }

    if (loading) {
        return (
            <div style={{ padding: 'var(--space-8)', display: 'flex', justifyContent: 'center' }}>
                <Loader2 size={32} className="animate-spin" style={{ color: 'var(--notion-text-secondary)' }} />
            </div>
        );
    }

    const hotel = detail?.hotel;
    const subscription = detail?.subscription;
    const expiry = hotel?.licenseExpiresAt ? new Date(hotel.licenseExpiresAt) : null;
    const isExpired = expiry ? expiry < new Date() : false;

    const handleActivate = async () => {
        setActivating(true);
        try {
            await activateLicense(tenantId, 'MONTHLY');
            toast.success('License activated');
            await load();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Activation failed');
        } finally {
            setActivating(false);
        }
    };

    const cardStyle: React.CSSProperties = {
        backgroundColor: 'var(--notion-bg-secondary)',
        border: '1px solid var(--notion-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-5)',
    };

    return (
        <div style={{ padding: 'var(--space-8)', maxWidth: '1100px', margin: '0 auto' }}>
            <a
                href="/admin/tenants"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--notion-text-secondary)', textDecoration: 'none', marginBottom: 'var(--space-4)' }}
            >
                <ArrowLeft size={14} /> All tenants
            </a>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                    <div style={{
                        width: '56px', height: '56px', borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--notion-blue-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--notion-blue)',
                    }}>
                        <Building2 size={28} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '26px', fontWeight: '600', color: 'var(--notion-text)', margin: 0 }}>
                            {hotel?.name || 'Untitled Hotel'}
                        </h1>
                        <p style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', margin: '4px 0 0' }}>
                            /{hotel?.slug?.replace(/^\/+/, '') || 'no-slug'}
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    {isExpired && (
                        <Button size="sm" onClick={handleActivate} disabled={activating}>
                            {activating ? 'Activating…' : 'Activate license'}
                        </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => { window.location.href = '/admin/tenants'; }}>
                        Back to list
                    </Button>
                    <Button
                        size="sm"
                        onClick={async () => {
                            toast.info('Switching to hotel owner view…');
                            await impersonateOwner(tenantId);
                        }}
                    >
                        <Eye size={14} style={{ marginRight: '6px' }} /> View as owner
                    </Button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                <div style={cardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-3)' }}>
                        <Key size={16} style={{ color: 'var(--notion-orange)' }} />
                        <span style={{ fontWeight: '600', fontSize: '14px' }}>License</span>
                    </div>
                    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                        <InfoRow label="Status" value={hotel?.licenseStatus || (hotel?.isActive ? 'ACTIVE' : 'INACTIVE')} />
                        <InfoRow label="Plan" value={subscription?.package?.name || hotel?.planTier || '—'} />
                        <InfoRow label="Expires" value={expiry ? expiry.toLocaleDateString() : 'Lifetime'} />
                        <InfoRow label="Billing cycle" value={subscription?.billingCycle || '—'} />
                    </div>
                </div>

                <div style={cardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-3)' }}>
                        <Users size={16} style={{ color: 'var(--notion-blue)' }} />
                        <span style={{ fontWeight: '600', fontSize: '14px' }}>Limits & usage</span>
                    </div>
                    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                        <InfoRow label="Active users" value={detail?.usersCount} />
                        <InfoRow label="Max rooms" value={hotel?.maxRooms} />
                        <InfoRow label="Max users" value={hotel?.maxUsers} />
                        <InfoRow label="DB records" value={usage?.database?.totalRows?.toLocaleString()} />
                        <InfoRow label="File storage" value={usage?.storage?.pretty} />
                    </div>
                </div>

                <div style={cardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-3)' }}>
                        <Crown size={16} style={{ color: 'var(--notion-purple)' }} />
                        <span style={{ fontWeight: '600', fontSize: '14px' }}>Contact</span>
                    </div>
                    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                            <Mail size={14} style={{ color: 'var(--notion-text-muted)' }} />
                            <span>{hotel?.email || '—'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                            <Phone size={14} style={{ color: 'var(--notion-text-muted)' }} />
                            <span>{hotel?.phone || '—'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                            <MapPin size={14} style={{ color: 'var(--notion-text-muted)' }} />
                            <span>{hotel?.address || '—'}</span>
                        </div>
                        <InfoRow label="Created" value={hotel?.createdAt ? new Date(hotel.createdAt).toLocaleDateString() : '—'} />
                    </div>
                </div>
            </div>

            <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-4)' }}>
                    <DollarSign size={16} style={{ color: 'var(--notion-green)' }} />
                    <span style={{ fontWeight: '600', fontSize: '15px' }}>Payment history</span>
                    <span style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', marginLeft: 'auto' }}>
                        {payments.length} record{payments.length !== 1 ? 's' : ''}
                    </span>
                </div>
                {payments.length === 0 ? (
                    <p style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>No payments recorded yet.</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--notion-divider)', textAlign: 'left' }}>
                                    <th style={{ padding: '8px 4px', color: 'var(--notion-text-secondary)', fontWeight: '500' }}>Date</th>
                                    <th style={{ padding: '8px 4px', color: 'var(--notion-text-secondary)', fontWeight: '500' }}>Amount</th>
                                    <th style={{ padding: '8px 4px', color: 'var(--notion-text-secondary)', fontWeight: '500' }}>Cycle</th>
                                    <th style={{ padding: '8px 4px', color: 'var(--notion-text-secondary)', fontWeight: '500' }}>Method</th>
                                    <th style={{ padding: '8px 4px', color: 'var(--notion-text-secondary)', fontWeight: '500' }}>Invoice</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.map((p: any) => (
                                    <tr key={p.id} style={{ borderBottom: '1px solid var(--notion-divider)' }}>
                                        <td style={{ padding: '10px 4px' }}>{new Date(p.createdAt).toLocaleDateString()}</td>
                                        <td style={{ padding: '10px 4px' }}>NPR {parseFloat(p.amount || '0').toLocaleString()}</td>
                                        <td style={{ padding: '10px 4px' }}>{p.billingCycle || '—'}</td>
                                        <td style={{ padding: '10px 4px' }}>{p.paymentMethod || '—'}</td>
                                        <td style={{ padding: '10px 4px' }}>{p.invoiceNumber || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
