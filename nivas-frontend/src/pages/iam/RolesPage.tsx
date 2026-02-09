'use client';

import { useState, useEffect } from 'react';
import { useUsers } from '@/lib/hooks/useUsers';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import {
    Shield,
    Plus,
    RefreshCw,
    Trash2,
    Edit2,
    Check,
    X,
    ChevronDown,
    ChevronRight,
    CheckSquare,
    Square
} from 'lucide-react';
import type { Role, CreateRolePayload } from '@/lib/types/api.types';
import { api } from '@/lib/api';
import { useHotelPlan } from '@/lib/hooks/useHotelPlan';

// Role Card Component
function RoleCard({
    role,
    onEdit,
    onDelete,
    userCount
}: {
    role: Role;
    onEdit: () => void;
    onDelete: () => void;
    userCount: number;
}) {
    const [expanded, setExpanded] = useState(false);
    const isFullAccess = role.permissions.length === 1 && role.permissions[0] === '*';

    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--notion-border)',
            padding: 'var(--space-4)',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '160px'
        }}
            className="hover:shadow-md hover:border-gray-300"
        >
            <div>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 'var(--space-2)'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)'
                    }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--notion-blue-bg)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--notion-blue)',
                        }}>
                            <Shield size={16} />
                        </div>
                        <h3 style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            color: 'var(--notion-text)',
                            margin: 0
                        }}>
                            {role.name}
                        </h3>
                    </div>
                    {(role.name !== 'Super Admin' && role.name !== 'Owner') && (
                        <div style={{ display: 'flex', gap: '4px' }}>
                            <Button size="sm" variant="ghost" onClick={onEdit} title="Edit Role" style={{ padding: '4px' }}>
                                <Edit2 size={14} />
                            </Button>
                            <Button size="sm" variant="danger" onClick={onDelete} title="Delete Role" style={{ padding: '4px' }}>
                                <Trash2 size={14} />
                            </Button>
                        </div>
                    )}
                </div>

                <div
                    onClick={() => setExpanded(!expanded)}
                    style={{
                        fontSize: '13px',
                        color: 'var(--notion-text-secondary)',
                        marginBottom: 'var(--space-2)',
                        paddingLeft: '40px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                    }}
                >
                    {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    {isFullAccess
                        ? 'Full System Access'
                        : `${role.permissions.length} Permissions`
                    }
                </div>
                {expanded && !isFullAccess && (
                    <div style={{
                        paddingLeft: '40px',
                        marginBottom: 'var(--space-2)',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '4px',
                    }}>
                        {role.permissions.map(p => (
                            <span key={p} style={{
                                fontSize: '11px',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                backgroundColor: 'var(--notion-blue-bg)',
                                color: 'var(--notion-blue)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                            }}>
                                <Check size={10} />
                                {p.split(':')[1] || p}
                            </span>
                        ))}
                    </div>
                )}
                {expanded && isFullAccess && (
                    <div style={{
                        paddingLeft: '40px',
                        marginBottom: 'var(--space-2)',
                        fontSize: '12px',
                        color: 'var(--notion-green)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                    }}>
                        <Check size={14} /> All permissions granted
                    </div>
                )}
            </div>

            <div style={{
                paddingTop: 'var(--space-3)',
                borderTop: '1px solid var(--notion-divider)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '13px',
                color: 'var(--notion-text-tertiary)'
            }}>
                <span>Assigned Users</span>
                <span style={{
                    backgroundColor: 'var(--notion-bg-tertiary)',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontWeight: '500',
                    color: 'var(--notion-text)'
                }}>
                    {userCount}
                </span>
            </div>
        </div>
    );
}

// Role Form Modal
function RoleFormModal({
    isOpen,
    onClose,
    onSubmit,
    editingRole,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: CreateRolePayload) => Promise<void>;
    editingRole?: Role;
}) {
    const [name, setName] = useState('');
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
    const [availablePermissions, setAvailablePermissions] = useState<Record<string, Record<string, string>>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    // Fetch available permissions on mount
    useEffect(() => {
        const fetchPerms = async () => {
            try {
                const res = await api.get<any>('/roles/permissions');
                if (res.data) {
                    setAvailablePermissions(res.data);
                    // Initialize expanded state for all groups
                    const initialExpanded: Record<string, boolean> = {};
                    Object.keys(res.data).forEach(key => initialExpanded[key] = true);
                    setExpandedGroups(initialExpanded);
                }
            } catch (err) {
                console.error('Failed to fetch permissions', err);
            }
        };
        if (isOpen) {
            fetchPerms();
        }
    }, [isOpen]);

    // Initialize form when editing
    useEffect(() => {
        if (editingRole) {
            setName(editingRole.name);
            // If role has wildcard '*', select all available permissions
            if (editingRole.permissions.includes('*')) {
                const allPerms = Object.values(availablePermissions).flatMap(group => Object.values(group));
                setSelectedPermissions(allPerms);
            } else {
                setSelectedPermissions(editingRole.permissions);
            }
        } else {
            setName('');
            setSelectedPermissions([]);
        }
    }, [editingRole, isOpen, availablePermissions]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSubmitting(true);
        await onSubmit({
            name,
            permissions: selectedPermissions
        });
        setIsSubmitting(false);
        onClose();
    };

    const togglePermission = (perm: string) => {
        if (selectedPermissions.includes(perm)) {
            setSelectedPermissions(selectedPermissions.filter(p => p !== perm));
        } else {
            setSelectedPermissions([...selectedPermissions, perm]);
        }
    };

    const toggleGroup = (groupKey: string) => {
        const group = availablePermissions[groupKey];
        if (!group) return;

        const permsInGroup = Object.values(group);
        const allSelected = permsInGroup.every(p => selectedPermissions.includes(p));

        if (allSelected) {
            // Deselect all in group
            setSelectedPermissions(selectedPermissions.filter(p => !permsInGroup.includes(p)));
        } else {
            // Select all in group (add missing ones)
            const newPerms = [...selectedPermissions];
            permsInGroup.forEach(p => {
                if (!newPerms.includes(p)) newPerms.push(p);
            });
            setSelectedPermissions(newPerms);
        }
    };

    const toggleExpand = (groupKey: string) => {
        setExpandedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={editingRole ? 'Edit Role' : 'New Role'} size="lg">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '70vh' }}>
                <div style={{ marginBottom: 'var(--space-4)' }}>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                        Role Name *
                    </label>
                    <Input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. Front Desk Manager"
                        required
                        autoFocus
                    />
                </div>

                <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)' }}>
                    <div style={{ marginBottom: 'var(--space-2)', padding: '0 var(--space-2)', fontSize: '12px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>
                        PERMISSIONS
                    </div>

                    {Object.entries(availablePermissions).map(([groupKey, perms]) => {
                        const permsList = Object.values(perms);
                        const isAllSelected = permsList.every(p => selectedPermissions.includes(p));
                        const isSomeSelected = permsList.some(p => selectedPermissions.includes(p));
                        const isExpanded = expandedGroups[groupKey];

                        return (
                            <div key={groupKey} style={{ marginBottom: 'var(--space-2)' }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '6px 8px',
                                    backgroundColor: 'var(--notion-bg-tertiary)',
                                    borderRadius: 'var(--radius-sm)',
                                    cursor: 'pointer'
                                }}>
                                    <div
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}
                                        onClick={() => toggleExpand(groupKey)}
                                    >
                                        <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}>
                                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        </button>
                                        <span style={{ fontSize: '13px', fontWeight: '600', textTransform: 'uppercase' }}>{groupKey}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <button
                                            type="button"
                                            onClick={() => toggleGroup(groupKey)}
                                            style={{
                                                fontSize: '11px',
                                                color: 'var(--notion-blue)',
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {isAllSelected ? 'Deselect All' : 'Select All'}
                                        </button>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div style={{ padding: '8px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                                        {Object.entries(perms).map(([permKey, permValue]) => {
                                            const isSelected = selectedPermissions.includes(permValue);
                                            return (
                                                <div
                                                    key={permKey}
                                                    onClick={() => togglePermission(permValue)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        justifyContent: 'flex-start',
                                                        color: isSelected ? 'var(--notion-blue)' : 'var(--notion-text)',
                                                        backgroundColor: isSelected ? 'var(--notion-blue-bg)' : 'transparent',
                                                        fontWeight: isSelected ? '500' : 'normal',
                                                    }}
                                                >
                                                    {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                                                    {permValue.split(':')[1]}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--notion-divider)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting || !name} style={{ flex: 1 }}>
                        {isSubmitting ? 'Saving...' : editingRole ? 'Update Changes' : 'Create Role'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

export default function RolesPage() {
    const { roles, users, isLoading, fetchRoles, createRole, updateRole, deleteRole } = useUsers();
    const { isRoleAllowed, plan } = useHotelPlan();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | undefined>();

    const handleCreateOrUpdate = async (data: CreateRolePayload) => {
        if (editingRole) {
            // We need updateRole in useUsers
            await updateRole(editingRole.id, data);
        } else {
            await createRole(data);
        }
    };

    const handleEdit = (role: Role) => {
        setEditingRole(role);
        setIsFormOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('Are you sure you want to delete this role? Users assigned to this role will lose their permissions.')) {
            await deleteRole(id);
        }
    };

    // Calculate user counts per role
    const getRoleUserCount = (roleId: number) => {
        return users.filter(u => u.role?.id === roleId).length;
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
                                <Shield size={28} />
                                Roles & Permissions
                            </h1>
                            <p style={{
                                fontSize: '14px',
                                color: 'var(--notion-text-secondary)',
                                marginTop: 'var(--space-1)',
                            }}>
                                Define roles and assign permissions to hotel staff
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                            <Button variant="secondary" onClick={() => fetchRoles()} disabled={isLoading}>
                                <RefreshCw size={14} style={{ marginRight: '6px' }} />
                                Refresh
                            </Button>
                            <Button onClick={() => { setEditingRole(undefined); setIsFormOpen(true); }}>
                                <Plus size={14} style={{ marginRight: '6px' }} />
                                Create Role
                            </Button>
                        </div>
                    </div>

                    {/* Plan restriction notice */}
                    {plan.allowedRoles.length > 0 && (
                        <div style={{
                            padding: 'var(--space-3) var(--space-4)',
                            backgroundColor: 'var(--notion-blue-bg)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: 'var(--space-4)',
                            fontSize: '13px',
                            color: 'var(--notion-blue)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)',
                        }}>
                            <Shield size={14} />
                            Your plan ({plan.planName}) allows these roles: {plan.allowedRoles.join(', ')}. Roles outside this list cannot be assigned to staff.
                        </div>
                    )}

                    {/* Roles Grid */}
                    {isLoading ? (
                        <div style={{ textAlign: 'center', padding: '40px' }}>Loading roles...</div>
                    ) : roles.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: 'var(--space-12)',
                            color: 'var(--notion-text-secondary)',
                        }}>
                            <Shield size={48} style={{ opacity: 0.3, marginBottom: 'var(--space-4)' }} />
                            <p style={{ fontSize: '16px', marginBottom: 'var(--space-2)' }}>No roles defined yet</p>
                            <p style={{ fontSize: '14px', color: 'var(--notion-text-muted)' }}>
                                Create your first role to start assigning permissions to staff
                            </p>
                            <Button onClick={() => { setEditingRole(undefined); setIsFormOpen(true); }} style={{ marginTop: 'var(--space-4)' }}>
                                <Plus size={14} style={{ marginRight: '6px' }} />
                                Create First Role
                            </Button>
                        </div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                            gap: 'var(--space-4)',
                        }}>
                            {roles.map(role => {
                                const allowed = isRoleAllowed(role.name);
                                return (
                                    <div key={role.id} style={{ position: 'relative', opacity: allowed ? 1 : 0.6 }}>
                                        {!allowed && (
                                            <div style={{
                                                position: 'absolute', top: 8, right: 8, zIndex: 2,
                                                padding: '2px 8px', fontSize: '10px', fontWeight: '600',
                                                backgroundColor: 'var(--notion-red-bg)', color: 'var(--notion-red)',
                                                borderRadius: 'var(--radius-full)',
                                            }}>
                                                Not in Plan
                                            </div>
                                        )}
                                        <RoleCard
                                            role={role}
                                            userCount={getRoleUserCount(role.id)}
                                            onEdit={() => handleEdit(role)}
                                            onDelete={() => handleDelete(role.id)}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}
            </div>

            <RoleFormModal
                isOpen={isFormOpen}
                onClose={() => { setIsFormOpen(false); setEditingRole(undefined); }}
                onSubmit={handleCreateOrUpdate}
                editingRole={editingRole}
            />
        </DashboardLayout>
    );
}
