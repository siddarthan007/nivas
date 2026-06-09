
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useRouter } from '@/lib/router';
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
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
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

const STATUS_OPTIONS = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'DIRTY'];

// Table Modal Component
function TableModal({
    isOpen,
    onClose,
    onSave,
    initialData,
    locations
}: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<Table>) => Promise<void>;
    initialData?: Table;
    locations: string[];
}) {
    const [formData, setFormData] = useState<Partial<Table>>({
        tableNumber: '',
        capacity: 4,
        location: 'MAIN_HALL',
        status: 'AVAILABLE'
    });
    const [loading, setLoading] = useState(false);
    const [customLocation, setCustomLocation] = useState('');
    const [showCustomInput, setShowCustomInput] = useState(false);

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    tableNumber: initialData.tableNumber || '',
                    capacity: initialData.capacity || 4,
                    location: initialData.location || 'MAIN_HALL',
                    status: initialData.status || 'AVAILABLE'
                });
            } else {
                setFormData({ tableNumber: '', capacity: 4, location: locations[0] || 'MAIN_HALL', status: 'AVAILABLE' });
            }
            setCustomLocation('');
            setShowCustomInput(false);
        }
    }, [isOpen, initialData, locations]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const saveData = { ...formData };
            if (showCustomInput && customLocation.trim()) {
                saveData.location = customLocation.trim().toUpperCase().replace(/\s+/g, '_');
            }
            await onSave(saveData);
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
            backgroundColor: 'var(--notion-overlay)',
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
                    <Input
                        label="Table Number"
                        type="text"
                        required
                        value={formData.tableNumber}
                        onChange={e => setFormData({ ...formData, tableNumber: e.target.value })}
                    />

                    <Input
                        label="Capacity"
                        type="number"
                        min="1"
                        required
                        value={formData.capacity}
                        onChange={e => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                    />

                    <div>
                        <label style={{ display: 'block', fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px' }}>
                            Location
                        </label>
                        {!showCustomInput ? (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <Select
                                    value={formData.location}
                                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                                    options={locations.map(loc => ({ value: loc, label: loc.replace(/_/g, ' ') }))}
                                    style={{ flex: 1 }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCustomInput(true)}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--notion-border)',
                                        backgroundColor: 'var(--notion-bg-secondary)',
                                        color: 'var(--notion-blue)',
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    + New
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <Input
                                    type="text"
                                    placeholder="e.g. Rooftop"
                                    value={customLocation}
                                    onChange={e => setCustomLocation(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => { setShowCustomInput(false); setCustomLocation(''); }}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--notion-border)',
                                        backgroundColor: 'var(--notion-bg-secondary)',
                                        color: 'var(--notion-text-secondary)',
                                        fontSize: '13px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>

                    <Select
                        label="Status"
                        value={formData.status}
                        onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                        options={STATUS_OPTIONS.map(status => ({ value: status, label: status }))}
                        fullWidth
                    />

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

// Locations Management Modal
function LocationsModal({
    isOpen,
    onClose,
    locations,
    tables,
    onRename,
    onDelete,
    onAdd
}: {
    isOpen: boolean;
    onClose: () => void;
    locations: string[];
    tables: Table[];
    onRename: (oldLoc: string, newLoc: string) => Promise<void>;
    onDelete: (loc: string) => Promise<void>;
    onAdd: (name: string) => void;
}) {
    const [editingLoc, setEditingLoc] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [newName, setNewName] = useState('');
    const [showAdd, setShowAdd] = useState(false);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'var(--notion-overlay)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'
        }}>
            <div style={{
                backgroundColor: 'var(--notion-bg)', borderRadius: 'var(--radius-lg)',
                width: '100%', maxWidth: '480px', maxHeight: '80vh', overflow: 'auto',
                padding: 'var(--space-6)', border: '1px solid var(--notion-border)', boxShadow: 'var(--shadow-lg)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--notion-text)' }}>Manage Locations</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--notion-text-secondary)' }}><XCircle size={20} /></button>
                </div>

                {showAdd ? (
                    <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                        <Input type="text" placeholder="e.g. Rooftop" value={newName} onChange={e => setNewName(e.target.value)} style={{ flex: 1 }} />
                        <Button size="sm" variant="primary" onClick={() => { if (newName.trim()) { onAdd(newName.trim()); setNewName(''); setShowAdd(false); } }}>Add</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setShowAdd(false); setNewName(''); }}>Cancel</Button>
                    </div>
                ) : (
                    <Button size="sm" variant="secondary" onClick={() => setShowAdd(true)} icon={<Plus size={14} />} style={{ marginBottom: 'var(--space-4)' }}>
                        Add Location
                    </Button>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {locations.filter(loc => loc !== 'ALL').map(loc => {
                        const count = tables.filter(t => t.location === loc).length;
                        const isEditing = editingLoc === loc;
                        return (
                            <div key={loc} style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '10px 12px', backgroundColor: 'var(--notion-bg-secondary)',
                                borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)'
                            }}>
                                {isEditing ? (
                                    <>
                                        <Input type="text" value={editValue} onChange={e => setEditValue(e.target.value)}
                                            style={{ flex: 1, fontSize: '13px' }} autoFocus
                                            onKeyDown={e => { if (e.key === 'Enter') { onRename(loc, editValue); setEditingLoc(null); } if (e.key === 'Escape') setEditingLoc(null); }}
                                        />
                                        <button onClick={() => { onRename(loc, editValue); setEditingLoc(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--notion-green)' }}><CheckCircle2 size={16} /></button>
                                        <button onClick={() => setEditingLoc(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--notion-red)' }}><XCircle size={16} /></button>
                                    </>
                                ) : (
                                    <>
                                        <span style={{ flex: 1, fontWeight: 500, color: 'var(--notion-text)', fontSize: '14px' }}>{loc.replace(/_/g, ' ')}</span>
                                        <span style={{ color: 'var(--notion-text-secondary)', fontSize: '12px' }}>{count} tables</span>
                                        <button onClick={() => { setEditingLoc(loc); setEditValue(loc.replace(/_/g, ' ')); }} title="Rename" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--notion-text-secondary)', padding: '4px' }}><Edit size={14} /></button>
                                        <button onClick={() => onDelete(loc)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--notion-red)', padding: '4px' }}><Trash2 size={14} /></button>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default function TablePlanPage() {
    const { user } = useAuth();
    const { can } = usePermissions();
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [locationFilter, setLocationFilter] = useState<string>('ALL');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingTable, setEditingTable] = useState<Table | null>(null);
    const [tables, setTables] = useState<Table[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [showAddLocation, setShowAddLocation] = useState(false);
    const [extraLocations, setExtraLocations] = useState<string[]>([]);

    const fetchTables = async () => {
        if (!user?.hotelId) return;
        setIsLoading(true);
        try {
            const res = await api.get<Table[]>('/operations/tables');
            setTables(res?.data || []);
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

    // Derive dynamic locations from existing tables + extras
    const dynamicLocations = useMemo(() => {
        const fromTables = [...new Set(tables.map(t => t.location).filter(Boolean))];
        const defaults = ['MAIN_HALL', 'TERRACE', 'GARDEN', 'BAR', 'PRIVATE_ROOM'];
        return [...new Set([...defaults, ...fromTables, ...extraLocations])];
    }, [tables, extraLocations]);

    // Derived state
    const filteredTables = useMemo(() => {
        return tables.filter(t => {
            const matchesSearch = (t.tableNumber || '').toLowerCase().includes(searchQuery.toLowerCase());
            const matchesLocation = locationFilter === 'ALL' || t.location === locationFilter;
            const matchesStatus = !statusFilter || t.status === statusFilter;
            return matchesSearch && matchesLocation && matchesStatus;
        });
    }, [tables, searchQuery, locationFilter, statusFilter]);

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

    // Locations CRUD handlers
    const handleRenameLocation = async (oldLocation: string, newValue?: string) => {
        const newName = (newValue ?? '').trim().toUpperCase().replace(/\s+/g, '_');
        if (!newName || newName === oldLocation) return;
        const tablesToUpdate = tables.filter(t => t.location === oldLocation);
        if (tablesToUpdate.length === 0) return;
        try {
            await Promise.all(
                tablesToUpdate.map(t => api.patch(`/operations/tables/${t.id}`, { location: newName }))
            );
            toast.success(`Location renamed to ${newName.replace(/_/g, ' ')}`);
            fetchTables();
        } catch {
            toast.error('Failed to rename location');
        }
    };

    const handleDeleteLocation = async (location: string) => {
        const tablesAtLocation = tables.filter(t => t.location === location);
        if (tablesAtLocation.length > 0) {
            if (!confirm(`Move ${tablesAtLocation.length} table(s) to MAIN_HALL and delete this location?`)) return;
            try {
                await Promise.all(
                    tablesAtLocation.map(t => api.patch(`/operations/tables/${t.id}`, { location: 'MAIN_HALL' }))
                );
                toast.success('Location removed, tables moved to Main Hall');
                fetchTables();
            } catch {
                toast.error('Failed to remove location');
            }
        }
    };

    const handleAddLocation = (rawName?: string) => {
        const name = (rawName ?? '').trim().toUpperCase().replace(/\s+/g, '_');
        if (!name) {
            toast.error('Location name is required');
            return;
        }
        if (dynamicLocations.includes(name)) {
            toast.error('Location already exists');
            return;
        }
        setExtraLocations(prev => [...prev, name]);
        toast.success('Location added');
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
                            flex: 1,
                            minWidth: '200px',
                            maxWidth: '400px'
                        }}>
                            <Input
                                type="text"
                                placeholder="Search by table number..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                icon={<Search size={16} />}
                            />
                        </div>

                        <Select
                            value={locationFilter}
                            onChange={(e) => setLocationFilter(e.target.value)}
                            options={[
                                { value: 'ALL', label: 'All Locations' },
                                ...dynamicLocations.map((loc: string) => ({ value: loc, label: loc.replace(/_/g, ' ') })),
                            ]}
                        />

                        <Button variant="secondary" onClick={() => router.push('/hotel/operations/floor-plan')}>
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
                                    border: statusFilter === status ? `2px solid ${statusStyle.text}` : '2px solid transparent',
                                }} onClick={() => setStatusFilter(statusFilter === status ? '' : status)}>
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

                    {/* Locations Management */}
                    {can('operations:setup_facilities') && (
                        <div style={{
                            marginBottom: 'var(--space-6)',
                            padding: 'var(--space-4)',
                            backgroundColor: 'var(--notion-bg-secondary)',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--notion-border)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}>
                            <div>
                                <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--notion-text)' }}>Locations</h3>
                                <p style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', marginTop: '2px' }}>{dynamicLocations.filter(l => l !== 'ALL').length} zones configured</p>
                            </div>
                            <Button size="sm" variant="secondary" onClick={() => setShowAddLocation(true)} icon={<Edit size={14} />}>Manage Locations</Button>
                        </div>
                    )}

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
                                                    onClick={() => { router.push(`/hotel/orders?table=${table.tableNumber}`); }}
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
                                                    />
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
                        locations={dynamicLocations}
                    />

                    {editingTable && (
                        <TableModal
                            isOpen={!!editingTable}
                            onClose={() => setEditingTable(null)}
                            onSave={handleUpdate}
                            initialData={editingTable}
                            locations={dynamicLocations}
                        />
                    )}

                    <LocationsModal
                        isOpen={showAddLocation}
                        onClose={() => setShowAddLocation(false)}
                        locations={dynamicLocations}
                        tables={tables}
                        onRename={handleRenameLocation}
                        onDelete={handleDeleteLocation}
                        onAdd={handleAddLocation}
                    />
                </div>
            </PageContainer>
        </DashboardLayout>
    );
}
