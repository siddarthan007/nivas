'use client';

import { useState, useMemo } from 'react';
import { useLicenses } from '@/lib/hooks/useLicenses';
import { usePlans } from '@/lib/hooks/usePlans';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import {
    Key,
    Plus,
    RefreshCw,
    Search,
    Calendar,
    Building2,
    Users,
    Bed,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Clock,
    Crown,
    Zap,
    Pause,
    ShieldAlert,
} from 'lucide-react';

type LicenseStatus = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'TRIAL' | 'PAUSED' | 'REVOKED';

// Default plan color palette for dynamic plans
const PLAN_COLORS = [
    { color: 'var(--notion-blue)', bg: 'var(--notion-blue-bg)', icon: Key },
    { color: 'var(--notion-orange)', bg: 'var(--notion-yellow-bg)', icon: Zap },
    { color: 'var(--notion-green)', bg: 'var(--notion-green-bg)', icon: Crown },
    { color: 'var(--notion-purple)', bg: 'var(--notion-purple-bg)', icon: Crown },
    { color: 'var(--notion-pink)', bg: 'var(--notion-pink-bg)', icon: Zap },
];

// Helper to get plan config by index
const getPlanConfig = (index: number) => PLAN_COLORS[index % PLAN_COLORS.length]!;

// Status colors
const STATUS_CONFIG: Record<LicenseStatus, { color: string; bg: string; label: string }> = {
    ACTIVE: { color: 'var(--notion-green)', bg: 'var(--notion-green-bg)', label: 'Active' },
    EXPIRED: { color: 'var(--notion-red)', bg: 'var(--notion-red-bg)', label: 'Expired' },
    SUSPENDED: { color: 'var(--notion-orange)', bg: 'var(--notion-yellow-bg)', label: 'Suspended' },
    TRIAL: { color: 'var(--notion-blue)', bg: 'var(--notion-blue-bg)', label: 'Trial' },
    PAUSED: { color: 'var(--notion-yellow)', bg: 'var(--notion-yellow-bg)', label: 'Paused' },
    REVOKED: { color: 'var(--notion-red)', bg: 'var(--notion-red-bg)', label: 'Revoked' },
};

// License Card Component
function LicenseCard({
    license,
    daysUntilExpiry,
    onRenew,
    onSuspend,
    onReactivate,
    onRevoke,
    planConfigIndex,
}: {
    license: {
        id: string;
        tenantName: string;
        planType: string;
        status: LicenseStatus;
        startDate: string;
        expiryDate: string;
        maxUsers: number;
        maxRooms: number;
    };
    daysUntilExpiry: number;
    onRenew: () => void;
    onSuspend: () => void;
    onReactivate: () => void;
    onRevoke: () => void;
    planConfigIndex: number;
}) {
    const planConfig = getPlanConfig(planConfigIndex);
    const statusConfig = STATUS_CONFIG[license.status] || STATUS_CONFIG.ACTIVE;
    const isExpiringSoon = license.status === 'ACTIVE' && daysUntilExpiry > 0 && daysUntilExpiry <= 30;
    const PlanIcon = planConfig.icon;

    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--notion-border)',
            padding: 'var(--space-5)',
            opacity: (license.status === 'SUSPENDED' || license.status === 'PAUSED' || license.status === 'REVOKED') ? 0.7 : 1,
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 'var(--space-4)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: planConfig.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: planConfig.color,
                    }}>
                        <PlanIcon size={22} />
                    </div>
                    <div>
                        <div style={{
                            fontSize: '15px',
                            fontWeight: '600',
                            color: 'var(--notion-text)',
                        }}>
                            {license.tenantName}
                        </div>
                        <div style={{
                            fontSize: '12px',
                            color: planConfig.color,
                            fontWeight: '500',
                        }}>
                            {license.planType} Plan
                        </div>
                    </div>
                </div>

                {/* Status Badge */}
                <span style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '11px',
                    fontWeight: '500',
                    backgroundColor: statusConfig.bg,
                    color: statusConfig.color,
                }}>
                    {statusConfig.label}
                </span>
            </div>

            {/* Expiry Warning */}
            {isExpiringSoon && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    padding: 'var(--space-3)',
                    backgroundColor: 'var(--notion-yellow-bg)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--space-4)',
                    fontSize: '13px',
                    color: 'var(--notion-orange)',
                }}>
                    <AlertTriangle size={16} />
                    <span>Expires in {daysUntilExpiry} days</span>
                </div>
            )}

            {/* Limits */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-4)',
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    padding: 'var(--space-3)',
                    backgroundColor: 'var(--notion-bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                }}>
                    <Users size={16} style={{ color: 'var(--notion-text-secondary)' }} />
                    <span style={{ fontSize: '13px', color: 'var(--notion-text)' }}>
                        {license.maxUsers} Users
                    </span>
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    padding: 'var(--space-3)',
                    backgroundColor: 'var(--notion-bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                }}>
                    <Bed size={16} style={{ color: 'var(--notion-text-secondary)' }} />
                    <span style={{ fontSize: '13px', color: 'var(--notion-text)' }}>
                        {license.maxRooms} Rooms
                    </span>
                </div>
            </div>

            {/* Dates */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 'var(--space-4)',
                fontSize: '12px',
                color: 'var(--notion-text-secondary)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={12} />
                    Start: {new Date(license.startDate).toLocaleDateString()}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} />
                    Expiry: {new Date(license.expiryDate).toLocaleDateString()}
                </div>
            </div>

            {/* Actions */}
            <div style={{
                display: 'flex',
                gap: 'var(--space-2)',
                borderTop: '1px solid var(--notion-divider)',
                paddingTop: 'var(--space-3)',
            }}>
                {(license.status === 'ACTIVE' || license.status === 'TRIAL') && (
                    <>
                        <Button size="sm" onClick={onRenew} style={{ flex: 1 }}>
                            <RefreshCw size={14} />
                            <span style={{ marginLeft: '4px' }}>Renew</span>
                        </Button>
                        <Button size="sm" variant="secondary" onClick={onSuspend} title="Suspend">
                            <Pause size={14} />
                        </Button>
                        <Button size="sm" variant="secondary" onClick={onRevoke} style={{ color: 'var(--notion-red)' }} title="Revoke">
                            <ShieldAlert size={14} />
                        </Button>
                    </>
                )}
                {(license.status === 'SUSPENDED' || license.status === 'PAUSED') && (
                    <>
                        <Button size="sm" onClick={onReactivate} style={{ flex: 1 }}>
                            <CheckCircle size={14} />
                            <span style={{ marginLeft: '4px' }}>Reactivate</span>
                        </Button>
                        <Button size="sm" variant="secondary" onClick={onRevoke} style={{ color: 'var(--notion-red)' }} title="Revoke">
                            <ShieldAlert size={14} />
                        </Button>
                    </>
                )}
                {license.status === 'EXPIRED' && (
                    <>
                        <Button size="sm" onClick={onRenew} style={{ flex: 1 }}>
                            <RefreshCw size={14} />
                            <span style={{ marginLeft: '4px' }}>Renew</span>
                        </Button>
                        <Button size="sm" variant="secondary" onClick={onRevoke} style={{ color: 'var(--notion-red)' }} title="Revoke">
                            <ShieldAlert size={14} />
                        </Button>
                    </>
                )}
                {license.status === 'REVOKED' && (
                    <Button size="sm" variant="secondary" style={{ flex: 1 }} disabled>
                        <XCircle size={14} />
                        <span style={{ marginLeft: '4px' }}>Revoked</span>
                    </Button>
                )}
            </div>
        </div>
    );
}

// Renewal Modal
function RenewalModal({
    isOpen,
    onClose,
    onSubmit,
    tenantName,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: { durationMonths: number; paymentAmount: number; paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'QR' }) => Promise<void>;
    tenantName: string;
}) {
    const [formData, setFormData] = useState({
        durationMonths: 12,
        paymentAmount: 0,
        paymentMethod: 'BANK_TRANSFER' as 'CASH' | 'BANK_TRANSFER' | 'QR',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        await onSubmit(formData);
        setIsSubmitting(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Renew License - ${tenantName}`}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <Select
                    label="Duration (Months) *"
                    value={formData.durationMonths}
                    onChange={e => setFormData({ ...formData, durationMonths: Number(e.target.value) })}
                    options={[
                        { value: 1, label: '1 Month' },
                        { value: 3, label: '3 Months' },
                        { value: 6, label: '6 Months' },
                        { value: 12, label: '12 Months' },
                        { value: 24, label: '24 Months' },
                    ]}
                    fullWidth
                />

                <div>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                        Payment Amount (NPR) *
                    </label>
                    <Input
                        type="number"
                        value={formData.paymentAmount || ''}
                        onChange={e => setFormData({ ...formData, paymentAmount: e.target.value === '' ? 0 : Number(e.target.value) })}
                        placeholder="50000"
                        required
                    />
                </div>

                <Select
                    label="Payment Method *"
                    value={formData.paymentMethod}
                    onChange={e => setFormData({ ...formData, paymentMethod: e.target.value as 'CASH' | 'BANK_TRANSFER' | 'QR' })}
                    options={[
                        { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
                        { value: 'CASH', label: 'Cash' },
                        { value: 'QR', label: 'QR Payment' },
                    ]}
                    fullWidth
                />

                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting || !formData.paymentAmount || formData.paymentAmount <= 0 || isNaN(formData.paymentAmount)} style={{ flex: 1 }}>
                        {isSubmitting ? 'Processing...' : 'Confirm Renewal'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

export default function LicensesPage() {
    const {
        licenses,
        stats,
        revenueByPlan,
        isLoading,
        fetchLicenses,
        createLicense,
        renewLicense,
        suspendLicense,
        reactivateLicense,
        revokeLicense,
        getDaysUntilExpiry,
    } = useLicenses();

    const { plans } = usePlans();

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | LicenseStatus>('ALL');
    const [planFilter, setPlanFilter] = useState<string>('ALL');
    const [renewalModal, setRenewalModal] = useState<{ isOpen: boolean; licenseId: string; tenantName: string }>({
        isOpen: false,
        licenseId: '',
        tenantName: '',
    });
    const [revokeModal, setRevokeModal] = useState<{ isOpen: boolean; licenseId: string; tenantName: string }>({
        isOpen: false,
        licenseId: '',
        tenantName: '',
    });
    const [revokePw, setRevokePw] = useState('');
    const [isNewLicenseOpen, setIsNewLicenseOpen] = useState(false);

    // Filter licenses
    const filteredLicenses = licenses.filter(license => {
        const matchesSearch = (license.tenantName || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'ALL' || license.status === statusFilter;
        const matchesPlan = planFilter === 'ALL' || license.planType === planFilter;
        return matchesSearch && matchesStatus && matchesPlan;
    });

    const handleRenew = async (data: { durationMonths: number; paymentAmount: number; paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'QR' }) => {
        await renewLicense(renewalModal.licenseId, data);
        setRenewalModal({ isOpen: false, licenseId: '', tenantName: '' });
    };

    return (
        <DashboardLayout>
            <div style={{ padding: 'var(--space-8)' }}>
                    {/* Header */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 'var(--space-6)',
                    }}>
                        <div>
                            <h1 style={{
                                fontSize: '28px',
                                fontWeight: '600',
                                color: 'var(--notion-text)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-3)',
                            }}>
                                <Key size={28} />
                                Licenses
                            </h1>
                            <p style={{
                                fontSize: '14px',
                                color: 'var(--notion-text-secondary)',
                                marginTop: 'var(--space-1)',
                            }}>
                                Manage hotel licenses and subscriptions
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                            <Button variant="secondary" onClick={() => fetchLicenses()} disabled={isLoading}>
                                <RefreshCw size={14} style={{ marginRight: '6px' }} />
                                Refresh
                            </Button>
                            <Button onClick={() => setIsNewLicenseOpen(true)}>
                                <Plus size={14} style={{ marginRight: '6px' }} />
                                Grant Trial
                            </Button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                        gap: 'var(--space-4)',
                        marginBottom: 'var(--space-6)',
                    }}>
                        {[
                            { label: 'Total', value: stats.total, color: 'var(--notion-text)', icon: Key },
                            { label: 'Active', value: stats.active, color: 'var(--notion-green)', icon: CheckCircle },
                            { label: 'Trial', value: stats.trial, color: 'var(--notion-blue)', icon: Clock },
                            { label: 'Paused', value: stats.paused, color: 'var(--notion-yellow)', icon: AlertTriangle },
                            { label: 'Expired', value: stats.expired, color: 'var(--notion-red)', icon: XCircle },
                            { label: 'Revoked', value: stats.revoked, color: 'var(--notion-red)', icon: XCircle },
                        ].map(stat => {
                            const Icon = stat.icon;
                            return (
                                <div key={stat.label} style={{
                                    backgroundColor: 'var(--notion-bg-secondary)',
                                    borderRadius: 'var(--radius-lg)',
                                    border: '1px solid var(--notion-border)',
                                    padding: 'var(--space-4)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-3)',
                                }}>
                                    <Icon size={20} style={{ color: stat.color }} />
                                    <div>
                                        <div style={{ fontSize: '20px', fontWeight: '600', color: stat.color }}>{stat.value}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>{stat.label}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Plan Distribution */}
                    <div style={{
                        display: 'flex',
                        gap: 'var(--space-4)',
                        marginBottom: 'var(--space-6)',
                        padding: 'var(--space-4)',
                        backgroundColor: 'var(--notion-bg-secondary)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--notion-border)',
                        flexWrap: 'wrap',
                    }}>
                        <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginRight: 'var(--space-2)' }}>
                            Plan Distribution:
                        </span>
                        {plans.map((plan, idx) => {
                            const config = getPlanConfig(idx);
                            const count = licenses.filter(l => l.planType === plan.code || l.planType === plan.name).length;
                            return (
                                <div key={plan.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        backgroundColor: config.color,
                                    }} />
                                    <span style={{ fontSize: '13px', color: 'var(--notion-text)' }}>
                                        {plan.name}: {count}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Filters */}
                    <div style={{
                        display: 'flex',
                        gap: 'var(--space-3)',
                        marginBottom: 'var(--space-6)',
                    }}>
                        <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
                            <Search size={16} style={{
                                position: 'absolute',
                                left: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--notion-text-secondary)',
                            }} />
                            <input
                                type="text"
                                placeholder="Search licenses..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px 10px 36px',
                                    fontSize: '14px',
                                    border: '1px solid var(--notion-border)',
                                    borderRadius: 'var(--radius-md)',
                                    backgroundColor: 'var(--notion-bg-secondary)',
                                    color: 'var(--notion-text)',
                                }}
                            />
                        </div>

                        <Select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value as 'ALL' | LicenseStatus)}
                            options={[
                                { value: 'ALL', label: 'All Status' },
                                { value: 'ACTIVE', label: 'Active' },
                                { value: 'TRIAL', label: 'Trial' },
                                { value: 'PAUSED', label: 'Paused' },
                                { value: 'SUSPENDED', label: 'Suspended' },
                                { value: 'EXPIRED', label: 'Expired' },
                                { value: 'REVOKED', label: 'Revoked' },
                            ]}
                        />

                        <Select
                            value={planFilter}
                            onChange={e => setPlanFilter(e.target.value)}
                            options={[
                                { value: 'ALL', label: 'All Plans' },
                                ...plans.map(plan => ({ value: plan.code, label: plan.name })),
                            ]}
                        />
                    </div>

                    {/* Licenses Grid */}
                    {isLoading ? (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                            gap: 'var(--space-4)',
                        }}>
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} style={{
                                    height: '280px',
                                    backgroundColor: 'var(--notion-bg-secondary)',
                                    borderRadius: 'var(--radius-lg)',
                                    border: '1px solid var(--notion-border)',
                                    animation: 'pulse 1.5s ease-in-out infinite',
                                }} />
                            ))}
                        </div>
                    ) : filteredLicenses.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: 'var(--space-12)',
                            color: 'var(--notion-text-secondary)',
                        }}>
                            <Key size={48} style={{ opacity: 0.3, marginBottom: 'var(--space-4)' }} />
                            <p style={{ fontSize: '16px' }}>
                                {searchQuery || statusFilter !== 'ALL' || planFilter !== 'ALL'
                                    ? 'No licenses match your filters'
                                    : 'No licenses yet'}
                            </p>
                        </div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                            gap: 'var(--space-4)',
                        }}>
                            {filteredLicenses.map((license, idx) => {
                                // Find matching plan index for color
                                const planIdx = plans.findIndex(p => p.code === license.planType || p.name === license.planType);
                                return (
                                    <LicenseCard
                                        key={license.id}
                                        license={license}
                                        daysUntilExpiry={getDaysUntilExpiry(license.expiryDate)}
                                        onRenew={() => setRenewalModal({ isOpen: true, licenseId: license.id, tenantName: license.tenantName })}
                                        onSuspend={() => suspendLicense(license.id)}
                                        onReactivate={() => reactivateLicense(license.id)}
                                        onRevoke={() => setRevokeModal({ isOpen: true, licenseId: license.id, tenantName: license.tenantName })}
                                        planConfigIndex={planIdx >= 0 ? planIdx : 0}
                                    />
                                );
                            })}
                        </div>
                    )}
            </div>

            {/* Renewal Modal */}
            <RenewalModal
                isOpen={renewalModal.isOpen}
                onClose={() => setRenewalModal({ isOpen: false, licenseId: '', tenantName: '' })}
                onSubmit={handleRenew}
                tenantName={renewalModal.tenantName}
            />

            {/* Revoke Confirm Modal */}
            {revokeModal.licenseId && (
                <Modal isOpen={revokeModal.isOpen} onClose={() => setRevokeModal({ isOpen: false, licenseId: '', tenantName: '' })} title={`Revoke License - ${revokeModal.tenantName}`}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)' }}>
                            Are you sure you want to <strong style={{ color: 'var(--notion-red)' }}>revoke</strong> this license? This will immediately stop all operations for this hotel. This action cannot be undone from the UI.
                        </p>
                        <div>
                            <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>Confirm your password</label>
                            <Input type="password" value={revokePw} onChange={e => setRevokePw(e.target.value)} placeholder="Your password" fullWidth />
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                            <Button variant="secondary" onClick={() => { setRevokeModal({ isOpen: false, licenseId: '', tenantName: '' }); setRevokePw(''); }} style={{ flex: 1 }}>Cancel</Button>
                            <Button
                                disabled={!revokePw}
                                onClick={async () => {
                                    await revokeLicense(revokeModal.licenseId, revokePw);
                                    setRevokeModal({ isOpen: false, licenseId: '', tenantName: '' });
                                    setRevokePw('');
                                }}
                                style={{ flex: 1, backgroundColor: 'var(--notion-red)', color: 'var(--foreground-inverse)' }}
                            >
                                Revoke License
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Grant Trial Modal */}
            <Modal isOpen={isNewLicenseOpen} onClose={() => setIsNewLicenseOpen(false)} title="Grant Trial License">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)' }}>
                        Select a tenant to grant a 14-day trial license. They will be able to use all features during the trial period.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        {licenses.filter(l => l.status !== 'ACTIVE').length === 0 ? (
                            <p style={{ textAlign: 'center', color: 'var(--notion-text-muted)', padding: 'var(--space-4)' }}>
                                All tenants already have active licenses.
                            </p>
                        ) : (
                            licenses.filter(l => l.status !== 'ACTIVE').map(license => (
                                <Button
                                    key={license.id}
                                    variant="secondary"
                                    style={{ justifyContent: 'flex-start' }}
                                    onClick={async () => {
                                        await createLicense({ tenantId: license.tenantId, planType: 'BASIC', durationMonths: 1 });
                                        setIsNewLicenseOpen(false);
                                    }}
                                >
                                    <Building2 size={16} style={{ marginRight: '8px' }} />
                                    {license.tenantName}
                                </Button>
                            ))
                        )}
                    </div>
                    <Button variant="secondary" onClick={() => setIsNewLicenseOpen(false)} style={{ marginTop: 'var(--space-2)' }}>
                        Cancel
                    </Button>
                </div>
            </Modal>
        </DashboardLayout>
    );
}
