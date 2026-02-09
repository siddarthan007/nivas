'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { usePermissions } from '@/lib/hooks/usePermissions';
import {
    Plus,
    Search,
    UtensilsCrossed,
    Trash2,
    Edit,
    AlertCircle,
    CheckCircle2,
    XCircle,
    LayoutGrid
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import Button from '@/components/ui/Button';
import PageContainer from '@/components/layout/PageContainer';
import DashboardLayout from '@/components/layout/DashboardLayout';

// Types
interface Table {
    id: number;
    tableNumber: string;
    capacity: number;
    location: string;
    status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'DIRTY';
}

const LOCATION_OPTIONS = ['MAIN_HALL', 'TERRACE', 'GARDEN', 'BAR', 'PRIVATE_ROOM'];
const STATUS_OPTIONS = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'DIRTY'];

// Table Modal Component
function TableModal({
    isOpen,
    onClose,
    onSave,
    initialData
}: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<Table>) => Promise<void>;
    initialData?: Table;
}) {
    const [formData, setFormData] = useState<Partial<Table>>({
        tableNumber: initialData?.tableNumber || '',
        capacity: initialData?.capacity || 4,
        location: initialData?.location || 'MAIN_HALL',
        status: initialData?.status || 'AVAILABLE'
    });
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSave(formData);
            onClose();
        } catch (error) {
            console.error('Failed to save table:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)'
        }}>
            <div style={{
                backgroundColor: 'var(--notion-bg)',
                borderRadius: 'var(--radius-lg)',
                width: '100%',
                maxWidth: '400px',
                padding: 'var(--space-6)',
                border: '1px solid var(--notion-border)',
                boxShadow: 'var(--shadow-lg)'
            }}>
                <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    marginBottom: 'var(--space-4)',
                    color: 'var(--notion-text)'
                }}>
                    {initialData ? 'Edit Table' : 'Add New Table'}
                </h3>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px' }}>
                            Table Number
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.tableNumber}
                            onChange={e => setFormData({ ...formData, tableNumber: e.target.value })}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--notion-border)',
                                backgroundColor: 'var(--notion-bg-secondary)',
                                color: 'var(--notion-text)',
                                fontSize: '14px'
                            }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px' }}>
                            Capacity
                        </label>
                        <input
                            type="number"
                            min="1"
                            required
                            value={formData.capacity}
                            onChange={e => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--notion-border)',
                                backgroundColor: 'var(--notion-bg-secondary)',
                                color: 'var(--notion-text)',
                                fontSize: '14px'
                            }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px' }}>
                            Location
                        </label>
                        <select
                            value={formData.location}
                            onChange={e => setFormData({ ...formData, location: e.target.value })}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--notion-border)',
                                backgroundColor: 'var(--notion-bg-secondary)',
                                color: 'var(--notion-text)',
                                fontSize: '14px'
                            }}
                        >
                            {LOCATION_OPTIONS.map(loc => (
                                <option key={loc} value={loc}>{loc.replace('_', ' ')}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px' }}>
                            Status
                        </label>
                        <select
                            value={formData.status}
                            onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--notion-border)',
                                backgroundColor: 'var(--notion-bg-secondary)',
                                color: 'var(--notion-text)',
                                fontSize: '14px'
                            }}
                        >
                            {STATUS_OPTIONS.map(status => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                        <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="primary" loading={loading}>
                            {initialData ? 'Update' : 'Create'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function TablePlanPage() {
    const { user } = useAuth();
    const { can } = usePermissions();
    const [searchQuery, setSearchQuery] = useState('');
    const [locationFilter, setLocationFilter] = useState<string>('ALL');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingTable, setEditingTable] = useState<Table | null>(null);
    const [tables, setTables] = useState<Table[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchTables = async () => {
        if (!user?.hotelId) return;
        setIsLoading(true);
        try {
            const res = await api.get<{ data: Table[] }>('/operations/tables');
            setTables(res?.data?.data || []);
        } catch (error) {
            console.error('Failed to fetch tables:', error);
            toast.error('Failed to fetch tables');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTables();
    }, [user?.hotelId]);

    // Derived state
    const filteredTables = useMemo(() => {
        return tables.filter(t => {
            const matchesSearch = (t.tableNumber || '').toLowerCase().includes(searchQuery.toLowerCase());
            const matchesLocation = locationFilter === 'ALL' || t.location === locationFilter;
            return matchesSearch && matchesLocation;
        });
    }, [tables, searchQuery, locationFilter]);

    // Actions
    const handleCreate = async (data: Partial<Table>) => {
        try {
            await api.post('/operations/tables', data);
            toast.success('Table created successfully');
            fetchTables();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to create table');
            throw err;
        }
    };

    const handleUpdate = async (data: Partial<Table>) => {
        if (!editingTable) return;
        try {
            await api.patch(`/operations/tables/${editingTable.id}`, data);
            toast.success('Table updated successfully');
            fetchTables();
            setEditingTable(null);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to update table');
            throw err;
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this table?')) return;
        try {
            await api.delete(`/operations/tables/${id}`);
            toast.success('Table deleted successfully');
            fetchTables();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to delete table');
        }
    };

    // Status Badge Helper
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'AVAILABLE': return { bg: 'var(--notion-green-bg)', text: 'var(--notion-green)', icon: CheckCircle2 };
            case 'OCCUPIED': return { bg: 'var(--notion-red-bg)', text: 'var(--notion-red)', icon: XCircle };
            case 'RESERVED': return { bg: 'var(--notion-purple-bg)', text: 'var(--notion-purple)', icon: AlertCircle };
            case 'DIRTY': return { bg: 'var(--notion-yellow-bg)', text: 'var(--notion-yellow)', icon: UtensilsCrossed };
            default: return { bg: 'var(--notion-gray-bg)', text: 'var(--notion-gray)', icon: AlertCircle };
        }
    };

    return (
        <DashboardLayout>
            <PageContainer>
                <div style={{ padding: 'var(--space-6)', maxWidth: '1200px', margin: '0 auto' }}>
                    {/* Header */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 'var(--space-6)'
                    }}>
                        <div>
                            <h1 style={{
                                fontSize: '24px',
                                fontWeight: '600',
                                color: 'var(--notion-text)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-2)'
                            }}>
                                <LayoutGrid size={24} />
                                Table Management
                            </h1>
                            <p style={{ color: 'var(--notion-text-secondary)', fontSize: '14px' }}>
                                Manage restaurant tables, capacities, and locations.
                            </p>
                        </div>
                        {can('operations:setup_facilities') && (
                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                <Button
                                    variant="primary"
                                    onClick={() => setIsAddModalOpen(true)}
                                    icon={<Plus size={16} />}
                                >
                                    Add Table
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Filters */}
                    <div style={{
                        display: 'flex',
                        gap: 'var(--space-4)',
                        marginBottom: 'var(--space-6)',
                        flexWrap: 'wrap'
                    }}>
                        <div style={{
                            position: 'relative',
                            flex: 1,
                            minWidth: '200px',
                            maxWidth: '400px'
                        }}>
                            <Search
                                size={16}
                                style={{
                                    position: 'absolute',
                                    left: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--notion-text-secondary)'
                                }}
                            />
                            <input
                                type="text"
                                placeholder="Search by table number..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px 12px 8px 36px',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--notion-border)',
                                    backgroundColor: 'var(--notion-bg-secondary)',
                                    color: 'var(--notion-text)',
                                    fontSize: '14px'
                                }}
                            />
                        </div>

                        <select
                            value={locationFilter}
                            onChange={(e) => setLocationFilter(e.target.value)}
                            style={{
                                padding: '8px 12px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--notion-border)',
                                backgroundColor: 'var(--notion-bg-secondary)',
                                color: 'var(--notion-text)',
                                fontSize: '14px',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="ALL">All Locations</option>
                            {LOCATION_OPTIONS.map(loc => (
                                <option key={loc} value={loc}>{loc.replace('_', ' ')}</option>
                            ))}
                        </select>

                        <Button variant="secondary" onClick={() => window.location.href = '/dashboard/operations/floor-plan'}>
                            View Visual Plan
                        </Button>
                    </div>

                    {/* Zone Summary Stats */}
                    <div style={{
                        display: 'flex',
                        gap: 'var(--space-3)',
                        marginBottom: 'var(--space-4)',
                        flexWrap: 'wrap',
                    }}>
                        {STATUS_OPTIONS.map(status => {
                            const count = tables.filter(t => t.status === status).length;
                            const statusStyle = getStatusColor(status);
                            return (
                                <div key={status} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 16px',
                                    borderRadius: 'var(--radius-md)',
                                    backgroundColor: statusStyle.bg,
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    color: statusStyle.text,
                                    cursor: 'pointer',
                                    border: locationFilter === status ? `2px solid ${statusStyle.text}` : '2px solid transparent',
                                }} onClick={() => setLocationFilter(locationFilter === status ? 'ALL' : status)}>
                                    <span>{count}</span>
                                    <span>{(status || '').toLowerCase()}</span>
                                </div>
                            );
                        })}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 16px',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--notion-bg-secondary)',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: 'var(--notion-text)',
                        }}>
                            Total: {tables.length} tables · {tables.reduce((sum, t) => sum + t.capacity, 0)} seats
                        </div>
                    </div>

                    {/* Table Grid */}
                    {isLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                            <div className="animate-spin" style={{ width: 24, height: 24, border: '3px solid var(--notion-border)', borderTopColor: 'var(--notion-blue)', borderRadius: '50%' }} />
                        </div>
                    ) : filteredTables.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '60px 20px',
                            color: 'var(--notion-text-secondary)',
                            backgroundColor: 'var(--notion-bg-secondary)',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--notion-border)'
                        }}>
                            <UtensilsCrossed size={40} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                            <h3>No tables found</h3>
                            <p>Try adjusting your search or add a new table.</p>
                        </div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                            gap: 'var(--space-4)'
                        }}>
                            {filteredTables.map(table => {
                                const statusColor = getStatusColor(table.status);
                                const StatusIcon = statusColor.icon;

                                return (
                                    <div key={table.id} style={{
                                        backgroundColor: 'var(--notion-bg)',
                                        border: '1px solid var(--notion-border)',
                                        borderRadius: 'var(--radius-md)',
                                        padding: 'var(--space-4)',
                                        transition: 'all 0.2s ease',
                                        position: 'relative'
                                    }}>
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            marginBottom: 'var(--space-2)'
                                        }}>
                                            <h3 style={{ fontSize: '18px', fontWeight: '600' }}>
                                                Table {table.tableNumber}
                                            </h3>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                fontSize: '12px',
                                                padding: '2px 8px',
                                                borderRadius: 'var(--radius-full)',
                                                backgroundColor: statusColor.bg,
                                                color: statusColor.text
                                            }}>
                                                <StatusIcon size={12} />
                                                {table.status}
                                            </div>
                                        </div>

                                        <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '4px',
                                            fontSize: '13px',
                                            color: 'var(--notion-text-secondary)',
                                            marginBottom: 'var(--space-4)'
                                        }}>
                                            <div>Capacity: {table.capacity} pax</div>
                                            <div>Location: {(table.location || '').replace('_', ' ') || '-'}</div>
                                        </div>

                                        <div style={{
                                            display: 'flex',
                                            gap: '8px',
                                            borderTop: '1px solid var(--notion-border)',
                                            paddingTop: 'var(--space-3)'
                                        }}>
                                            {table.status === 'OCCUPIED' && (
                                                <Button
                                                    size="sm"
                                                    variant="primary"
                                                    style={{ flex: 1 }}
                                                    onClick={() => { window.location.href = `/dashboard/orders?table=${table.tableNumber}`; }}
                                                    icon={<UtensilsCrossed size={14} />}
                                                >
                                                    Take Order
                                                </Button>
                                            )}
                                            {can('operations:setup_facilities') && (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        style={{ flex: 1 }}
                                                        onClick={() => setEditingTable(table)}
                                                        icon={<Edit size={14} />}
                                                    >
                                                        Edit
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="danger"
                                                        onClick={() => handleDelete(table.id)}
                                                        icon={<Trash2 size={14} />}
                                                    >
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Modals */}
                    <TableModal
                        isOpen={isAddModalOpen}
                        onClose={() => setIsAddModalOpen(false)}
                        onSave={handleCreate}
                    />

                    {editingTable && (
                        <TableModal
                            isOpen={!!editingTable}
                            onClose={() => setEditingTable(null)}
                            onSave={handleUpdate}
                            initialData={editingTable}
                        />
                    )}
                </div>
            </PageContainer>
        </DashboardLayout>
    );
}
