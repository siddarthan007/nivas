'use client';

import { useState } from 'react';
import { useAuditLogs } from '@/lib/hooks/useAuditLogs';
import { useAuth } from '@/lib/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import {
    FileText,
    Download,
    RefreshCw,
    Search,
    Filter,
    ChevronLeft,
    ChevronRight,
    User,
    Clock,
    Activity,
    LogIn,
    LogOut,
    Edit,
    Trash,
    Plus,
    Eye,
    CheckSquare,
    Square,
    Trash2,
} from 'lucide-react';

// Action icons mapping
const ACTION_ICONS: Record<string, typeof Activity> = {
    'LOGIN': LogIn,
    'LOGOUT': LogOut,
    'CREATE': Plus,
    'UPDATE': Edit,
    'DELETE': Trash,
    'VIEW': Eye,
};

// Action colors
const ACTION_COLORS: Record<string, { color: string; bg: string }> = {
    'LOGIN': { color: 'var(--notion-green)', bg: 'var(--notion-green-bg)' },
    'LOGOUT': { color: 'var(--notion-text-secondary)', bg: 'var(--notion-bg-tertiary)' },
    'CREATE': { color: 'var(--notion-blue)', bg: 'var(--notion-blue-bg)' },
    'UPDATE': { color: 'var(--notion-orange)', bg: 'var(--notion-yellow-bg)' },
    'DELETE': { color: 'var(--notion-red)', bg: 'var(--notion-red-bg)' },
    'VIEW': { color: 'var(--notion-text-secondary)', bg: 'var(--notion-bg-tertiary)' },
};

export default function AuditLogsPage() {
    const { user } = useAuth();
    const isSuperAdmin = user?.userType === 'SUPER_ADMIN';

    const {
        logs,
        isLoading,
        pagination,
        actionTypes,
        entityTypes,
        fetchLogs,
        applyFilters,
        goToPage,
        exportToCSV,
        deleteLogs,
    } = useAuditLogs();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedAction, setSelectedAction] = useState('');
    const [selectedEntity, setSelectedEntity] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const handleApplyFilters = () => {
        applyFilters({
            action: selectedAction || undefined,
            entityType: selectedEntity || undefined,
        });
    };

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        return {
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        };
    };

    const filteredLogs = logs.filter(log => {
        // Hide impersonation audit logs from hotel owners and staff
        if (!isSuperAdmin && (log.action || '').toLowerCase().includes('impersonat')) return false;

        return (
            (log.userName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            (log.action?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            (log.entityType?.toLowerCase() || '').includes(searchQuery.toLowerCase())
        );
    });

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredLogs.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredLogs.map(l => l.id)));
        }
    };

    const toggleSelectLog = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return;
        setIsDeleting(true);
        const success = await deleteLogs(Array.from(selectedIds));
        setIsDeleting(false);
        if (success) {
            setSelectedIds(new Set());
        }
        setShowDeleteConfirm(false);
    };

    return (
        <>
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
                                    <FileText size={28} />
                                    Audit Logs
                                </h1>
                                <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', marginTop: 'var(--space-1)' }}>
                                    Track all system activities and user actions
                                </p>
                            </div>

                            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                                {isSuperAdmin && selectedIds.size > 0 && (
                                    <Button
                                        variant="secondary"
                                        onClick={() => setShowDeleteConfirm(true)}
                                        disabled={isDeleting}
                                        style={{ color: 'var(--notion-red)' }}
                                    >
                                        <Trash2 size={14} style={{ marginRight: '6px' }} />
                                        Delete ({selectedIds.size})
                                    </Button>
                                )}
                                <Button variant="secondary" onClick={() => fetchLogs()} disabled={isLoading}>
                                    <RefreshCw size={14} style={{ marginRight: '6px' }} />
                                    Refresh
                                </Button>
                                <Button variant="secondary" onClick={exportToCSV}>
                                    <Download size={14} style={{ marginRight: '6px' }} />
                                    Export CSV
                                </Button>
                            </div>
                        </div>

                        {/* Filters */}
                        <div style={{
                            display: 'flex',
                            gap: 'var(--space-3)',
                            marginBottom: 'var(--space-5)',
                            flexWrap: 'wrap',
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
                                    placeholder="Search logs..."
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

                            <Button
                                variant="secondary"
                                onClick={() => setShowFilters(!showFilters)}
                            >
                                <Filter size={14} style={{ marginRight: '6px' }} />
                                Filters
                            </Button>
                        </div>

                        {/* Advanced Filters */}
                        {showFilters && (
                            <div style={{
                                display: 'flex',
                                gap: 'var(--space-3)',
                                marginBottom: 'var(--space-5)',
                                padding: 'var(--space-4)',
                                backgroundColor: 'var(--notion-bg-secondary)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--notion-border)',
                            }}>
                                <select
                                    value={selectedAction}
                                    onChange={e => setSelectedAction(e.target.value)}
                                    style={{
                                        padding: '8px 12px',
                                        fontSize: '14px',
                                        border: '1px solid var(--notion-border)',
                                        borderRadius: 'var(--radius-md)',
                                        backgroundColor: 'var(--notion-bg)',
                                        color: 'var(--notion-text)',
                                    }}
                                >
                                    <option value="">All Actions</option>
                                    {actionTypes.map(action => (
                                        <option key={action} value={action}>{action}</option>
                                    ))}
                                </select>

                                <select
                                    value={selectedEntity}
                                    onChange={e => setSelectedEntity(e.target.value)}
                                    style={{
                                        padding: '8px 12px',
                                        fontSize: '14px',
                                        border: '1px solid var(--notion-border)',
                                        borderRadius: 'var(--radius-md)',
                                        backgroundColor: 'var(--notion-bg)',
                                        color: 'var(--notion-text)',
                                    }}
                                >
                                    <option value="">All Entities</option>
                                    {entityTypes.map(entity => (
                                        <option key={entity} value={entity}>{entity}</option>
                                    ))}
                                </select>

                                <Button size="sm" onClick={handleApplyFilters}>
                                    Apply Filters
                                </Button>
                            </div>
                        )}

                        {/* Stats Bar */}
                        <div style={{
                            display: 'flex',
                            gap: 'var(--space-4)',
                            marginBottom: 'var(--space-5)',
                            padding: 'var(--space-3) var(--space-4)',
                            backgroundColor: 'var(--notion-bg-secondary)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--notion-border)',
                            fontSize: '13px',
                            color: 'var(--notion-text-secondary)',
                        }}>
                            <span>Total: <strong style={{ color: 'var(--notion-text)' }}>{pagination.total}</strong> logs</span>
                            <span>•</span>
                            <span>Showing: <strong style={{ color: 'var(--notion-text)' }}>{filteredLogs.length}</strong></span>
                        </div>

                        {/* Logs Timeline */}
                        {isLoading ? (
                            <div style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                height: '40vh',
                                color: 'var(--notion-text-secondary)',
                            }}>
                                Loading audit logs...
                            </div>
                        ) : filteredLogs.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: 'var(--space-12)',
                                color: 'var(--notion-text-secondary)',
                            }}>
                                <FileText size={48} style={{ opacity: 0.3, marginBottom: 'var(--space-4)' }} />
                                <p style={{ fontSize: '16px' }}>No audit logs found</p>
                            </div>
                        ) : (
                            <div style={{
                                backgroundColor: 'var(--notion-bg-secondary)',
                                borderRadius: 'var(--radius-lg)',
                                border: '1px solid var(--notion-border)',
                                overflow: 'hidden',
                            }}>
                                {filteredLogs.map((log, index) => {
                                    const timestamp = formatTimestamp(log.createdAt);
                                    const actionConfig = ACTION_COLORS[log.action] || ACTION_COLORS['VIEW'] || { bg: 'var(--notion-bg-secondary)', color: 'var(--notion-text)' };
                                    const ActionIcon = ACTION_ICONS[log.action] || Activity;

                                    return (
                                        <div
                                            key={log.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                gap: 'var(--space-4)',
                                                padding: 'var(--space-4) var(--space-5)',
                                                borderBottom: index < filteredLogs.length - 1 ? '1px solid var(--notion-divider)' : 'none',
                                                transition: 'background-color 150ms ease',
                                                backgroundColor: selectedIds.has(log.id) ? 'var(--notion-bg-hover)' : 'transparent',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.backgroundColor = selectedIds.has(log.id) ? 'var(--notion-bg-hover)' : 'var(--notion-bg-hover)'}
                                            onMouseLeave={e => e.currentTarget.style.backgroundColor = selectedIds.has(log.id) ? 'var(--notion-bg-hover)' : 'transparent'}
                                        >
                                            {/* Checkbox - Super Admin only */}
                                            {isSuperAdmin && (
                                                <div
                                                    onClick={() => toggleSelectLog(log.id)}
                                                    style={{
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        flexShrink: 0,
                                                        marginTop: '8px',
                                                        color: selectedIds.has(log.id) ? 'var(--notion-blue)' : 'var(--notion-text-secondary)',
                                                    }}
                                                >
                                                    {selectedIds.has(log.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                                                </div>
                                            )}
                                            {/* Action Icon */}
                                            <div style={{
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: 'var(--radius-md)',
                                                backgroundColor: actionConfig.bg,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: actionConfig.color,
                                                flexShrink: 0,
                                            }}>
                                                <ActionIcon size={18} />
                                            </div>

                                            {/* Content */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '4px' }}>
                                                    <span style={{
                                                        padding: '2px 8px',
                                                        borderRadius: 'var(--radius-sm)',
                                                        backgroundColor: actionConfig.bg,
                                                        color: actionConfig.color,
                                                        fontSize: '11px',
                                                        fontWeight: '600',
                                                    }}>
                                                        {log.action}
                                                    </span>
                                                    <span style={{ fontSize: '14px', color: 'var(--notion-text)' }}>
                                                        {log.entityType}
                                                    </span>
                                                    {log.entityName && (
                                                        <span style={{ fontSize: '14px', color: 'var(--notion-text-secondary)' }}>
                                                            - {log.entityName}
                                                        </span>
                                                    )}
                                                </div>

                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 'var(--space-4)',
                                                    fontSize: '12px',
                                                    color: 'var(--notion-text-secondary)',
                                                }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <User size={12} />
                                                        {log.userName}
                                                    </span>
                                                    <span style={{
                                                        padding: '1px 6px',
                                                        borderRadius: 'var(--radius-sm)',
                                                        backgroundColor: 'var(--notion-bg-tertiary)',
                                                        fontSize: '10px',
                                                    }}>
                                                        {log.userRole}
                                                    </span>
                                                    <span style={{ fontFamily: 'monospace', fontSize: '11px', color: log.ipAddress ? 'var(--notion-text-secondary)' : 'var(--notion-text-muted)' }}>
                                                        {log.ipAddress || 'IP: N/A'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Timestamp */}
                                            <div style={{
                                                textAlign: 'right',
                                                flexShrink: 0,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                fontSize: '12px',
                                                color: 'var(--notion-text-secondary)',
                                            }}>
                                                <Clock size={12} />
                                                <span>{timestamp.date}</span>
                                                <span style={{ color: 'var(--notion-text-muted)' }}>{timestamp.time}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Pagination */}
                        {pagination.totalPages > 1 && (
                            <div style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: 'var(--space-3)',
                                marginTop: 'var(--space-6)',
                            }}>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => goToPage(pagination.page - 1)}
                                    disabled={pagination.page === 1}
                                >
                                    <ChevronLeft size={14} />
                                </Button>

                                <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                                    Page {pagination.page} of {pagination.totalPages}
                                </span>

                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => goToPage(pagination.page + 1)}
                                    disabled={pagination.page === pagination.totalPages}
                                >
                                    <ChevronRight size={14} />
                                </Button>
                            </div>
                        )}
                </div>
            </DashboardLayout>

            {/* Delete Confirmation Modal */}
            {
                showDeleteConfirm && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999,
                    }}>
                        <div style={{
                            backgroundColor: 'var(--notion-bg)',
                            borderRadius: 'var(--radius-lg)',
                            padding: 'var(--space-6)',
                            maxWidth: '400px',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                        }}>
                            <h3 style={{
                                fontSize: '18px',
                                fontWeight: '600',
                                color: 'var(--notion-text)',
                                marginBottom: 'var(--space-3)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-2)',
                            }}>
                                <Trash2 size={20} style={{ color: 'var(--notion-red)' }} />
                                Delete Audit Logs
                            </h3>
                            <p style={{
                                fontSize: '14px',
                                color: 'var(--notion-text-secondary)',
                                marginBottom: 'var(--space-5)',
                                lineHeight: 1.5,
                            }}>
                                Are you sure you want to permanently delete {selectedIds.size} audit log(s)?
                                This action cannot be undone.
                            </p>
                            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                                <Button
                                    variant="secondary"
                                    onClick={() => setShowDeleteConfirm(false)}
                                    disabled={isDeleting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleDeleteSelected}
                                    disabled={isDeleting}
                                    style={{
                                        backgroundColor: 'var(--notion-red)',
                                        color: 'white',
                                    }}
                                >
                                    {isDeleting ? 'Deleting...' : 'Delete Permanently'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }
        </>
    );
}
