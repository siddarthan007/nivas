'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/contexts/AuthContext';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useStaff } from '@/lib/hooks/useStaff';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { usePasswordConfirm } from '@/components/ui/usePasswordConfirm';
import Select from '@/components/ui/Select';
import SearchableSelect from '@/components/ui/SearchableSelect';
import DatePicker from '@/components/ui/DatePicker';
import Pagination from '@/components/ui/Pagination';
import { useHR } from '@/lib/hooks/useHR';
import { SkeletonList } from '@/components/ui/Skeleton';
import {
    Users,
    Plus,
    Search,
    Mail,
    Phone,
    Shield,
    MoreHorizontal,
    UserCog,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    DollarSign,
    Briefcase,
    Clock,
    Smartphone,
    X,
    RefreshCw
} from 'lucide-react';
import AttendancePage from './AttendancePage';
import type { CreateUserPayload, UpdateUserPayload, User } from '@/lib/types/api.types';

function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel,
    confirmColor,
    isLoading,
}: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel: string;
    confirmColor?: string;
    isLoading?: boolean;
}) {
    if (!isOpen) return null;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--notion-overlay)',
            }}
            onClick={onClose}
        >
            <div
                style={{
                    backgroundColor: 'var(--notion-bg)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--notion-border)',
                    padding: 'var(--space-6)',
                    maxWidth: '420px',
                    width: '90%',
                    boxShadow: 'var(--shadow-lg)',
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--notion-red-bg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                    }}>
                        <AlertTriangle size={20} style={{ color: 'var(--notion-red)' }} />
                    </div>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--notion-text)', margin: 0 }}>
                        {title}
                    </h3>
                </div>
                <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-5)', lineHeight: '1.5' }}>
                    {message}
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                    <Button 
                        variant="secondary" 
                        onClick={onClose} 
                        disabled={isLoading}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '10px 20px',
                            borderRadius: 'var(--radius-md)',
                            fontWeight: '500',
                            transition: 'all 0.2s ease',
                        }}
                    >
                        <X size={16} />
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={onConfirm}
                        disabled={isLoading}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '10px 24px',
                            borderRadius: 'var(--radius-md)',
                            fontWeight: '600',
                            transition: 'all 0.2s ease',
                            backgroundColor: confirmColor || 'var(--notion-red)',
                            borderColor: confirmColor || 'var(--notion-red)',
                            boxShadow: `0 4px 12px ${confirmColor ? confirmColor + '40' : 'rgba(239, 68, 68, 0.3)'}`,
                        }}
                    >
                        {isLoading ? (
                            <>
                                <RefreshCw size={16} className="animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 size={16} />
                                {confirmLabel}
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// Staff Form Modal
function StaffFormModal({
    isOpen,
    onClose,
    onSubmit,
    roles,
    initialData,
    currentUserLevel = 0
}: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<boolean>;
    roles: { id: number; name: string; level: number }[];
    initialData?: User | null;
    currentUserLevel?: number;
}) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<CreateUserPayload>({
        fullName: '',
        email: '',
        phone: '',
        password: '',
        roleId: 0
    });

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    fullName: initialData.fullName,
                    email: initialData.email,
                    phone: initialData.phone,
                    password: '', // Password not visible
                    roleId: initialData.role?.id || 0
                });
            } else {
                setFormData({
                    fullName: '',
                    email: '',
                    phone: '',
                    password: '',
                    roleId: roles?.[0]?.id ?? 0
                });
            }
        }
    }, [isOpen, initialData, roles]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.roleId || formData.roleId <= 0) {
            toast.error('Please select a valid role');
            return;
        }
        setLoading(true);
        try {
            const payload = { ...formData };
            if (initialData && !payload.password) {
                delete (payload as any).password;
            }
            const success = await onSubmit(payload);
            if (success) onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Edit Staff" : "Add New Staff"}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                    <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Full Name</label>
                    <Input
                        required
                        placeholder="John Doe"
                        value={formData.fullName}
                        onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                        icon={<UserCog size={14} />}
                    />
                </div>

                <div>
                    <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Email</label>
                    <Input
                        type="email"
                        required
                        placeholder="john@example.com"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        icon={<Mail size={14} />}
                        disabled={!!initialData}
                    />
                </div>

                <div>
                    <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Phone</label>
                    <Input
                        required
                        placeholder="9876543210"
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        icon={<Phone size={14} />}
                    />
                </div>

                <div>
                    <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Role</label>
                    <Select
                        value={formData.roleId.toString()}
                        onChange={e => setFormData({ ...formData, roleId: Number(e.target.value) })}
                        options={roles
                            .filter(r => r.level >= currentUserLevel)
                            .map(r => ({ value: r.id.toString(), label: `${r.name} (Level ${r.level})` }))}
                    />
                    {roles.some(r => r.level < currentUserLevel) && (
                        <p style={{ fontSize: '11px', color: 'var(--notion-text-muted)', marginTop: '4px' }}>
                            Higher-level roles are hidden based on your access level.
                        </p>
                    )}
                </div>

                {!initialData && (
                    <div>
                        <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Password</label>
                        <Input
                            type="password"
                            required
                            placeholder="******"
                            value={formData.password}
                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                        />
                    </div>
                )}

                {initialData && (
                    <div>
                        <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">New Password (leave blank to keep current)</label>
                        <Input
                            type="password"
                            placeholder="******"
                            value={formData.password}
                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                        />
                    </div>
                )}

                <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                    <Button 
                        variant="secondary" 
                        onClick={onClose} 
                        disabled={loading} 
                        type="button"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '10px 20px',
                            borderRadius: 'var(--radius-md)',
                            fontWeight: '500',
                            transition: 'all 0.2s ease',
                        }}
                    >
                        <X size={16} />
                        Cancel
                    </Button>
                    <Button 
                        variant="primary" 
                        type="submit" 
                        loading={loading}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '10px 24px',
                            borderRadius: 'var(--radius-md)',
                            fontWeight: '600',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
                        }}
                    >
                        {loading ? (
                            <>
                                <RefreshCw size={16} className="animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                {initialData ? (
                                    <>
                                        <UserCog size={16} />
                                        Update Staff
                                    </>
                                ) : (
                                    <>
                                        <Plus size={16} />
                                        Create Staff
                                    </>
                                )}
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

export default function StaffPage() {
    const { confirm: pwConfirm, modal: pwModal } = usePasswordConfirm();
    const { user } = useAuth();
    const { can } = usePermissions();
    const { users, roles, isLoading: isStaffLoading, fetchUsers, fetchRoles, createUser, updateUser, toggleUserStatus, deleteUser } = useStaff();
    const { payroll, isLoading: isPayrollLoading, generatePayroll, generatePayrollFromAttendance, previewPayrollFromAttendance, processPayment } = useHR();
    const currentUserRoleLevel = user?.role?.level ?? 0;
    
    const [activeTab, setActiveTab] = useState<'directory' | 'payroll' | 'attendance'>('directory');
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [confirmTarget, setConfirmTarget] = useState<User | null>(null);
    const [isToggling, setIsToggling] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageLimit, setPageLimit] = useState(20);

    const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);
    const [payrollMode, setPayrollMode] = useState<'manual' | 'attendance'>('manual');
    const [newPayroll, setNewPayroll] = useState({
        employeeId: '',
        periodStart: '',
        periodEnd: '',
        baseSalary: 0,
        deductions: 0,
        bonuses: 0
    });
    const [attendancePreview, setAttendancePreview] = useState<{
        daysPresent: number;
        totalHours: number;
        overtimeHours: number;
        regularPay: number;
        overtimePay: number;
        netPay: number;
    } | null>(null);

    useEffect(() => {
        if (
            payrollMode !== 'attendance'
            || !newPayroll.employeeId
            || !newPayroll.periodStart
            || !newPayroll.periodEnd
            || !newPayroll.baseSalary
        ) {
            setAttendancePreview(null);
            return;
        }
        previewPayrollFromAttendance({
            employeeId: newPayroll.employeeId,
            periodStart: newPayroll.periodStart,
            periodEnd: newPayroll.periodEnd,
            monthlyBaseSalary: newPayroll.baseSalary,
            deductions: newPayroll.deductions,
        })
            .then(data => setAttendancePreview(data || null))
            .catch(() => setAttendancePreview(null));
    }, [payrollMode, newPayroll.employeeId, newPayroll.periodStart, newPayroll.periodEnd, newPayroll.baseSalary, newPayroll.deductions, previewPayrollFromAttendance]);

    useEffect(() => {
        fetchUsers();
        fetchRoles();
    }, []);

    const handleEdit = (user: User) => {
        setSelectedUser(user);
        setIsModalOpen(true);
    };

    const handleAddNew = () => {
        setSelectedUser(null);
        setIsModalOpen(true);
    };

    const handleGeneratePayroll = async (e: React.FormEvent) => {
        e.preventDefault();
        if (payrollMode === 'attendance') {
            await generatePayrollFromAttendance({
                employeeId: newPayroll.employeeId,
                periodStart: newPayroll.periodStart,
                periodEnd: newPayroll.periodEnd,
                monthlyBaseSalary: newPayroll.baseSalary,
                deductions: newPayroll.deductions,
            });
        } else {
            await generatePayroll(newPayroll);
        }
        setIsPayrollModalOpen(false);
        setPayrollMode('manual');
        setNewPayroll({ employeeId: '', periodStart: '', periodEnd: '', baseSalary: 0, deductions: 0, bonuses: 0 });
    };

    const handleToggleStatus = (user: User) => {
        setConfirmTarget(user);
    };

    const handleConfirmToggle = async () => {
        if (!confirmTarget) return;
        setIsToggling(true);
        await toggleUserStatus(confirmTarget.id, !confirmTarget.isActive);
        setIsToggling(false);
        setConfirmTarget(null);
    };

    const handleDelete = (user: User) => {
        setDeleteTarget(user);
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        await deleteUser(deleteTarget.id);
        setIsDeleting(false);
        setDeleteTarget(null);
    };

    const filteredUsers = users.filter(u =>
        (u.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.role?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalPages = Math.ceil(filteredUsers.length / pageLimit);
    const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageLimit, currentPage * pageLimit);

    return (
        <>
            {pwModal}
            <div style={{ padding: 'var(--space-8)' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                    <div>
                        <h1 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: '24px', fontWeight: '600', color: 'var(--notion-text)' }}>
                            <Users size={28} />
                            HR & Staff Management
                        </h1>
                        <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', marginTop: '4px' }}>
                            Manage employees, roles, access, and payroll.
                        </p>
                    </div>
                    <div>
                        {activeTab === 'directory' ? (
                            <Button onClick={handleAddNew} variant="primary">
                                <Plus size={14} style={{ marginRight: '8px' }} /> Add Staff
                            </Button>
                        ) : (
                            <Button onClick={() => setIsPayrollModalOpen(true)} variant="primary">
                                <Plus size={14} style={{ marginRight: '8px' }} /> Generate Payroll
                            </Button>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 'var(--space-1)', borderBottom: '1px solid var(--notion-divider)', marginBottom: 'var(--space-6)' }}>
                    <button onClick={() => setActiveTab('directory')} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-3) var(--space-4)', fontSize: '14px', fontWeight: activeTab === 'directory' ? '600' : '400', color: activeTab === 'directory' ? 'var(--notion-text)' : 'var(--notion-text-secondary)', backgroundColor: 'transparent', border: 'none', borderBottom: activeTab === 'directory' ? '2px solid var(--notion-blue)' : '2px solid transparent', cursor: 'pointer' }}>
                        <Briefcase size={16} /> Directory
                    </button>
                    <button onClick={() => setActiveTab('payroll')} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-3) var(--space-4)', fontSize: '14px', fontWeight: activeTab === 'payroll' ? '600' : '400', color: activeTab === 'payroll' ? 'var(--notion-text)' : 'var(--notion-text-secondary)', backgroundColor: 'transparent', border: 'none', borderBottom: activeTab === 'payroll' ? '2px solid var(--notion-blue)' : '2px solid transparent', cursor: 'pointer' }}>
                        <DollarSign size={16} /> Payroll
                    </button>
                    <button onClick={() => setActiveTab('attendance')} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-3) var(--space-4)', fontSize: '14px', fontWeight: activeTab === 'attendance' ? '600' : '400', color: activeTab === 'attendance' ? 'var(--notion-text)' : 'var(--notion-text-secondary)', backgroundColor: 'transparent', border: 'none', borderBottom: activeTab === 'attendance' ? '2px solid var(--notion-blue)' : '2px solid transparent', cursor: 'pointer' }}>
                        <Clock size={16} /> Attendance
                    </button>
                </div>

                {activeTab === 'directory' && (
                    <>
                        <div style={{ marginBottom: 'var(--space-6)', maxWidth: '400px' }}>
                            <Input
                                placeholder="Search staff..."
                                value={searchQuery}
                                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                icon={<Search size={16} />}
                            />
                        </div>

                        <div style={{ backgroundColor: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                            <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                                <thead style={{ backgroundColor: 'var(--notion-bg-secondary)', borderBottom: '1px solid var(--notion-border)', color: 'var(--notion-text-secondary)' }}>
                                    <tr>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500' }}>Name</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500' }}>Contact</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500' }}>Role</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500' }}>Status</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500' }}>Mobile</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '500' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody style={{ borderTop: '1px solid var(--notion-border)' }}>
                                    {isStaffLoading ? (
                                        <tr><td colSpan={6} style={{ padding: '32px' }}><SkeletonList items={3} /></td></tr>
                                    ) : filteredUsers.length === 0 ? (
                                        <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>No staff found.</td></tr>
                                    ) : (
                                        paginatedUsers.map(user => (
                                            <tr key={user.id} style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                                <td style={{ padding: '12px 16px', fontWeight: '500' }}>{user.fullName}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '13px' }}>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Mail size={12} className="text-[var(--notion-text-secondary)]" /> {user.email}</span>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={12} className="text-[var(--notion-text-secondary)]" /> {user.phone}</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '12px', backgroundColor: 'var(--notion-blue-bg)', color: 'var(--notion-blue)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Shield size={10} />{user.role?.name || 'No Role'}</span>
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    {user.isActive ? (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--notion-green)', fontSize: '13px' }}><CheckCircle2 size={14} /> Active</span>
                                                    ) : (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--notion-red)', fontSize: '13px' }}><XCircle size={14} /> Inactive</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    {user.hasMobileApp ? (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--notion-blue)', fontSize: '13px' }} title={user.mobileDevices?.map(d => `${d.platform}${d.deviceId ? ` (${d.deviceId})` : ''}`).join(', ') || 'Mobile app installed'}><Smartphone size={14} /> Mobile</span>
                                                    ) : (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--notion-text-secondary)', fontSize: '13px' }}><Smartphone size={14} /> —</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                        <Button size="sm" variant="secondary" onClick={() => handleEdit(user)}>Edit</Button>
                                                        <Button size="sm" variant="secondary" onClick={() => handleToggleStatus(user)} style={{ color: user.isActive ? 'var(--notion-red)' : 'var(--notion-green)' }}>{user.isActive ? 'Deactivate' : 'Activate'}</Button>
                                                        {can('users:delete') && (
                                                            <Button size="sm" variant="ghost" onClick={() => handleDelete(user)} style={{ color: 'var(--notion-red)' }}>Delete</Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                            <Pagination page={currentPage} totalPages={totalPages} total={filteredUsers.length} limit={pageLimit} onPageChange={setCurrentPage} onLimitChange={(l) => { setPageLimit(l); setCurrentPage(1); }} />
                        </div>
                    </>
                )}

                {activeTab === 'payroll' && (
                    <div style={{ backgroundColor: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                        <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                            <thead style={{ backgroundColor: 'var(--notion-bg-secondary)', borderBottom: '1px solid var(--notion-border)', color: 'var(--notion-text-secondary)' }}>
                                <tr>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500' }}>Employee</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500' }}>Period</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '500' }}>Base</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '500' }}>Adjustments</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '500' }}>Net Pay</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '500' }}>Status</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '500' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody style={{ borderTop: '1px solid var(--notion-border)' }}>
                                {isPayrollLoading ? (
                                    <tr><td colSpan={7} style={{ padding: '32px' }}><SkeletonList items={3} /></td></tr>
                                ) : payroll.length === 0 ? (
                                    <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>No payroll records found.</td></tr>
                                ) : (
                                    payroll.map(p => (
                                        <tr key={p.id} style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                            <td style={{ padding: '12px 16px', fontWeight: '500' }}>{p.employeeName}</td>
                                            <td style={{ padding: '12px 16px', color: 'var(--notion-text-secondary)' }}>{p.periodStart} to {p.periodEnd}</td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>NPR {p.baseSalary.toLocaleString()}</td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', color: p.bonuses - p.deductions >= 0 ? 'var(--notion-green)' : 'var(--notion-red)' }}>
                                                {p.bonuses - p.deductions >= 0 ? '+' : '-'}NPR {Math.abs(p.bonuses - p.deductions).toLocaleString()}
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600' }}>NPR {p.netPay.toLocaleString()}</td>
                                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                                <span style={{ 
                                                    padding: '4px 8px', 
                                                    borderRadius: '4px', 
                                                    fontSize: '12px', 
                                                    backgroundColor: p.status === 'PAID' ? 'var(--notion-green-bg)' : 
                                                                    p.status === 'DRAFT' ? 'var(--notion-bg-tertiary)' : 
                                                                    'var(--notion-yellow-bg)', 
                                                    color: p.status === 'PAID' ? 'var(--notion-green)' : 
                                                           p.status === 'DRAFT' ? 'var(--notion-text-secondary)' : 
                                                           'var(--notion-yellow)' 
                                                }}>
                                                    {p.status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                                {(p.status === 'PENDING' || p.status === 'DRAFT') && (
                                                    <Button size="sm" variant="primary" onClick={async () => { const pw = await pwConfirm('Pay payroll', 'Re-enter your password to record this payroll payment.'); if (pw) await processPayment(p.id, pw); }}>Pay Now</Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'attendance' && (
                    <AttendancePage />
                )}

                <StaffFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={selectedUser ? (data) => updateUser(selectedUser.id, data) : createUser} roles={roles} initialData={selectedUser} currentUserLevel={currentUserRoleLevel} />

                <Modal isOpen={isPayrollModalOpen} onClose={() => setIsPayrollModalOpen(false)} title="Generate Payroll">
                    <form onSubmit={handleGeneratePayroll} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button type="button" onClick={() => setPayrollMode('manual')} style={{ flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)', background: payrollMode === 'manual' ? 'var(--notion-blue)' : 'var(--notion-bg)', color: payrollMode === 'manual' ? '#fff' : 'var(--notion-text-secondary)', cursor: 'pointer', fontSize: 13 }}>Manual</button>
                            <button type="button" onClick={() => setPayrollMode('attendance')} style={{ flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)', background: payrollMode === 'attendance' ? 'var(--notion-blue)' : 'var(--notion-bg)', color: payrollMode === 'attendance' ? '#fff' : 'var(--notion-text-secondary)', cursor: 'pointer', fontSize: 13 }}>From approved attendance</button>
                        </div>
                        <div>
                            <SearchableSelect
                                label="Employee"
                                value={newPayroll.employeeId || null}
                                onChange={val => setNewPayroll({...newPayroll, employeeId: String(val)})}
                                placeholder="Select employee..."
                                searchPlaceholder="Search employees..."
                                options={users.map(u => ({ value: u.id, label: u.fullName, subtitle: u.role?.name || '' }))}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                            <div style={{ flex: 1 }}>
                                <DatePicker
                                    label="Period Start"
                                    selected={newPayroll.periodStart ? new Date(newPayroll.periodStart) : null}
                                    onChange={(date: Date | null) => {
                                        const str = date instanceof Date ? date.toISOString().split('T')[0] || '' : '';
                                        setNewPayroll(prev => ({...prev, periodStart: str}));
                                    }}
                                    placeholder="Select start date"
                                    required
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <DatePicker
                                    label="Period End"
                                    selected={newPayroll.periodEnd ? new Date(newPayroll.periodEnd) : null}
                                    onChange={(date: Date | null) => {
                                        const str = date instanceof Date ? date.toISOString().split('T')[0] || '' : '';
                                        setNewPayroll(prev => ({...prev, periodEnd: str}));
                                    }}
                                    placeholder="Select end date"
                                    required
                                />
                            </div>
                        </div>
                        <div>
                            <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>Base Salary</label>
                            <Input type="number" min="0" step="0.01" value={newPayroll.baseSalary || ''} onChange={e => setNewPayroll({...newPayroll, baseSalary: e.target.value === '' ? 0 : parseFloat(e.target.value)})} required />
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>Bonuses</label>
                                <Input type="number" min="0" step="0.01" value={newPayroll.bonuses || ''} onChange={e => setNewPayroll({...newPayroll, bonuses: e.target.value === '' ? 0 : parseFloat(e.target.value)})} disabled={payrollMode === 'attendance'} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>Deductions</label>
                                <Input type="number" min="0" step="0.01" value={newPayroll.deductions || ''} onChange={e => setNewPayroll({...newPayroll, deductions: e.target.value === '' ? 0 : parseFloat(e.target.value)})} />
                            </div>
                        </div>
                        {payrollMode === 'attendance' && attendancePreview && (
                            <div style={{
                                padding: 'var(--space-3)',
                                borderRadius: 'var(--radius-md)',
                                backgroundColor: 'var(--notion-bg-secondary)',
                                border: '1px solid var(--notion-border)',
                                fontSize: '13px',
                                display: 'grid',
                                gap: '6px',
                            }}>
                                <div style={{ fontWeight: 600, color: 'var(--notion-text)' }}>Attendance preview (approved hours only)</div>
                                <div>Days present: {attendancePreview.daysPresent} · Total hours: {attendancePreview.totalHours}h · OT: {attendancePreview.overtimeHours}h</div>
                                <div>Regular pay: {attendancePreview.regularPay.toFixed(2)} · Overtime: {attendancePreview.overtimePay.toFixed(2)} · Net: <strong>{attendancePreview.netPay.toFixed(2)}</strong></div>
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                            <Button type="button" variant="secondary" onClick={() => setIsPayrollModalOpen(false)}>Cancel</Button>
                            <Button type="submit">Generate</Button>
                        </div>
                    </form>
                </Modal>

                <ConfirmDialog isOpen={!!confirmTarget} onClose={() => setConfirmTarget(null)} onConfirm={handleConfirmToggle} title={confirmTarget?.isActive ? 'Deactivate Staff' : 'Activate Staff'} message={confirmTarget?.isActive ? `Are you sure you want to deactivate ${confirmTarget.fullName}? They will lose access to the system.` : `Are you sure you want to activate ${confirmTarget?.fullName}? They will regain access to the system.`} confirmLabel={confirmTarget?.isActive ? 'Deactivate' : 'Activate'} confirmColor={confirmTarget?.isActive ? 'var(--notion-red)' : 'var(--notion-green)'} isLoading={isToggling} />

                <ConfirmDialog
                    isOpen={!!deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    onConfirm={handleConfirmDelete}
                    title="Delete Staff"
                    message={`Are you sure you want to delete ${deleteTarget?.fullName}? This action cannot be undone.`}
                    confirmLabel="Delete"
                    confirmColor="var(--notion-red)"
                    isLoading={isDeleting}
                />
            </div>
        </>
    );
}
