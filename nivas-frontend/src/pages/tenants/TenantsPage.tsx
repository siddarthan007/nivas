'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useTenants } from '@/lib/hooks/useTenants';
import { usePlans } from '@/lib/hooks/usePlans';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ImageUpload from '@/components/ui/ImageUpload';
import CustomDatePicker from '@/components/ui/DatePicker';
import Select from '@/components/ui/Select';
import {
    Building2,
    Plus,
    RefreshCw,
    Search,
    Mail,
    Phone,
    Calendar,
    MapPin,
    ToggleLeft,
    ToggleRight,
    Edit,
    Crown,
    MoreVertical,
    History,
    CreditCard,
    Users,
    Key,
    Clock,
    CheckCircle,
    X,
    Loader2,
    Eye,
    DollarSign,
    Bell,
    AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import DatePicker from '../../components/ui/DatePicker';
import ChangePasswordModal from '@/components/modals/ChangePasswordModal';
import { useAuth } from '@/lib/contexts/AuthContext'; // Maybe useful for manage users if needed or just use api

// Manage Users Modal
function ManageUsersModal({ isOpen, onClose, tenant }: any) {
    const [users, setUsers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // For password reset
    const [resetUser, setResetUser] = useState<{ id: string, name: string } | null>(null);

    // Fetch users when modal opens
    useEffect(() => {
        if (isOpen && tenant?.id) {
            fetchUsers();
        }
    }, [isOpen, tenant]);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const res = await api.get<any[]>(`/saas-admin/tenants/${tenant.id}/users`);
            setUsers(res.data || []);
        } catch (err: any) {
            toast.error(err.message || 'Failed to fetch users');
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmReset = async (newPassword: string) => {
        if (!resetUser) return;
        try {
            await api.patch(`/saas-admin/tenants/${tenant.id}/users/${resetUser.id}/password`, { password: newPassword });
            toast.success(`Password reset for ${resetUser.name}`);
            setResetUser(null);
        } catch (err: any) {
            toast.error(err.message || 'Failed to reset password');
            throw err; // Re-throw so modal knows it failed if checking
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Users: ${tenant?.name}`}>
            <div style={{ padding: 'var(--space-2)' }}>
                <div style={{ marginBottom: '16px' }}>
                    <p style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                        Manage staff accounts for this tenant.
                    </p>
                </div>

                {isLoading ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>Loading users...</div>
                ) : users.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--notion-text-secondary)', border: '1px dashed var(--notion-border)', borderRadius: 'var(--radius-md)' }}>
                        No users found.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {users.map(u => (
                            <div key={u.id} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '12px',
                                backgroundColor: 'var(--notion-bg-secondary)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--notion-border)'
                            }}>
                                <div>
                                    <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--notion-text)' }}>{u.fullName}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>
                                        {u.email} • <span style={{ textTransform: 'capitalize' }}>{u.role?.name?.toLowerCase() || 'No Role'}</span>
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => setResetUser({ id: u.id, name: u.fullName })}
                                    title="Reset Password"
                                >
                                    <Key size={14} />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Custom Admin Password Reset Modal */}
            <ChangePasswordModal
                isOpen={!!resetUser}
                onClose={() => setResetUser(null)}
                isAdminReset={true}
                userName={resetUser?.name}
                onSubmit={handleConfirmReset}
            />
        </Modal>
    );
}

// Tenant Card Component
function TenantCard({
    tenant,
    onToggleStatus,
    onEdit,
    onMoreActions
}: {
    tenant: any;
    onToggleStatus: () => void;
    onEdit: () => void;
    onMoreActions: (action: string) => void;
}) {
    const isExpiringSoon = tenant.licenseExpiry && (() => {
        const expiry = new Date(tenant.licenseExpiry);
        const now = new Date();
        const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays > 0 && diffDays <= 30;
    })();

    const expiryDate = tenant.licenseExpiry ? new Date(tenant.licenseExpiry) : null;
    const isExpired = expiryDate && expiryDate < new Date();

    // Brief storage usage shown on the card (server-cached, so cheap on re-render).
    const [usage, setUsage] = useState<{ database: { totalRows: number }; storage: { pretty: string } } | null>(null);
    const [logoError, setLogoError] = useState(false);
    useEffect(() => {
        let alive = true;
        api.get<any>(`/saas-admin/tenants/${tenant.id}/usage`).then(r => { if (alive) setUsage(r.data); }).catch(() => {});
        return () => { alive = false; };
    }, [tenant.id]);

    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--notion-border)',
            padding: 'var(--space-5)',
            opacity: tenant.isActive ? 1 : 0.6,
            transition: 'all 0.2s ease',
            position: 'relative',
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
                        backgroundColor: 'var(--notion-blue-bg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--notion-blue)',
                        overflow: 'hidden',
                    }}>
                        {tenant.logoUrl && !logoError ? (
                            <img
                                src={tenant.logoUrl}
                                alt={tenant.name || 'logo'}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={() => setLogoError(true)}
                            />
                        ) : (
                            <Building2 size={22} />
                        )}
                    </div>
                    <div>
                        <div style={{
                            fontSize: '15px',
                            fontWeight: '600',
                            color: 'var(--notion-text)',
                        }}>
                            {tenant.name || 'Untitled Hotel'}
                        </div>
                        <div style={{
                            fontSize: '12px',
                            color: 'var(--notion-text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            <span>/{tenant?.slug?.replace(/^\/+/, '') || 'no-slug'}</span>
                        </div>
                        {usage && (
                            <div style={{ fontSize: '11px', color: 'var(--notion-text-muted)', marginTop: '3px' }}>
                                {usage.database.totalRows.toLocaleString()} records · {usage.storage.pretty} files
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '4px' }}>
                    {/* Status Badge */}
                    <span style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '11px',
                        fontWeight: '500',
                        backgroundColor: tenant.isActive ? 'var(--notion-green-bg)' : 'var(--notion-red-bg)',
                        color: tenant.isActive ? 'var(--notion-green)' : 'var(--notion-red)',
                        display: 'flex',
                        alignItems: 'center',
                        height: '24px'
                    }}>
                        {tenant.isActive ? 'Active' : 'Inactive'}
                    </span>
                </div>
            </div>

            {/* Details */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
                marginBottom: 'var(--space-4)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                    <Mail size={14} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tenant.email || 'No email provided'}
                    </span>
                </div>
                {tenant.address && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                        <MapPin size={14} style={{ flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tenant.address}
                        </span>
                    </div>
                )}
            </div>

            {/* Plan & License */}
            <div style={{
                display: 'flex',
                gap: 'var(--space-4)',
                marginBottom: 'var(--space-4)',
                padding: 'var(--space-3)',
                backgroundColor: 'var(--notion-bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                justifyContent: 'space-between',
                flexDirection: 'column'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: "space-between", fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Crown size={14} style={{ color: 'var(--notion-orange)' }} />
                        <span style={{ color: 'var(--notion-text)', fontWeight: '500' }}>
                            {tenant.planType || 'No Plan'}
                        </span>
                    </div>
                    <button onClick={() => onMoreActions('PAYMENT')} style={{ fontSize: '10px', color: 'var(--notion-blue)', background: 'none', border: 'none', cursor: 'pointer' }}>
                        Record Pay
                    </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: "space-between", fontSize: '12px', borderTop: '1px dashed var(--notion-border)', paddingTop: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={14} style={{ color: isExpired || isExpiringSoon ? 'var(--notion-red)' : 'var(--notion-text-secondary)' }} />
                        <span style={{
                            color: isExpired || isExpiringSoon ? 'var(--notion-red)' : 'var(--notion-text-secondary)',
                            fontWeight: isExpired || isExpiringSoon ? '500' : '400'
                        }}>
                            {expiryDate ? expiryDate.toLocaleDateString() : 'Lifetime'}
                        </span>
                    </div>
                    <button onClick={() => onMoreActions('EXTEND')} style={{ fontSize: '10px', color: 'var(--notion-blue)', background: 'none', border: 'none', cursor: 'pointer' }}>
                        Extend
                    </button>
                </div>
            </div>

            {/* Actions Row 1 */}
            <div style={{
                display: 'flex',
                gap: 'var(--space-2)',
                borderTop: '1px solid var(--notion-divider)',
                paddingTop: 'var(--space-3)',
            }}>
                <Button size="sm" variant="secondary" onClick={onToggleStatus} style={{ flex: 1 }} title={tenant.isActive ? "Pause License" : "Resume License"}>
                    {tenant.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                </Button>
                <Button size="sm" variant="secondary" onClick={onEdit} style={{ flex: 1 }} title="Edit Details">
                    <Edit size={14} />
                </Button>
                <Button size="sm" variant="secondary" onClick={() => onMoreActions('USERS')} style={{ flex: 1 }} title="Manage Users">
                    <Users size={14} />
                </Button>
                <Button size="sm" variant="secondary" onClick={() => window.location.href = '/admin/licenses'} style={{ flex: 1 }} title="Manage License">
                    <Key size={14} />
                </Button>
            </div>
            {/* Actions Row 2 */}
            <div style={{
                display: 'flex',
                gap: 'var(--space-2)',
                paddingTop: 'var(--space-2)',
            }}>
                <Button size="sm" variant="secondary" onClick={() => onMoreActions('FINANCES')} style={{ flex: 1 }} title="View Payment History">
                    <DollarSign size={14} style={{ marginRight: '4px' }} />
                    <span style={{ fontSize: '11px' }}>Finances</span>
                </Button>
                <Button size="sm" onClick={() => onMoreActions('IMPERSONATE')} style={{ flex: 1, backgroundColor: 'var(--notion-blue)', color: 'var(--foreground-inverse)' }} title="View Dashboard as Hotel Owner">
                    <Eye size={14} style={{ marginRight: '4px' }} />
                    <span style={{ fontSize: '11px' }}>View as Owner</span>
                </Button>
                <Button size="sm" variant="secondary" onClick={() => onMoreActions('NOTIFY_EXPIRY')} style={{ flex: 'none', color: 'var(--notion-orange)' }} title="Send Expiry Notification">
                    <Bell size={14} />
                </Button>
            </div>
        </div>
    );
}

// Create/Edit Tenant Modal
function TenantFormModal({
    isOpen,
    onClose,
    onSubmit,
    initialData,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    initialData?: any;
}) {

    const { plans, isLoading: isPlansLoading } = usePlans();
    const isEdit = !!initialData;

    const [formData, setFormData] = useState<{
        name: string;
        slug: string;
        ownerName: string;
        email: string;
        phone: string;
        address: string;
        website: string;
        logoUrl: string;
        panNumber: string;
        vatNumber: string;
        serviceChargeRate: string;
        taxRate: string;
        maxRooms: string;
        maxUsers: string;
        planType: string;
        packageId: number | null;
        ownerPassword: string;
        licenseDuration: string;
    }>({ name: '', slug: '', ownerName: '', email: '', phone: '', address: '', website: '', logoUrl: '', panNumber: '', vatNumber: '', serviceChargeRate: '10', taxRate: '13', maxRooms: '50', maxUsers: '10', planType: '', packageId: null, ownerPassword: '', licenseDuration: 'trial' });

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name || '',
                slug: initialData.slug || '',
                ownerName: initialData.ownerName || '',
                email: initialData.email || '',
                phone: initialData.phone || '',
                address: initialData.address || '',
                website: initialData.website || '',
                logoUrl: initialData.logoUrl || '',
                panNumber: initialData.panNumber || '',
                vatNumber: initialData.vatNumber || '',
                // Stored as decimals (0.10); show as percent (10) in the % field.
                serviceChargeRate: String(Math.round((Number(initialData.serviceChargeRate ?? 0.10)) * 1000) / 10),
                taxRate: String(Math.round((Number(initialData.taxRate ?? 0.13)) * 1000) / 10),
                maxRooms: String(initialData.maxRooms ?? '50'),
                maxUsers: String(initialData.maxUsers ?? '10'),
                planType: initialData.planType || '',
                packageId: null,
                ownerPassword: '',
                licenseDuration: 'trial',
            });
        } else {
            setFormData({ name: '', slug: '', ownerName: '', email: '', phone: '', address: '', website: '', logoUrl: '', panNumber: '', vatNumber: '', serviceChargeRate: '10', taxRate: '13', maxRooms: '50', maxUsers: '10', planType: '', packageId: null, ownerPassword: '', licenseDuration: 'trial' });
        }
    }, [initialData, isOpen]);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const payload: any = { ...formData };
            // Map license duration to billingCycle or trialDays
            const durationMap: Record<string, number> = { trial: 14, '1year': 365, '2year': 730, '3year': 1095 };
            const cycleMap: Record<string, 'MONTHLY' | 'ANNUAL' | '2_YEAR' | '3_YEAR'> = {
                trial: 'MONTHLY', '1year': 'ANNUAL', '2year': '2_YEAR', '3year': '3_YEAR'
            };
            if (!isEdit && payload.licenseDuration) {
                if (payload.licenseDuration === 'trial') {
                    payload.trialDays = durationMap[payload.licenseDuration] || 14;
                } else {
                    payload.billingCycle = cycleMap[payload.licenseDuration] || 'MONTHLY';
                }
            }
            delete payload.licenseDuration;
            if (!payload.ownerPassword) delete payload.ownerPassword;
            if (!payload.packageId) delete payload.packageId;
            // Convert numeric string fields to numbers; keep decimal fields as strings
            payload.maxRooms = payload.maxRooms ? parseInt(payload.maxRooms, 10) : undefined;
            payload.maxUsers = payload.maxUsers ? parseInt(payload.maxUsers, 10) : undefined;
            payload.serviceChargeRate = payload.serviceChargeRate || '10';
            payload.taxRate = payload.taxRate || '13';
            // Rate fields are always sent as percent strings (e.g. '10'); backend normalizes.
            await onSubmit(payload);
            if (!isEdit) setFormData({ name: '', slug: '', ownerName: '', email: '', phone: '', address: '', website: '', logoUrl: '', panNumber: '', vatNumber: '', serviceChargeRate: '10', taxRate: '13', maxRooms: '50', maxUsers: '10', planType: '', packageId: null, ownerPassword: '', licenseDuration: 'trial' });
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleNameChange = (name: string) => {
        if (!isEdit) {
            const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            setFormData(prev => ({ ...prev, name, slug }));
        } else {
            setFormData(prev => ({ ...prev, name }));
        }
    };

    const activePlans = plans.filter(p => p.isActive);
    const planOptions = activePlans.map(p => ({ value: p.code, label: `${p.name} (NPR ${parseFloat(p.monthlyPrice || '0').toLocaleString()}/mo)` }));

    const handlePlanChange = (planCode: string) => {
        const selected = activePlans.find(p => p.code === planCode);
        setFormData(prev => ({
            ...prev,
            planType: planCode,
            packageId: selected?.id || null,
            maxRooms: selected?.maxRooms ? String(selected.maxRooms) : prev.maxRooms,
            maxUsers: selected?.maxUsers ? String(selected.maxUsers) : prev.maxUsers,
        }));
    };

    const labelStyle = { fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' } as const;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? "Edit Tenant Details" : "Onboard New Tenant"}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxHeight: '70vh', overflowY: 'auto', paddingRight: 'var(--space-2)' }}>
                {/* Section: Hotel Details */}
                <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--notion-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-1)' }}>Hotel Details</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <div>
                        <label style={labelStyle}>Hotel Name *</label>
                        <Input value={formData.name} onChange={(e: any) => handleNameChange(e.target.value)} required placeholder="Everest Grand Hotel" />
                    </div>
                    <div>
                        <label style={labelStyle}>Slug *</label>
                        <Input value={formData.slug} onChange={(e: any) => setFormData({ ...formData, slug: e.target.value })} required disabled={isEdit} placeholder="everest-grand" />
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <div>
                        <label style={labelStyle}>Website</label>
                        <Input type="url" value={formData.website} onChange={(e: any) => setFormData({ ...formData, website: e.target.value })} placeholder="https://hotel.com" />
                    </div>
                    <div>
                        <label style={labelStyle}>Logo</label>
                        <ImageUpload value={formData.logoUrl} onChange={(url: string | null) => setFormData({ ...formData, logoUrl: url || '' })} />
                    </div>
                </div>
                <div>
                    <label style={labelStyle}>Address</label>
                    <Input value={formData.address} onChange={(e: any) => setFormData({ ...formData, address: e.target.value })} placeholder="Kathmandu, Nepal" />
                </div>

                {/* Section: Admin Account */}
                <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--notion-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>Admin Account</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <div>
                        <label style={labelStyle}>Admin Name *</label>
                        <Input value={formData.ownerName} onChange={(e: any) => setFormData({ ...formData, ownerName: e.target.value })} required placeholder="Ram Sharma" />
                    </div>
                    <div>
                        <label style={labelStyle}>Phone</label>
                        <Input value={formData.phone} onChange={(e: any) => setFormData({ ...formData, phone: e.target.value })} placeholder="98XXXXXXXX" />
                    </div>
                </div>
                <div>
                    <label style={labelStyle}>{isEdit ? 'Admin Email (Read-Only)' : 'Admin Email *'}</label>
                    <Input type="email" value={formData.email} onChange={(e: any) => setFormData({ ...formData, email: e.target.value })} required disabled={isEdit} placeholder="admin@hotel.com" />
                </div>
                {!isEdit && (
                    <div>
                        <label style={labelStyle}>Admin Password *</label>
                        <Input type="password" value={formData.ownerPassword} onChange={(e: any) => setFormData({ ...formData, ownerPassword: e.target.value })} placeholder="Min 8 characters" required />
                    </div>
                )}

                {/* Section: Business & Tax (shown for both onboard + edit) */}
                {(
                    <>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--notion-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>Business & Tax</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                            <div>
                                <label style={labelStyle}>PAN Number</label>
                                <Input value={formData.panNumber} onChange={(e: any) => setFormData({ ...formData, panNumber: e.target.value })} placeholder="302415654" />
                            </div>
                            <div>
                                <label style={labelStyle}>VAT Number</label>
                                <Input value={formData.vatNumber} onChange={(e: any) => setFormData({ ...formData, vatNumber: e.target.value })} placeholder="123456789" />
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                            <div>
                                <label style={labelStyle}>Service Charge (%)</label>
                                <Input type="number" value={formData.serviceChargeRate} onChange={(e: any) => setFormData({ ...formData, serviceChargeRate: e.target.value })} placeholder="10" />
                            </div>
                            <div>
                                <label style={labelStyle}>Tax Rate (%)</label>
                                <Input type="number" value={formData.taxRate} onChange={(e: any) => setFormData({ ...formData, taxRate: e.target.value })} placeholder="13" />
                            </div>
                        </div>
                    </>
                )}

                {/* Section: Plan & Limits */}
                <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--notion-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>Plan & Limits</div>
                <div>
                    <label style={labelStyle}>Subscription Plan</label>
                    <Select value={formData.planType} onChange={(e: any) => handlePlanChange(e.target.value)} options={[{ value: '', label: 'Select Plan...' }, ...planOptions]} />
                </div>
                {!isEdit && (
                    <div>
                        <label style={labelStyle}>License Duration</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)' }}>
                            {[
                                { value: 'trial', label: 'Trial (14d)', color: 'var(--notion-orange)' },
                                { value: '1year', label: '1 Year', color: 'var(--notion-green)' },
                                { value: '2year', label: '2 Years', color: 'var(--notion-blue)' },
                                { value: '3year', label: '3 Years', color: 'var(--notion-purple, #9B6FC3)' },
                            ].map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, licenseDuration: opt.value }))}
                                    style={{
                                        padding: '8px 4px',
                                        borderRadius: 'var(--radius-md)',
                                        border: formData.licenseDuration === opt.value ? `2px solid ${opt.color}` : '1px solid var(--notion-border)',
                                        backgroundColor: formData.licenseDuration === opt.value ? 'var(--notion-bg-tertiary)' : 'transparent',
                                        color: formData.licenseDuration === opt.value ? opt.color : 'var(--notion-text-secondary)',
                                        fontSize: '12px',
                                        fontWeight: formData.licenseDuration === opt.value ? '600' : '400',
                                        cursor: 'pointer',
                                        transition: 'all 150ms ease',
                                    }}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <div>
                        <label style={labelStyle}>Max Rooms</label>
                        <Input type="number" value={formData.maxRooms} onChange={(e: any) => setFormData({ ...formData, maxRooms: e.target.value })} placeholder="50" />
                    </div>
                    <div>
                        <label style={labelStyle}>Max Users</label>
                        <Input type="number" value={formData.maxUsers} onChange={(e: any) => setFormData({ ...formData, maxUsers: e.target.value })} placeholder="10" />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting || (!isEdit && !formData.ownerPassword)} style={{ flex: 1 }}>
                        {isSubmitting ? 'Saving...' : (isEdit ? 'Update' : 'Onboard Hotel')}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

// Extension Modal
function ExtendLicenseModal({ isOpen, onClose, tenant, onExtend }: any) {
    const [days, setDays] = useState<number | ''>(30);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        await onExtend(tenant.id, Number(days));
        setIsSubmitting(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Extend License: ${tenant?.name}`}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>Days to Extend *</label>
                    <Input
                        type="number"
                        value={days}
                        onChange={(e: any) => {
                            const val = e.target.value;
                            setDays(val === '' ? '' : Number(val));
                        }}
                        required
                        min={1}
                    />
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting || !days || days <= 0 || (typeof days === 'number' && isNaN(days))} style={{ flex: 1 }}>Confirm Extension</Button>
                </div>
            </form>
        </Modal>
    );
}

// Payment Modal
function PaymentModal({ isOpen, onClose, tenant, onRecord }: any) {
    const { plans } = usePlans();
    const [amount, setAmount] = useState<number | ''>('');
    const [cycle, setCycle] = useState('MONTHLY');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<any>(null);

    useEffect(() => {
        if (!isOpen) setResult(null);
    }, [isOpen]);

    // Auto-fill amount based on tenant plan
    useEffect(() => {
        if (tenant?.planType && plans.length > 0) {
            const plan = plans.find((p: any) => p.code === tenant.planType);
            if (plan) {
                if (cycle === 'MONTHLY') setAmount(parseFloat(plan.monthlyPrice));
                if (cycle === 'ANNUAL' && plan.annualPrice) setAmount(parseFloat(plan.annualPrice));
            }
        }
    }, [tenant, cycle, plans]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const plan = plans.find((p: any) => p.code === tenant.planType);
        const paymentResult = await onRecord(tenant.id, Number(amount), cycle, plan?.id);
        setIsSubmitting(false);
        if (paymentResult) {
            setResult(paymentResult);
        }
    };

    const handleDownloadInvoice = () => {
        if (result?.id) {
            window.open(`/api/v1/saas-billing/payments/${result.id}/pdf`, '_blank');
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Record Payment: ${tenant?.name}`}>
            {result ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', alignItems: 'center', padding: 'var(--space-4)' }}>
                    <div style={{ fontSize: '48px', color: 'var(--notion-green)' }}>✓</div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--notion-text)' }}>Payment Recorded</div>
                    <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', textAlign: 'center' }}>
                        Invoice <strong style={{ color: 'var(--notion-text)' }}>{result.invoiceNumber}</strong> generated.<br />
                        License active until {result.periodEnd ? new Date(result.periodEnd).toLocaleDateString() : 'N/A'}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-3)', width: '100%' }}>
                        <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>Close</Button>
                        <Button type="button" onClick={handleDownloadInvoice} style={{ flex: 1 }}>Download Invoice</Button>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>Amount (NPR) *</label>
                        <Input type="number" value={amount} onChange={(e: any) => setAmount(e.target.value === '' ? '' : Number(e.target.value))} required min={1} />
                    </div>
                    <div>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>Billing Cycle</label>
                        <Select value={cycle} onChange={(e: any) => setCycle(e.target.value)} options={[{ value: 'MONTHLY', label: 'Monthly' }, { value: 'ANNUAL', label: 'Annual' }]} />
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                        <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting || !amount || amount <= 0 || (typeof amount === 'number' && isNaN(amount))} style={{ flex: 1 }}>Record Payment</Button>
                    </div>
                </form>
            )}
        </Modal>
    );
}


// Platform-wide SMS / Email gateway shared by all tenants (super-admin).
function PlatformMessagingPanel() {
    const [open, setOpen] = useState(false);
    const [sms, setSms] = useState({ provider: '', senderId: '', apiKey: '', apiSecret: '' });
    const [email, setEmail] = useState({ smtpHost: '', smtpPort: 587, smtpUser: '', smtpFromEmail: '', smtpFromName: '', smtpPassword: '' });
    const [flags, setFlags] = useState({ apiKeySet: false, smtpPasswordSet: false });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        api.get<any>('/saas-admin/platform-messaging').then(r => {
            const d = r.data; if (!d) return;
            setSms(s => ({ ...s, provider: d.sms?.provider || '', senderId: d.sms?.senderId || '' }));
            setEmail(e => ({ ...e, smtpHost: d.email?.smtpHost || '', smtpPort: d.email?.smtpPort || 587, smtpUser: d.email?.smtpUser || '', smtpFromEmail: d.email?.smtpFromEmail || '', smtpFromName: d.email?.smtpFromName || '' }));
            setFlags({ apiKeySet: !!d.sms?.apiKeySet, smtpPasswordSet: !!d.email?.smtpPasswordSet });
        }).catch(() => {});
    }, [open]);

    const save = async () => {
        setSaving(true);
        try {
            const payload: any = { sms: { provider: sms.provider, senderId: sms.senderId }, email: { smtpHost: email.smtpHost, smtpPort: email.smtpPort, smtpUser: email.smtpUser, smtpFromEmail: email.smtpFromEmail, smtpFromName: email.smtpFromName } };
            if (sms.apiKey) payload.sms.apiKey = sms.apiKey;
            if (sms.apiSecret) payload.sms.apiSecret = sms.apiSecret;
            if (email.smtpPassword) payload.email.smtpPassword = email.smtpPassword;
            await api.patch('/saas-admin/platform-messaging', payload);
            toast.success('Platform messaging saved');
            setSms(s => ({ ...s, apiKey: '', apiSecret: '' })); setEmail(e => ({ ...e, smtpPassword: '' }));
        } catch (e: any) { toast.error(e?.message || 'Failed'); } finally { setSaving(false); }
    };

    const inp: React.CSSProperties = { padding: '8px 10px', border: '1px solid var(--notion-border)', borderRadius: 6, background: 'var(--notion-bg)', color: 'var(--notion-text)', fontSize: 13, width: '100%' };

    return (
        <div style={{ marginBottom: 'var(--space-6)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-4)', background: 'var(--notion-bg-secondary)', border: 'none', cursor: 'pointer', color: 'var(--notion-text)', fontSize: 14, fontWeight: 600 }}>
                <span>Platform SMS & Email Gateway (shared by all tenants)</span>
                <span>{open ? '−' : '+'}</span>
            </button>
            {open && (
                <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <div style={{ fontSize: 12, color: 'var(--notion-text-muted)' }}>Default provider for every hotel. A hotel's own settings, if filled, override these.</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>SMS Gateway</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <select value={sms.provider} onChange={e => setSms({ ...sms, provider: e.target.value })} style={inp}>
                            <option value="">Select provider…</option><option value="SPARROW">Sparrow SMS</option><option value="AAKASH">Aakash SMS</option><option value="TWILIO">Twilio</option>
                        </select>
                        <input style={inp} placeholder="Sender ID" value={sms.senderId} onChange={e => setSms({ ...sms, senderId: e.target.value })} />
                        <input style={inp} type="password" placeholder={flags.apiKeySet ? '•••• (set)' : 'API key'} value={sms.apiKey} onChange={e => setSms({ ...sms, apiKey: e.target.value })} />
                        <input style={inp} type="password" placeholder="API secret (Twilio)" value={sms.apiSecret} onChange={e => setSms({ ...sms, apiSecret: e.target.value })} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Email (SMTP)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
                        <input style={inp} placeholder="SMTP host" value={email.smtpHost} onChange={e => setEmail({ ...email, smtpHost: e.target.value })} />
                        <input style={inp} type="number" placeholder="Port" value={email.smtpPort || ''} onChange={e => setEmail({ ...email, smtpPort: e.target.value === '' ? 0 : Number(e.target.value) })} />
                        <input style={inp} placeholder="SMTP username" value={email.smtpUser} onChange={e => setEmail({ ...email, smtpUser: e.target.value })} />
                        <input style={inp} type="password" placeholder={flags.smtpPasswordSet ? '•••• (set)' : 'SMTP password'} value={email.smtpPassword} onChange={e => setEmail({ ...email, smtpPassword: e.target.value })} />
                        <input style={inp} placeholder="From email" value={email.smtpFromEmail} onChange={e => setEmail({ ...email, smtpFromEmail: e.target.value })} />
                        <input style={inp} placeholder="From name" value={email.smtpFromName} onChange={e => setEmail({ ...email, smtpFromName: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Gateway'}</Button></div>
                </div>
            )}
        </div>
    );
}

export default function TenantsPage() {
    const {
        tenants, stats, isLoading, fetchTenants, createTenant, updateTenant,
        toggleTenantStatus, extendLicense, recordPayment,
        getPaymentHistory, impersonateOwner
    } = useTenants();

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingTenant, setEditingTenant] = useState<any>(undefined);

    // Action Modals
    const [extendModal, setExtendModal] = useState<{ isOpen: boolean, tenant: any }>({ isOpen: false, tenant: null });
    const [paymentModal, setPaymentModal] = useState<{ isOpen: boolean, tenant: any }>({ isOpen: false, tenant: null });
    const [usersModal, setUsersModal] = useState<{ isOpen: boolean, tenant: any }>({ isOpen: false, tenant: null });
    const [financesModal, setFinancesModal] = useState<{ isOpen: boolean, tenant: any, payments: any[] }>({ isOpen: false, tenant: null, payments: [] });

    useEffect(() => {
        fetchTenants();
    }, [fetchTenants]);

    const filteredTenants = tenants.filter(tenant => {
        const matchesSearch = (tenant.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            (tenant.email?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            (tenant.slug?.toLowerCase() || '').includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'ALL' ||
            (statusFilter === 'ACTIVE' && tenant.isActive) ||
            (statusFilter === 'INACTIVE' && !tenant.isActive);
        return matchesSearch && matchesStatus;
    });

    const handleCreateTenant = async (data: any) => {
        await createTenant(data);
        fetchTenants();
    };

    const handleEditTenant = async (data: any) => {
        if (editingTenant) {
            await updateTenant(editingTenant.id, data);
            fetchTenants();
        }
    };

    const handleMoreActions = async (tenant: any, action: string) => {
        if (action === 'EXTEND') setExtendModal({ isOpen: true, tenant });
        if (action === 'PAYMENT') setPaymentModal({ isOpen: true, tenant });
        if (action === 'USERS') setUsersModal({ isOpen: true, tenant });
        if (action === 'FINANCES') {
            // Fetch payment history and show modal
            const payments = await getPaymentHistory(tenant.id);
            setFinancesModal({ isOpen: true, tenant, payments });
        }
        if (action === 'NOTIFY_EXPIRY') {
            try {
                await api.post(`/saas-admin/tenants/${tenant.id}/notify-expiry`, {});
                toast.success(`Expiry notification sent to ${tenant.name}`);
            } catch {
                toast.error('Failed to send notification');
            }
        }
        if (action === 'IMPERSONATE') {
            toast.info('Switching to hotel owner view...');
            await impersonateOwner(tenant.id);
        }
    };

    const handleCheckAllLicenses = async () => {
        try {
            await api.post('/saas-admin/check-expiring-licenses', {});
            toast.success('License check completed — notifications sent to expiring hotels');
        } catch {
            toast.error('Failed to run license check');
        }
    };


    return (
        <DashboardLayout>
            <div style={{ padding: 'var(--space-8)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                    <div>
                        <h1 style={{ fontSize: '28px', fontWeight: '600', color: 'var(--notion-text)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <Building2 size={28} /> Tenants
                        </h1>
                        <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', marginTop: 'var(--space-1)' }}>Manage hotel properties</p>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                        <Button variant="secondary" onClick={handleCheckAllLicenses} title="Check all hotels for expiring licenses and send notifications">
                            <AlertTriangle size={14} style={{ marginRight: '6px' }} />Check Licenses
                        </Button>
                        <Button variant="secondary" onClick={() => fetchTenants()} disabled={isLoading}><RefreshCw size={14} style={{ marginRight: '6px' }} />Refresh</Button>
                        <Button onClick={() => { setEditingTenant(undefined); setIsFormOpen(true); }}><Plus size={14} style={{ marginRight: '6px' }} />Add Tenant</Button>
                    </div>
                </div>

                <PlatformMessagingPanel />

                {/* Stats */}
                <div style={{ display: 'flex', gap: 'var(--space-6)', marginBottom: 'var(--space-6)', padding: 'var(--space-4)', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)' }}>
                    {[
                        { label: 'Total', value: stats.total, color: 'var(--notion-text)' },
                        { label: 'Active', value: stats.active, color: 'var(--notion-green)' },
                        { label: 'Inactive', value: stats.inactive, color: 'var(--notion-red)' },
                        { label: 'Expiring', value: stats.expiringLicenses, color: 'var(--notion-orange)' },
                    ].map(stat => (
                        <div key={stat.label} style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '80px' }}>
                            <span style={{ fontSize: '24px', fontWeight: '700', color: stat.color, lineHeight: 1 }}>{stat.value}</span>
                            <span style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', fontWeight: '500' }}>{stat.label}</span>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
                    <div style={{ position: 'relative', flex: 1, maxWidth: '360px' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--notion-text-secondary)' }} />
                        <Input value={searchQuery} onChange={(e: any) => setSearchQuery(e.target.value)} placeholder="Search..." fullWidth style={{ paddingLeft: '36px' }} />
                    </div>
                    <Select value={statusFilter} onChange={(e: any) => setStatusFilter(e.target.value)} options={[{ value: 'ALL', label: 'All Status' }, { value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]} style={{ width: '150px' }} />
                </div>

                {/* Grid */}
                {isLoading ? <div>Loading...</div> : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--space-4)' }}>
                        {filteredTenants.map(tenant => (
                            <TenantCard
                                key={tenant.id}
                                tenant={tenant}
                                onToggleStatus={() => toggleTenantStatus(tenant.id)}
                                onEdit={() => { setEditingTenant(tenant); setIsFormOpen(true); }}
                                onMoreActions={(action) => handleMoreActions(tenant, action)}
                            />
                        ))}
                    </div>
                )}
            </div>

            <TenantFormModal isOpen={isFormOpen} onClose={() => { setIsFormOpen(false); setEditingTenant(undefined); }} onSubmit={editingTenant ? handleEditTenant : handleCreateTenant} initialData={editingTenant} />

            {extendModal.tenant && (
                <ExtendLicenseModal
                    isOpen={extendModal.isOpen}
                    onClose={() => setExtendModal({ isOpen: false, tenant: null })}
                    tenant={extendModal.tenant}
                    onExtend={extendLicense}
                />
            )}

            {paymentModal.tenant && (
                <PaymentModal
                    isOpen={paymentModal.isOpen}
                    onClose={() => setPaymentModal({ isOpen: false, tenant: null })}
                    tenant={paymentModal.tenant}
                    onRecord={recordPayment}
                />
            )}

            {usersModal.tenant && (
                <ManageUsersModal
                    isOpen={usersModal.isOpen}
                    onClose={() => setUsersModal({ isOpen: false, tenant: null })}
                    tenant={usersModal.tenant}
                />
            )}


            {/* View Finances Modal */}
            {financesModal.tenant && (
                <Modal
                    isOpen={financesModal.isOpen}
                    onClose={() => setFinancesModal({ isOpen: false, tenant: null, payments: [] })}
                    title={`Payment History: ${financesModal.tenant.name}`}
                    size="lg"
                >
                    <div style={{ minHeight: '200px' }}>
                        {financesModal.payments.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: 'var(--space-8)',
                                color: 'var(--notion-text-secondary)'
                            }}>
                                <DollarSign size={40} style={{ opacity: 0.3, marginBottom: 'var(--space-2)' }} />
                                <p>No payment records found</p>
                            </div>
                        ) : (
                            <>
                                {/* Summary */}
                                <div style={{
                                    display: 'flex',
                                    gap: 'var(--space-4)',
                                    marginBottom: 'var(--space-4)',
                                    padding: 'var(--space-4)',
                                    backgroundColor: 'var(--notion-bg-tertiary)',
                                    borderRadius: 'var(--radius-md)'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>Total Payments</div>
                                        <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--notion-green)' }}>
                                            NPR {financesModal.payments.reduce((sum: number, p: any) => sum + parseFloat(p.amount || '0'), 0).toLocaleString()}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>Records</div>
                                        <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--notion-text)' }}>
                                            {financesModal.payments.length}
                                        </div>
                                    </div>
                                </div>

                                {/* Payment Table */}
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                            <th style={{ textAlign: 'left', padding: '10px 8px', color: 'var(--notion-text-secondary)', fontWeight: '500' }}>Date</th>
                                            <th style={{ textAlign: 'right', padding: '10px 8px', color: 'var(--notion-text-secondary)', fontWeight: '500' }}>Amount</th>
                                            <th style={{ textAlign: 'left', padding: '10px 8px', color: 'var(--notion-text-secondary)', fontWeight: '500' }}>Cycle</th>
                                            <th style={{ textAlign: 'left', padding: '10px 8px', color: 'var(--notion-text-secondary)', fontWeight: '500' }}>Method</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {financesModal.payments.map((payment: any) => (
                                            <tr key={payment.id} style={{ borderBottom: '1px solid var(--notion-divider)' }}>
                                                <td style={{ padding: '10px 8px', color: 'var(--notion-text)' }}>
                                                    {new Date(payment.createdAt).toLocaleDateString()}
                                                </td>
                                                <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '500', color: 'var(--notion-green)' }}>
                                                    NPR {parseFloat(payment.amount).toLocaleString()}
                                                </td>
                                                <td style={{ padding: '10px 8px', color: 'var(--notion-text-secondary)' }}>
                                                    {payment.billingCycle || 'N/A'}
                                                </td>
                                                <td style={{ padding: '10px 8px', color: 'var(--notion-text-secondary)' }}>
                                                    {payment.paymentMethod || 'N/A'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </>
                        )}
                    </div>
                </Modal>
            )}
        </DashboardLayout>
    );
}
