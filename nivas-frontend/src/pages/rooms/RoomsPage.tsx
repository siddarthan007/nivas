'use client';

import { useState, useEffect } from 'react';
import { useRooms } from '@/lib/hooks/useRooms';
import { useRoomTypes, type RoomTypeItem } from '@/lib/hooks/useRoomTypes';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import {
    Bed,
    Plus,
    RefreshCw,
    Search,
    MoreVertical,
    Edit2,
    Wrench,
    CheckCircle,
    Trash2,
    Tags,
    X,
    Loader2,
    Settings2,
} from 'lucide-react';
import type { Room, RoomStatus, RoomType, CreateRoomPayload } from '@/lib/types/api.types';

// Status color mapping
const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
    VACANT: { bg: 'var(--notion-green-bg)', text: 'var(--notion-green)', label: 'Vacant' },
    AVAILABLE: { bg: 'var(--notion-green-bg)', text: 'var(--notion-green)', label: 'Available' },
    OCCUPIED: { bg: 'var(--notion-blue-bg)', text: 'var(--notion-blue)', label: 'Occupied' },
    DIRTY: { bg: 'var(--notion-yellow-bg)', text: 'var(--notion-orange)', label: 'Dirty' },
    MAINTENANCE: { bg: 'var(--notion-red-bg)', text: 'var(--notion-red)', label: 'Maintenance' },
    OUT_OF_ORDER: { bg: 'rgba(120,120,120,0.2)', text: '#666', label: 'Out of Order' },
};

const DEFAULT_STATUS_COLOR = { bg: 'var(--notion-green-bg)', text: 'var(--notion-green)', label: 'Available' };

// Room Card Component
function RoomCard({
    room,
    onEdit,
    onStatusChange
}: {
    room: Room;
    onEdit: (room: Room) => void;
    onStatusChange: (id: number, status: RoomStatus) => void;
}) {
    const [showMenu, setShowMenu] = useState(false);
    const statusInfo = STATUS_COLORS[room.status] || DEFAULT_STATUS_COLOR;

    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--notion-border)',
            padding: 'var(--space-4)',
            position: 'relative',
            transition: 'transform 150ms ease, box-shadow 150ms ease',
        }}
            onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
                setShowMenu(false);
            }}
        >
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 'var(--space-3)'
            }}>
                <div>
                    <div style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        color: 'var(--notion-text)',
                    }}>
                        Room {room.number}
                    </div>
                    {room.name && (
                        <div style={{
                            fontSize: '12px',
                            color: 'var(--notion-text-secondary)',
                            marginTop: '2px'
                        }}>
                            {room.name}
                        </div>
                    )}
                </div>

                {/* Actions Menu */}
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            padding: '4px',
                            cursor: 'pointer',
                            color: 'var(--notion-text-secondary)',
                            borderRadius: 'var(--radius-sm)',
                        }}
                    >
                        <MoreVertical size={16} />
                    </button>

                    {showMenu && (
                        <div style={{
                            position: 'absolute',
                            right: 0,
                            top: '100%',
                            backgroundColor: 'var(--notion-bg)',
                            border: '1px solid var(--notion-border)',
                            borderRadius: 'var(--radius-md)',
                            boxShadow: 'var(--shadow-lg)',
                            zIndex: 10,
                            minWidth: '140px',
                            padding: '4px',
                        }}>
                            <button
                                onClick={() => { onEdit(room); setShowMenu(false); }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-2)',
                                    width: '100%',
                                    padding: '8px 12px',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    color: 'var(--notion-text)',
                                    borderRadius: 'var(--radius-sm)',
                                }}
                            >
                                <Edit2 size={14} /> Edit
                            </button>
                            {room.status === 'MAINTENANCE' ? (
                                <button
                                    onClick={() => { onStatusChange(room.id, 'AVAILABLE'); setShowMenu(false); }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--space-2)',
                                        width: '100%',
                                        padding: '8px 12px',
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        color: 'var(--notion-green)',
                                        borderRadius: 'var(--radius-sm)',
                                    }}
                                >
                                    <CheckCircle size={14} /> Mark Available
                                </button>
                            ) : (
                                <button
                                    onClick={() => { onStatusChange(room.id, 'MAINTENANCE'); setShowMenu(false); }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--space-2)',
                                        width: '100%',
                                        padding: '8px 12px',
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        color: 'var(--notion-orange)',
                                        borderRadius: 'var(--radius-sm)',
                                    }}
                                >
                                    <Wrench size={14} /> Maintenance
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Status Badge */}
            <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                backgroundColor: statusInfo.bg,
                borderRadius: '12px',
                marginBottom: 'var(--space-3)',
            }}>
                <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: statusInfo.text,
                }} />
                <span style={{
                    fontSize: '12px',
                    fontWeight: '500',
                    color: statusInfo.text,
                }}>
                    {statusInfo.label}
                </span>
            </div>

            {/* Details */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: 'var(--space-3)',
                borderTop: '1px solid var(--notion-divider)',
            }}>
                <span style={{
                    fontSize: '12px',
                    color: 'var(--notion-text-secondary)',
                    textTransform: 'capitalize',
                }}>
                    {(room.type || '').toLowerCase().replace('_', ' ')}
                </span>
                <span style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: 'var(--notion-text)',
                }}>
                    ₹{(room.rate || 0).toLocaleString()}
                </span>
            </div>
        </div>
    );
}

// Stats Bar Component
function StatsBar({ stats }: { stats: { total: number; vacant: number; occupied: number; dirty: number; maintenance: number } }) {
    return (
        <div style={{
            display: 'flex',
            gap: 'var(--space-4)',
            marginBottom: 'var(--space-6)',
            flexWrap: 'wrap',
        }}>
            {[
                { label: 'Total', value: stats.total, color: 'var(--notion-text)' },
                { label: 'Vacant', value: stats.vacant, color: 'var(--notion-green)' },
                { label: 'Occupied', value: stats.occupied, color: 'var(--notion-blue)' },
                { label: 'Dirty', value: stats.dirty, color: 'var(--notion-orange)' },
                { label: 'Maintenance', value: stats.maintenance, color: 'var(--notion-red)' },
            ].map(stat => (
                <div key={stat.label} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                }}>
                    <span style={{
                        fontSize: '20px',
                        fontWeight: '600',
                        color: stat.color,
                    }}>
                        {stat.value}
                    </span>
                    <span style={{
                        fontSize: '13px',
                        color: 'var(--notion-text-secondary)',
                    }}>
                        {stat.label}
                    </span>
                </div>
            ))}
        </div>
    );
}

// Room Form Modal
function RoomFormModal({
    isOpen,
    onClose,
    onSubmit,
    initialData,
    roomTypes,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: CreateRoomPayload) => Promise<void>;
    initialData?: Room | null;
    roomTypes: RoomTypeItem[];
}) {
    const defaultType = roomTypes.find(rt => rt.isActive)?.code || 'STANDARD';
    const [formData, setFormData] = useState<CreateRoomPayload>({
        number: initialData?.number ?? ('' as unknown as number),
        name: initialData?.name || '',
        type: initialData?.type || defaultType,
        rate: initialData?.rate ?? ('' as unknown as number),
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset form when initialData changes (switching between edit/create)
    useEffect(() => {
        setFormData({
            number: initialData?.number ?? ('' as unknown as number),
            name: initialData?.name || '',
            type: initialData?.type || defaultType,
            rate: initialData?.rate ?? ('' as unknown as number),
        });
    }, [initialData, defaultType]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        await onSubmit(formData);
        setIsSubmitting(false);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={initialData ? 'Edit Room' : 'Add New Room'}
        >
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                        Room Number *
                    </label>
                    <Input
                        type="number"
                        value={formData.number}
                        onChange={e => setFormData({ ...formData, number: e.target.value === '' ? ('' as unknown as number) : parseInt(e.target.value) })}
                        placeholder="101"
                        required
                    />
                </div>

                <div>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                        Room Name (Optional)
                    </label>
                    <Input
                        type="text"
                        value={formData.name || ''}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Honeymoon Suite"
                    />
                </div>

                <div>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                        Room Type *
                    </label>
                    <Select
                        value={formData.type}
                        onChange={e => setFormData({ ...formData, type: e.target.value as RoomType })}
                        options={roomTypes.filter(rt => rt.isActive).map(rt => ({
                            value: rt.code,
                            label: rt.name
                        }))}
                    />
                </div>

                <div>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                        Rate per Night (₹) *
                    </label>
                    <Input
                        type="number"
                        value={formData.rate}
                        onChange={e => setFormData({ ...formData, rate: e.target.value === '' ? ('' as unknown as number) : parseFloat(e.target.value) })}
                        placeholder="2500"
                        required
                    />
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting || !formData.number || formData.number <= 0 || !formData.rate || formData.rate <= 0} style={{ flex: 1 }}>
                        {isSubmitting ? 'Saving...' : (initialData ? 'Update Room' : 'Add Room')}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

// Room Types Manager Modal
function RoomTypesManager({
    isOpen,
    onClose,
    roomTypes,
    onCreate,
    onUpdate,
    onDelete,
}: {
    isOpen: boolean;
    onClose: () => void;
    roomTypes: RoomTypeItem[];
    onCreate: (data: { name: string; code: string; description?: string; baseRate?: string }) => Promise<any>;
    onUpdate: (id: number, data: Partial<RoomTypeItem>) => Promise<any>;
    onDelete: (id: number) => Promise<void>;
}) {
    const [newName, setNewName] = useState('');
    const [newCode, setNewCode] = useState('');
    const [newRate, setNewRate] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [editRate, setEditRate] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleCreate = async () => {
        if (!newName.trim()) return;
        setIsSaving(true);
        try {
            await onCreate({
                name: newName.trim(),
                code: newCode.trim() || newName.trim().toUpperCase().replace(/\s+/g, '_'),
                baseRate: newRate || '0',
            });
            setNewName('');
            setNewCode('');
            setNewRate('');
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdate = async (id: number) => {
        setIsSaving(true);
        try {
            await onUpdate(id, { name: editName, baseRate: editRate });
            setEditingId(null);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this room type? Rooms using it will keep their current type.')) return;
        await onDelete(id);
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
            <div style={{
                backgroundColor: 'var(--notion-bg)', borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-6)', width: '100%', maxWidth: '550px', maxHeight: '80vh', overflowY: 'auto',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--notion-text)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <Tags size={20} /> Manage Room Types
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--notion-text-muted)', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Add New */}
                <div style={{
                    display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)',
                    padding: 'var(--space-3)', backgroundColor: 'var(--notion-bg-tertiary)', borderRadius: 'var(--radius-md)',
                }}>
                    <Input
                        value={newName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)}
                        placeholder="Type name (e.g. Villa)"
                        style={{ flex: 2 }}
                    />
                    <Input
                        value={newRate}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRate(e.target.value)}
                        placeholder="Base rate"
                        type="number"
                        style={{ flex: 1 }}
                    />
                    <Button onClick={handleCreate} disabled={!newName.trim() || isSaving} size="sm">
                        {isSaving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={14} />}
                    </Button>
                </div>

                {/* List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {roomTypes.map(rt => (
                        <div key={rt.id} style={{
                            display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                            padding: 'var(--space-3)',
                            backgroundColor: 'var(--notion-bg-secondary)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--notion-border)',
                            opacity: rt.isActive ? 1 : 0.5,
                        }}>
                            {editingId === rt.id ? (
                                <>
                                    <Input
                                        value={editName}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditName(e.target.value)}
                                        style={{ flex: 2 }}
                                    />
                                    <Input
                                        value={editRate}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditRate(e.target.value)}
                                        type="number"
                                        style={{ flex: 1 }}
                                    />
                                    <Button size="sm" onClick={() => handleUpdate(rt.id)} disabled={isSaving}>
                                        <CheckCircle size={14} />
                                    </Button>
                                    <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                                        <X size={14} />
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--notion-text)' }}>{rt.name}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--notion-text-muted)', fontFamily: 'ui-monospace, monospace' }}>{rt.code}</div>
                                    </div>
                                    <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', fontWeight: '500' }}>
                                        ₹{parseFloat(rt.baseRate || '0').toLocaleString()}
                                    </span>
                                    <button
                                        onClick={() => { setEditingId(rt.id); setEditName(rt.name); setEditRate(rt.baseRate || '0'); }}
                                        style={{ background: 'none', border: 'none', color: 'var(--notion-text-secondary)', cursor: 'pointer', padding: '4px' }}
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(rt.id)}
                                        style={{ background: 'none', border: 'none', color: 'var(--notion-red)', cursor: 'pointer', padding: '4px' }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </>
                            )}
                        </div>
                    ))}
                    {roomTypes.length === 0 && (
                        <p style={{ textAlign: 'center', color: 'var(--notion-text-muted)', fontSize: '13px', padding: 'var(--space-4)' }}>
                            No room types yet. Add one above.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function RoomsPage() {
    const { rooms, isLoading, stats, fetchRooms, createRoom, updateRoom, updateStatus } = useRooms();
    const { roomTypes, createRoomType, updateRoomType, deleteRoomType } = useRoomTypes();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<RoomStatus | 'ALL'>('ALL');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingRoom, setEditingRoom] = useState<Room | null>(null);
    const [showRoomTypes, setShowRoomTypes] = useState(false);

    // Filter rooms
    const filteredRooms = rooms.filter(room => {
        const matchesSearch =
            room.number.toString().includes(searchQuery) ||
            room.name?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'ALL' || room.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const handleSubmit = async (data: CreateRoomPayload) => {
        if (editingRoom) {
            await updateRoom(editingRoom.id, data);
        } else {
            await createRoom(data);
        }
        setEditingRoom(null);
    };

    const handleEdit = (room: Room) => {
        setEditingRoom(room);
        setIsFormOpen(true);
    };

    const handleStatusChange = async (id: number, status: RoomStatus) => {
        await updateStatus(id, status);
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
                    flexWrap: 'wrap',
                    gap: 'var(--space-3)',
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
                            <Bed size={28} />
                            Rooms
                        </h1>
                        <p style={{
                            fontSize: '14px',
                            color: 'var(--notion-text-secondary)',
                            marginTop: 'var(--space-1)',
                        }}>
                            Manage hotel rooms and their availability
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                        <Button
                            variant="secondary"
                            onClick={() => setShowRoomTypes(true)}
                        >
                            <Settings2 size={14} style={{ marginRight: '6px' }} />
                            Room Types
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => fetchRooms()}
                            disabled={isLoading}
                        >
                            <RefreshCw size={14} style={{ marginRight: '6px' }} />
                            Refresh
                        </Button>
                        <Button onClick={() => { setEditingRoom(null); setIsFormOpen(true); }}>
                            <Plus size={14} style={{ marginRight: '6px' }} />
                            Add Room
                        </Button>
                    </div>
                </div>

                {/* Stats */}
                <StatsBar stats={stats} />

                {/* Filters */}
                <div style={{
                    display: 'flex',
                    gap: 'var(--space-3)',
                    marginBottom: 'var(--space-6)',
                    flexWrap: 'wrap',
                }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '200px', maxWidth: '300px' }}>
                        <Search
                            size={16}
                            style={{
                                position: 'absolute',
                                left: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--notion-text-secondary)',
                            }}
                        />
                        <input
                            type="text"
                            placeholder="Search rooms..."
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
                        onChange={e => setStatusFilter(e.target.value as RoomStatus | 'ALL')}
                        options={[
                            { value: 'ALL', label: 'All Status' },
                            { value: 'VACANT', label: 'Vacant' },
                            { value: 'OCCUPIED', label: 'Occupied' },
                            { value: 'DIRTY', label: 'Dirty' },
                            { value: 'MAINTENANCE', label: 'Maintenance' }
                        ]}
                        style={{ width: '150px' }}
                    />
                </div>

                {/* Rooms Grid */}
                {isLoading ? (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                        gap: 'var(--space-4)',
                    }}>
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} style={{
                                height: '160px',
                                backgroundColor: 'var(--notion-bg-secondary)',
                                borderRadius: 'var(--radius-lg)',
                                border: '1px solid var(--notion-border)',
                                animation: 'pulse 1.5s ease-in-out infinite',
                            }} />
                        ))}
                    </div>
                ) : filteredRooms.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: 'var(--space-12)',
                        color: 'var(--notion-text-secondary)',
                    }}>
                        <Bed size={48} style={{ opacity: 0.3, marginBottom: 'var(--space-4)' }} />
                        <p style={{ fontSize: '16px' }}>
                            {searchQuery || statusFilter !== 'ALL'
                                ? 'No rooms match your filters'
                                : 'No rooms yet. Add your first room to get started.'}
                        </p>
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                        gap: 'var(--space-4)',
                    }}>
                        {filteredRooms.map(room => (
                            <RoomCard
                                key={room.id}
                                room={room}
                                onEdit={handleEdit}
                                onStatusChange={handleStatusChange}
                            />
                        ))}
                    </div>
                )}

                {/* Room Form Modal */}
                <RoomFormModal
                    isOpen={isFormOpen}
                    onClose={() => { setIsFormOpen(false); setEditingRoom(null); }}
                    onSubmit={handleSubmit}
                    initialData={editingRoom}
                    roomTypes={roomTypes}
                />
            </div>

            {/* Room Types Manager */}
            <RoomTypesManager
                isOpen={showRoomTypes}
                onClose={() => setShowRoomTypes(false)}
                roomTypes={roomTypes}
                onCreate={createRoomType}
                onUpdate={updateRoomType}
                onDelete={deleteRoomType}
            />
        </DashboardLayout>
    );
}

