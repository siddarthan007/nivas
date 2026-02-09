'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useStaff } from '@/lib/hooks/useStaff';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
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
    AlertTriangle
} from 'lucide-react';
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
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
                    <Button variant="secondary" onClick={onClose} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={onConfirm}
                        disabled={isLoading}
                        style={{ backgroundColor: confirmColor || 'var(--notion-red)', borderColor: confirmColor || 'var(--notion-red)' }}
                    >
                        {isLoading ? 'Processing...' : confirmLabel}
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
    initialData
}: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<boolean>;
    roles: { id: number; name: string }[];
    initialData?: User | null;
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
        setLoading(true);
        try {
            // If editing, don't send empty password unless changed
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
                        disabled={!!initialData} // Prevent email change usually
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
                        options={roles.map(r => ({ value: r.id.toString(), label: r.name }))}
                    />
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
                    <Button variant="secondary" onClick={onClose} disabled={loading} type="button">Cancel</Button>
                    <Button variant="primary" type="submit" loading={loading}>{initialData ? 'Update' : 'Create Staff'}</Button>
                </div>
            </form>
        </Modal>
    );
}

export default function StaffPage() {
    const { users, roles, isLoading, fetchUsers, fetchRoles, createUser, updateUser, toggleUserStatus } = useStaff();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [confirmTarget, setConfirmTarget] = useState<User | null>(null);
    const [isToggling, setIsToggling] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageLimit, setPageLimit] = useState(20);

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

    const filteredUsers = users.filter(u =>
        (u.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.role?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Pagination
    const totalPages = Math.ceil(filteredUsers.length / pageLimit);
    const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageLimit, currentPage * pageLimit);

    return (
        <DashboardLayout>
            <div style={{ padding: 'var(--space-8)' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                    <div>
                        <h1 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: '24px', fontWeight: '600', color: 'var(--notion-text)' }}>
                            <Users size={28} />
                            Staff Management
                        </h1>
                        <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', marginTop: '4px' }}>
                            Manage employees, roles, and access
                        </p>
                    </div>
                    <Button onClick={handleAddNew} variant="primary">
                        <Plus size={14} style={{ marginRight: '8px' }} /> Add Staff
                    </Button>
                </div>

                {/* Search */}
                <div style={{ marginBottom: 'var(--space-6)', maxWidth: '400px', position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--notion-text-secondary)' }} size={16} />
                    <input
                        type="text"
                        placeholder="Search staff..."
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        style={{
                            width: '100%',
                            padding: '8px 12px 8px 36px',
                            fontSize: '14px',
                            border: '1px solid var(--notion-border)',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--notion-bg-secondary)',
                            color: 'var(--notion-text)'
                        }}
                    />
                </div>

                {/* Staff List */}
                <div style={{
                    backgroundColor: 'var(--notion-bg)',
                    border: '1px solid var(--notion-border)',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden'
                }}>
                    <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                        <thead style={{
                            backgroundColor: 'var(--notion-bg-secondary)',
                            borderBottom: '1px solid var(--notion-border)',
                            color: 'var(--notion-text-secondary)'
                        }}>
                            <tr>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500' }}>Name</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500' }}>Contact</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500' }}>Role</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500' }}>Status</th>
                                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '500' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody style={{ borderTop: '1px solid var(--notion-border)' }}>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>Loading...</td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>No staff found.</td>
                                </tr>
                            ) : (
                                paginatedUsers.map(user => (
                                    <tr key={user.id} style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                        <td style={{ padding: '12px 16px', fontWeight: '500' }}>{user.fullName}</td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '13px' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Mail size={12} className="text-[var(--notion-text-secondary)]" /> {user.email}
                                                </span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Phone size={12} className="text-[var(--notion-text-secondary)]" /> {user.phone}
                                                </span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: '12px',
                                                fontSize: '12px',
                                                backgroundColor: 'var(--notion-blue-bg)',
                                                color: 'var(--notion-blue)',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                <Shield size={10} />
                                                {user.role?.name || 'No Role'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            {user.isActive ? (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--notion-green)', fontSize: '13px' }}>
                                                    <CheckCircle2 size={14} /> Active
                                                </span>
                                            ) : (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--notion-red)', fontSize: '13px' }}>
                                                    <XCircle size={14} /> Inactive
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                <Button size="sm" variant="secondary" onClick={() => handleEdit(user)}>Edit</Button>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={() => handleToggleStatus(user)}
                                                    style={{ color: user.isActive ? 'var(--notion-red)' : 'var(--notion-green)' }}
                                                >
                                                    {user.isActive ? 'Deactivate' : 'Activate'}
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    <Pagination
                        page={currentPage}
                        totalPages={totalPages}
                        total={filteredUsers.length}
                        limit={pageLimit}
                        onPageChange={setCurrentPage}
                        onLimitChange={(l) => { setPageLimit(l); setCurrentPage(1); }}
                    />
                </div>

                <StaffFormModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSubmit={selectedUser ? (data) => updateUser(selectedUser.id, data) : createUser}
                    roles={roles}
                    initialData={selectedUser}
                />

                <ConfirmDialog
                    isOpen={!!confirmTarget}
                    onClose={() => setConfirmTarget(null)}
                    onConfirm={handleConfirmToggle}
                    title={confirmTarget?.isActive ? 'Deactivate Staff' : 'Activate Staff'}
                    message={
                        confirmTarget?.isActive
                            ? `Are you sure you want to deactivate ${confirmTarget.fullName}? They will lose access to the system.`
                            : `Are you sure you want to activate ${confirmTarget?.fullName}? They will regain access to the system.`
                    }
                    confirmLabel={confirmTarget?.isActive ? 'Deactivate' : 'Activate'}
                    confirmColor={confirmTarget?.isActive ? 'var(--notion-red)' : 'var(--notion-green)'}
                    isLoading={isToggling}
                />
            </div>
        </DashboardLayout>
    );
}
