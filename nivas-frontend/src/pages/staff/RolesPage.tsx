'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useRoles } from '@/lib/hooks/useRoles';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import {
    Shield,
    Plus,
    Search,
    CheckSquare,
    Square,
    Lock,
    Edit2,
    Trash2
} from 'lucide-react';
import type { CreateRolePayload, Role } from '@/lib/types/api.types';
import { PERMISSIONS } from '@/lib/constants/permissions';

// Permission Group Component
function PermissionGroup({
    title,
    permissions,
    selected,
    onToggle
}: {
    title: string;
    permissions: { [key: string]: string };
    selected: string[];
    onToggle: (perm: string) => void;
}) {
    const allSelected = Object.values(permissions).every(p => selected.includes(p));
    const someSelected = Object.values(permissions).some(p => selected.includes(p));

    const handleToggleAll = () => {
        const perms = Object.values(permissions);
        if (allSelected) {
            // Unselect all
            perms.forEach(p => {
                if (selected.includes(p)) onToggle(p);
            });
        } else {
            // Select all
            perms.forEach(p => {
                if (!selected.includes(p)) onToggle(p);
            });
        }
    };

    return (
        <div style={{ marginBottom: 'var(--space-4)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <div
                style={{
                    padding: '8px 12px',
                    backgroundColor: 'var(--notion-bg-secondary)',
                    borderBottom: '1px solid var(--notion-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                }}
                onClick={handleToggleAll}
            >
                <span style={{ fontWeight: '500', fontSize: '13px' }}>{title}</span>
                {allSelected ? (
                    <CheckSquare size={16} className="text-[var(--notion-blue)]" />
                ) : someSelected ? (
                    <div style={{ width: '14px', height: '14px', backgroundColor: 'var(--notion-blue)', borderRadius: '2px' }} />
                ) : (
                    <Square size={16} className="text-[var(--notion-text-tertiary)]" />
                )}
            </div>
            <div style={{ padding: '8px 12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                {Object.entries(permissions).map(([key, value]) => (
                    <div
                        key={value}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}
                        onClick={() => onToggle(value)}
                    >
                        {selected.includes(value) ? (
                            <CheckSquare size={14} className="text-[var(--notion-blue)]" />
                        ) : (
                            <Square size={14} className="text-[var(--notion-text-tertiary)]" />
                        )}
                        <span style={{ color: selected.includes(value) ? 'var(--notion-text)' : 'var(--notion-text-secondary)' }}>
                            {key.replace(/_/g, ' ')}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Role Form Modal
function RoleFormModal({
    isOpen,
    onClose,
    onSubmit,
    initialData
}: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<boolean>;
    initialData?: Role | null;
}) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<CreateRolePayload>({
        name: '',
        description: '',
        permissions: []
    });

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    name: initialData.name,
                    description: initialData.description || '',
                    permissions: initialData.permissions
                });
            } else {
                setFormData({
                    name: '',
                    description: '',
                    permissions: []
                });
            }
        }
    }, [isOpen, initialData]);

    const handleTogglePermission = (perm: string) => {
        setFormData((prev: CreateRolePayload) => {
            const exists = prev.permissions.includes(perm);
            return {
                ...prev,
                permissions: exists
                    ? prev.permissions.filter(p => p !== perm)
                    : [...prev.permissions, perm]
            };
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const success = await onSubmit(formData);
            if (success) onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Edit Role" : "Create New Role"} size="xl">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxHeight: '70vh', overflowY: 'auto', paddingRight: '4px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <div>
                        <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Role Name</label>
                        <Input
                            required
                            placeholder="e.g. Front Desk Staff"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Description</label>
                        <Input
                            placeholder="Role description"
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs text-[var(--notion-text-secondary)] mb-2">Permissions</label>
                    {Object.entries(PERMISSIONS).map(([group, perms]) => (
                        <PermissionGroup
                            key={group}
                            title={group}
                            permissions={perms as any}
                            selected={formData.permissions}
                            onToggle={handleTogglePermission}
                        />
                    ))}
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', marginTop: 'var(--space-2)', position: 'sticky', bottom: 0, backgroundColor: 'var(--notion-bg)', padding: 'var(--space-2) 0' }}>
                    <Button variant="secondary" onClick={onClose} disabled={loading} type="button">Cancel</Button>
                    <Button variant="primary" type="submit" loading={loading}>{initialData ? 'Update Role' : 'Create Role'}</Button>
                </div>
            </form>
        </Modal>
    );
}

export default function RolesPage() {
    const { roles, isLoading, fetchRoles, createRole, updateRole, deleteRole } = useRoles();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);

    useEffect(() => {
        fetchRoles();
    }, []);

    const handleEdit = (role: Role) => {
        setSelectedRole(role);
        setIsModalOpen(true);
    };

    const handleAddNew = () => {
        setSelectedRole(null);
        setIsModalOpen(true);
    };

    return (
        <DashboardLayout>
            <div style={{ padding: 'var(--space-8)' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                    <div>
                        <h1 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: '24px', fontWeight: '600', color: 'var(--notion-text)' }}>
                            <Shield size={28} />
                            Roles & Permissions
                        </h1>
                        <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', marginTop: '4px' }}>
                            Configure access levels and permissions
                        </p>
                    </div>
                    <Button onClick={handleAddNew} variant="primary">
                        <Plus size={14} style={{ marginRight: '8px' }} /> Create Role
                    </Button>
                </div>

                {/* Roles List */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: 'var(--space-4)'
                }}>
                    {isLoading ? (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '32px', color: 'var(--notion-text-secondary)' }}>Loading...</div>
                    ) : (
                        roles.map(role => (
                            <div key={role.id} style={{
                                backgroundColor: 'var(--notion-bg)',
                                border: '1px solid var(--notion-border)',
                                borderRadius: 'var(--radius-lg)',
                                padding: 'var(--space-4)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 'var(--space-3)',
                                transition: 'box-shadow 0.2s',
                            }}
                                className='hover:shadow-sm'
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <h3 style={{ fontWeight: '600', fontSize: '16px' }}>{role.name}</h3>
                                            {role.isSystem && (
                                                <span style={{ fontSize: '10px', backgroundColor: 'var(--notion-bg-secondary)', padding: '2px 6px', borderRadius: '4px', color: 'var(--notion-text-secondary)' }}>SYSTEM</span>
                                            )}
                                        </div>
                                        <p style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginTop: '4px' }}>
                                            {role.description || 'No description provided'}
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        {!role.isSystem && (
                                            <>
                                                <button
                                                    onClick={() => handleEdit(role)}
                                                    style={{ padding: '6px', cursor: 'pointer', color: 'var(--notion-text-secondary)', borderRadius: '4px', border: 'none', background: 'transparent' }}
                                                    title="Edit"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => deleteRole(role.id)}
                                                    style={{ padding: '6px', cursor: 'pointer', color: 'var(--notion-red)', borderRadius: '4px', border: 'none', background: 'transparent' }}
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </>
                                        )}
                                        {role.isSystem && (
                                            <button
                                                onClick={() => handleEdit(role)}
                                                style={{ padding: '6px', cursor: 'pointer', color: 'var(--notion-text-secondary)', borderRadius: '4px', border: 'none', background: 'transparent' }}
                                                title="View/Edit"
                                            >
                                                <Lock size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div style={{
                                    borderTop: '1px solid var(--notion-border)',
                                    paddingTop: 'var(--space-3)',
                                    fontSize: '12px',
                                    color: 'var(--notion-text-secondary)'
                                }}>
                                    <span style={{ fontWeight: '500', color: 'var(--notion-text)' }}>{role.permissions.length}</span> permissions assigned
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <RoleFormModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSubmit={selectedRole ? (data) => updateRole(selectedRole.id, data) : createRole}
                    initialData={selectedRole}
                />
            </div>
        </DashboardLayout>
    );
}
