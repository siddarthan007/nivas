'use client';

import { useState, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageContainer from '@/components/layout/PageContainer';
import Button from '@/components/ui/Button';
import { useFacilities } from '@/lib/hooks/useFacilities';
import { toast } from 'sonner';
import {
    Building2,
    Car,
    Plus,
    Search,
    Clock,
    MapPin,
    Edit,
    Trash2,
    CheckCircle2,
    XCircle,
    Wrench,
    Dumbbell,
    Waves,
    Coffee,
    Utensils,
    Wifi,
    RefreshCw,
    Loader2
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

// Import types from hook
import type { Facility, ParkingSpace, CreateFacilityPayload, CreateParkingPayload } from '@/lib/hooks/useFacilities';

import TimePicker from "@/components/ui/TimePicker";
// Helpers
const getFacilityIcon = (type: string) => {
    switch (type) {
        case 'GYM': return Dumbbell;
        case 'POOL': return Waves;
        case 'SPA': return Coffee;
        case 'RESTAURANT': return Utensils;
        case 'LOUNGE': return Coffee;
        case 'CONFERENCE': return Wifi;
        default: return Building2;
    }
};

const getStatusStyle = (status: string) => {
    switch (status) {
        case 'OPEN':
        case 'AVAILABLE': return { bg: 'var(--notion-green-bg)', text: 'var(--notion-green)', icon: CheckCircle2 };
        case 'CLOSED':
        case 'RESERVED': return { bg: 'var(--notion-yellow-bg)', text: 'var(--notion-yellow)', icon: Clock };
        case 'MAINTENANCE': return { bg: 'var(--notion-red-bg)', text: 'var(--notion-red)', icon: Wrench };
        case 'OCCUPIED': return { bg: 'var(--notion-blue-bg)', text: 'var(--notion-blue)', icon: Car };
        default: return { bg: 'var(--notion-gray-bg)', text: 'var(--notion-text-secondary)', icon: CheckCircle2 };
    }
};

// Tab Navigation
function TabNav({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
    const tabs = [
        { id: 'facilities', label: 'Facilities', icon: Building2 },
        { id: 'parking', label: 'Parking', icon: Car }
    ];

    return (
        <div style={{
            display: 'flex',
            gap: '4px',
            backgroundColor: 'var(--notion-bg-secondary)',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-4)'
        }}>
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        fontSize: '14px',
                        fontWeight: activeTab === tab.id ? '600' : '400',
                        color: activeTab === tab.id ? 'var(--notion-text)' : 'var(--notion-text-secondary)',
                        backgroundColor: activeTab === tab.id ? 'var(--notion-bg)' : 'transparent',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                    }}
                >
                    <tab.icon size={16} />
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

// Loading Skeleton
function LoadingCard() {
    return (
        <div style={{
            backgroundColor: 'var(--notion-bg)',
            border: '1px solid var(--notion-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            animation: 'pulse 2s infinite'
        }}>
            <div style={{ height: '44px', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: '8px', marginBottom: '12px', width: '70%' }} />
            <div style={{ height: '14px', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: '4px', marginBottom: '8px', width: '100%' }} />
            <div style={{ height: '14px', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: '4px', width: '60%' }} />
        </div>
    );
}

// Facility Card
function FacilityCard({ facility, onEdit, onDelete, onToggleStatus }: {
    facility: Facility;
    onEdit: () => void;
    onDelete: () => void;
    onToggleStatus: () => void;
}) {
    const Icon = getFacilityIcon(facility.type);
    const statusStyle = getStatusStyle(facility.status);
    const StatusIcon = statusStyle.icon;

    return (
        <div style={{
            backgroundColor: 'var(--notion-bg)',
            border: '1px solid var(--notion-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                    <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--notion-blue-bg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Icon size={22} color="var(--notion-blue)" />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--notion-text)' }}>
                            {facility.name}
                        </h3>
                        <span style={{
                            fontSize: '12px',
                            color: 'var(--notion-text-secondary)',
                            textTransform: 'uppercase'
                        }}>
                            {facility.type}
                        </span>
                    </div>
                </div>
                <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: '600',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: statusStyle.bg,
                    color: statusStyle.text,
                    cursor: 'pointer'
                }} onClick={onToggleStatus}>
                    <StatusIcon size={12} />
                    {facility.status}
                </span>
            </div>

            {/* Details */}
            {facility.description && (
                <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                    {facility.description}
                </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                {facility.location && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={12} /> {facility.location}
                    </span>
                )}
                {facility.openTime && facility.closeTime && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} /> {facility.openTime} - {facility.closeTime}
                    </span>
                )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'auto' }}>
                <Button variant="ghost" size="sm" onClick={onEdit} icon={<Edit size={14} />}>Edit</Button>
                <Button variant="ghost" size="sm" onClick={onDelete} icon={<Trash2 size={14} />} style={{ color: 'var(--notion-red)' }}>Delete</Button>
            </div>
        </div>
    );
}

// Parking Space Card
function ParkingCard({ space, onAssign, onRelease }: {
    space: ParkingSpace;
    onAssign: () => void;
    onRelease: () => void;
}) {
    const statusStyle = getStatusStyle(space.status);

    return (
        <div style={{
            backgroundColor: 'var(--notion-bg)',
            border: '1px solid var(--notion-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: statusStyle.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Car size={20} color={statusStyle.text} />
                </div>
                <div>
                    <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--notion-text)' }}>
                        {space.spaceNumber}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>
                        {space.vehicleType} • {space.status}
                    </div>
                </div>
            </div>

            {space.assignedRoom && (
                <div style={{ textAlign: 'right', marginRight: 'var(--space-4)' }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--notion-text)' }}>
                        Room {space.assignedRoom.number}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)' }}>
                        {space.assignedRoom.name}
                    </div>
                </div>
            )}

            {space.status === 'AVAILABLE' ? (
                <Button variant="primary" size="sm" onClick={onAssign}>Assign</Button>
            ) : space.status === 'OCCUPIED' ? (
                <Button variant="secondary" size="sm" onClick={onRelease}>Release</Button>
            ) : null}
        </div>
    );
}

export default function FacilitiesPage() {
    const { facilities, parking, isLoading, error, refresh, createFacility, updateFacility, createParkingSpace, assignParking, deleteFacility } = useFacilities();
    const [activeTab, setActiveTab] = useState('facilities');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal State
    const [isFacilityModalOpen, setIsFacilityModalOpen] = useState(false);
    const [isParkingModalOpen, setIsParkingModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [editingId, setEditingId] = useState<number | null>(null);

    // Forms
    const [facilityForm, setFacilityForm] = useState<CreateFacilityPayload>({
        name: '',
        type: 'OTHER',
        location: '',
        description: '',
        status: 'OPEN',
        openTime: '06:00',
        closeTime: '22:00'
    });

    const [parkingForm, setParkingForm] = useState<CreateParkingPayload>({
        spaceNumber: '',
        vehicleType: 'CAR'
    });

    const [assignRoomId, setAssignRoomId] = useState<string>('');

    const resetForms = () => {
        setFacilityForm({
            name: '',
            type: 'OTHER',
            location: '',
            description: '',
            status: 'OPEN',
            openTime: '06:00',
            closeTime: '22:00'
        });
        setParkingForm({
            spaceNumber: '',
            vehicleType: 'CAR'
        });
        setAssignRoomId('');
        setEditingId(null);
    };

    const handleOpenCreateFacility = () => {
        setModalMode('create');
        resetForms();
        setIsFacilityModalOpen(true);
    };

    const handleOpenEditFacility = (facility: Facility) => {
        setModalMode('edit');
        setEditingId(facility.id);
        setFacilityForm({
            name: facility.name,
            type: facility.type,
            location: facility.location || '',
            description: facility.description || '',
            status: facility.status,
            openTime: facility.openTime,
            closeTime: facility.closeTime
        });
        setIsFacilityModalOpen(true);
    };

    const handleOpenCreateParking = () => {
        resetForms();
        setIsParkingModalOpen(true);
    };

    const handleOpenAssign = (space: ParkingSpace) => {
        setEditingId(space.id);
        setAssignRoomId(space.assignedToRoomId ? String(space.assignedToRoomId) : '');
        setIsAssignModalOpen(true);
    };

    const handleSubmitFacility = async (e: React.FormEvent) => {
        e.preventDefault();
        let success = false;
        if (modalMode === 'create') {
            success = await createFacility(facilityForm);
        } else if (editingId) {
            success = await updateFacility(editingId, facilityForm);
        }
        if (success) {
            setIsFacilityModalOpen(false);
            resetForms();
        }
    };

    const handleSubmitParking = async (e: React.FormEvent) => {
        e.preventDefault();
        const success = await createParkingSpace(parkingForm);
        if (success) {
            setIsParkingModalOpen(false);
            resetForms();
        }
    };

    const handleAssignSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editingId) {
            const roomId = assignRoomId ? parseInt(assignRoomId) : null;
            const success = await assignParking(editingId, roomId);
            if (success) {
                setIsAssignModalOpen(false);
                setEditingId(null);
                setAssignRoomId('');
            }
        }
    };

    // Stats
    const facilityStats = useMemo(() => ({
        total: facilities.length,
        open: facilities.filter(f => f.status === 'OPEN').length,
        maintenance: facilities.filter(f => f.status === 'MAINTENANCE').length
    }), [facilities]);

    const parkingStats = useMemo(() => ({
        total: parking.length,
        available: parking.filter(p => p.status === 'AVAILABLE').length,
        occupied: parking.filter(p => p.status === 'OCCUPIED').length
    }), [parking]);

    const filteredFacilities = useMemo(() =>
        facilities.filter(f => (f.name || '').toLowerCase().includes(searchQuery.toLowerCase())),
        [facilities, searchQuery]
    );

    const filteredParking = useMemo(() =>
        parking.filter(p => (p.spaceNumber || '').toLowerCase().includes(searchQuery.toLowerCase())),
        [parking, searchQuery]
    );

    const handleToggleFacilityStatus = async (id: number, currentStatus: string) => {
        const nextStatus = currentStatus === 'OPEN' ? 'CLOSED' : currentStatus === 'CLOSED' ? 'MAINTENANCE' : 'OPEN';
        await updateFacility(id, { status: nextStatus as 'OPEN' | 'CLOSED' | 'MAINTENANCE' });
    };

    const handleReleaseParking = async (id: number) => {
        await assignParking(id, null);
    };

    const handleDeleteFacility = async (id: number) => {
        if (confirm('Are you sure you want to delete this facility?')) {
            await deleteFacility(id);
        }
    };

    return (
        <DashboardLayout>
            <PageContainer>
                <div style={{ padding: 'var(--space-6)' }}>
                    {/* Header */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 'var(--space-6)',
                        flexWrap: 'wrap',
                        gap: 'var(--space-3)'
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
                                <Building2 size={24} />
                                Facilities Management
                            </h1>
                            <p style={{ color: 'var(--notion-text-secondary)', fontSize: '14px' }}>
                                Manage hotel facilities and parking spaces
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            <Button variant="secondary" onClick={refresh} icon={isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}>
                                Refresh
                            </Button>
                            <Button variant="primary" icon={<Plus size={16} />} onClick={activeTab === 'facilities' ? handleOpenCreateFacility : handleOpenCreateParking}>
                                Add {activeTab === 'facilities' ? 'Facility' : 'Parking Spot'}
                            </Button>
                        </div>
                    </div>

                    {/* Error State */}
                    {error && (
                        <div style={{
                            padding: 'var(--space-4)',
                            backgroundColor: 'var(--notion-red-bg)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--notion-red)',
                            marginBottom: 'var(--space-4)'
                        }}>
                            {error}
                        </div>
                    )}

                    {/* Tabs */}
                    <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

                    {/* Stats - Responsive */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                        gap: 'var(--space-4)',
                        marginBottom: 'var(--space-6)'
                    }}>
                        {activeTab === 'facilities' ? (
                            <>
                                <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)' }}>
                                    <div style={{ fontSize: '24px', fontWeight: '700' }}>{facilityStats.total}</div>
                                    <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Total Facilities</div>
                                </div>
                                <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--notion-green-bg)', borderRadius: 'var(--radius-md)' }}>
                                    <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--notion-green)' }}>{facilityStats.open}</div>
                                    <div style={{ fontSize: '13px', color: 'var(--notion-green)' }}>Open</div>
                                </div>
                                <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--notion-red-bg)', borderRadius: 'var(--radius-md)' }}>
                                    <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--notion-red)' }}>{facilityStats.maintenance}</div>
                                    <div style={{ fontSize: '13px', color: 'var(--notion-red)' }}>Maintenance</div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)' }}>
                                    <div style={{ fontSize: '24px', fontWeight: '700' }}>{parkingStats.total}</div>
                                    <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Total Spots</div>
                                </div>
                                <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--notion-green-bg)', borderRadius: 'var(--radius-md)' }}>
                                    <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--notion-green)' }}>{parkingStats.available}</div>
                                    <div style={{ fontSize: '13px', color: 'var(--notion-green)' }}>Available</div>
                                </div>
                                <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--notion-blue-bg)', borderRadius: 'var(--radius-md)' }}>
                                    <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--notion-blue)' }}>{parkingStats.occupied}</div>
                                    <div style={{ fontSize: '13px', color: 'var(--notion-blue)' }}>Occupied</div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Search */}
                    <div style={{ position: 'relative', maxWidth: '300px', marginBottom: 'var(--space-4)' }}>
                        <Search size={16} style={{
                            position: 'absolute',
                            left: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--notion-text-secondary)'
                        }} />
                        <input
                            type="text"
                            placeholder={`Search ${activeTab}...`}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px 12px 8px 36px',
                                fontSize: '14px',
                                border: '1px solid var(--notion-border)',
                                borderRadius: 'var(--radius-md)',
                                backgroundColor: 'var(--notion-bg)',
                                color: 'var(--notion-text)',
                                outline: 'none'
                            }}
                        />
                    </div>

                    {/* Content */}
                    {activeTab === 'facilities' ? (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                            gap: 'var(--space-4)'
                        }}>
                            {isLoading ? (
                                <>
                                    <LoadingCard />
                                    <LoadingCard />
                                    <LoadingCard />
                                </>
                            ) : filteredFacilities.length === 0 ? (
                                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-8)', color: 'var(--notion-text-secondary)' }}>
                                    No facilities found
                                </div>
                            ) : (
                                filteredFacilities.map(facility => (
                                    <FacilityCard
                                        key={facility.id}
                                        facility={facility}
                                        onEdit={() => handleOpenEditFacility(facility)}
                                        onDelete={() => handleDeleteFacility(facility.id)}
                                        onToggleStatus={() => handleToggleFacilityStatus(facility.id, facility.status)}
                                    />
                                ))
                            )}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            {isLoading ? (
                                <>
                                    <LoadingCard />
                                    <LoadingCard />
                                </>
                            ) : filteredParking.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--notion-text-secondary)' }}>
                                    No parking spaces found
                                </div>
                            ) : (
                                filteredParking.map(space => (
                                    <ParkingCard
                                        key={space.id}
                                        space={space}
                                        onAssign={() => handleOpenAssign(space)}
                                        onRelease={() => handleReleaseParking(space.id)}
                                    />
                                ))
                            )}
                        </div>
                    )}
                </div>
            </PageContainer>

            {/* Facility Modal */}
            <Modal
                isOpen={isFacilityModalOpen}
                onClose={() => setIsFacilityModalOpen(false)}
                title={`${modalMode === 'create' ? 'Add' : 'Edit'} Facility`}
            >
                <form onSubmit={handleSubmitFacility} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <Input
                        label="Facility Name"
                        value={facilityForm.name}
                        onChange={e => setFacilityForm({ ...facilityForm, name: e.target.value })}
                        required
                        placeholder="e.g. Main Gym"
                    />
                    <Select
                        label="Type"
                        value={facilityForm.type}
                        onChange={e => setFacilityForm({ ...facilityForm, type: e.target.value as any })}
                    >
                        <option value="GYM">Gym</option>
                        <option value="POOL">Pool</option>
                        <option value="SPA">Spa</option>
                        <option value="RESTAURANT">Restaurant</option>
                        <option value="LOUNGE">Lounge</option>
                        <option value="CONFERENCE">Conference Room</option>
                        <option value="OTHER">Other</option>
                    </Select>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                        <TimePicker label="Open Time"
                            value={facilityForm.openTime} onChange={(v) => setFacilityForm({ ...facilityForm, openTime: v })} />
                        <TimePicker label="Close Time"
                            value={facilityForm.closeTime} onChange={(v) => setFacilityForm({ ...facilityForm, closeTime: v })} />
                    </div>
                    <Select
                        label="Status"
                        value={facilityForm.status}
                        onChange={e => setFacilityForm({ ...facilityForm, status: e.target.value as any })}
                    >
                        <option value="OPEN">Open</option>
                        <option value="CLOSED">Closed</option>
                        <option value="MAINTENANCE">Maintenance</option>
                    </Select>
                    <Input
                        label="Location"
                        value={facilityForm.location || ''}
                        onChange={e => setFacilityForm({ ...facilityForm, location: e.target.value })}
                        placeholder="e.g. Level 1"
                    />
                    <Input
                        label="Description"
                        value={facilityForm.description || ''}
                        onChange={e => setFacilityForm({ ...facilityForm, description: e.target.value })}
                        placeholder="Optional description"
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                        <Button type="button" variant="ghost" onClick={() => setIsFacilityModalOpen(false)}>Cancel</Button>
                        <Button type="submit" variant="primary">{modalMode === 'create' ? 'Create' : 'Save Changes'}</Button>
                    </div>
                </form>
            </Modal>

            {/* Parking Modal */}
            <Modal
                isOpen={isParkingModalOpen}
                onClose={() => setIsParkingModalOpen(false)}
                title="Add Parking Spot"
                size="sm"
            >
                <form onSubmit={handleSubmitParking} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <Input
                        label="Space Number"
                        value={parkingForm.spaceNumber}
                        onChange={e => setParkingForm({ ...parkingForm, spaceNumber: e.target.value })}
                        required
                        placeholder="e.g. P-101"
                    />
                    <Select
                        label="Vehicle Type"
                        value={parkingForm.vehicleType}
                        onChange={e => setParkingForm({ ...parkingForm, vehicleType: e.target.value as any })}
                    >
                        <option value="CAR">Car</option>
                        <option value="BIKE">Bike</option>
                        <option value="TRUCK">Truck</option>
                    </Select>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                        <Button type="button" variant="ghost" onClick={() => setIsParkingModalOpen(false)}>Cancel</Button>
                        <Button type="submit" variant="primary">Add Spot</Button>
                    </div>
                </form>
            </Modal>

            {/* Assign Parking Modal */}
            <Modal
                isOpen={isAssignModalOpen}
                onClose={() => setIsAssignModalOpen(false)}
                title="Assign Parking"
                size="sm"
            >
                <form onSubmit={handleAssignSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', margin: 0 }}>
                        Enter the Room ID to assign this parking spot to. Leave empty to keep unassigned.
                    </p>
                    <Input
                        label="Room ID"
                        type="number"
                        value={assignRoomId}
                        onChange={e => setAssignRoomId(e.target.value)}
                        placeholder="e.g. 101"
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                        <Button type="button" variant="ghost" onClick={() => setIsAssignModalOpen(false)}>Cancel</Button>
                        <Button type="submit" variant="primary">Assign</Button>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
