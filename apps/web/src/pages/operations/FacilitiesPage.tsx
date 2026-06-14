'use client';

import { useCallback, useEffect, useState } from 'react';
import { Car, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import PageContainer from '@/components/layout/PageContainer';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import { api } from '@/lib/api';
import ENDPOINTS from '@/lib/api/endpoints';
import { usePermissions } from '@/lib/hooks/usePermissions';

type ParkingSpot = {
    id: number;
    spaceNumber: string;
    vehicleType: string;
    status: string;
    assignedToRoomId: number | null;
    assignedRoom?: { number?: number; name?: string } | null;
};

type AssignableBooking = {
    bookingId: string;
    roomId: number;
    roomNumber: number | null;
    guestName: string;
    checkOut: string;
};

export default function FacilitiesPage() {
    const { can } = usePermissions();
    const canManageParking = can('parking:manage');

    const [spots, setSpots] = useState<ParkingSpot[]>([]);
    const [bookings, setBookings] = useState<AssignableBooking[]>([]);
    const [loading, setLoading] = useState(true);
    const [newSpot, setNewSpot] = useState({ spaceNumber: '', vehicleType: 'CAR' });
    const [assignSpot, setAssignSpot] = useState<ParkingSpot | null>(null);
    const [selectedRoomId, setSelectedRoomId] = useState<string>('');

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [spotsRes, bookingsRes] = await Promise.all([
                api.get<ParkingSpot[]>(ENDPOINTS.OPERATIONS.PARKING),
                canManageParking
                    ? api.get<AssignableBooking[]>(ENDPOINTS.OPERATIONS.PARKING_ASSIGNABLE)
                    : Promise.resolve({ data: [] as AssignableBooking[] }),
            ]);
            setSpots(Array.isArray(spotsRes.data) ? spotsRes.data : []);
            setBookings(Array.isArray(bookingsRes.data) ? bookingsRes.data : []);
        } catch {
            toast.error('Failed to load parking data');
        } finally {
            setLoading(false);
        }
    }, [canManageParking]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleCreateSpot = async () => {
        if (!newSpot.spaceNumber.trim()) {
            toast.error('Enter a space number');
            return;
        }
        try {
            await api.post(ENDPOINTS.OPERATIONS.PARKING, newSpot);
            toast.success('Parking spot added');
            setNewSpot({ spaceNumber: '', vehicleType: 'CAR' });
            await loadData();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to add spot');
        }
    };

    const handleDeleteSpot = async (id: number) => {
        try {
            await api.delete(ENDPOINTS.OPERATIONS.PARKING_SPOT(id));
            toast.success('Spot removed');
            await loadData();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to delete spot');
        }
    };

    const handleAssign = async () => {
        if (!assignSpot) return;
        const roomId = selectedRoomId ? Number(selectedRoomId) : undefined;
        try {
            await api.patch(`${ENDPOINTS.OPERATIONS.PARKING}/${assignSpot.id}/assign`, {
                roomId: roomId ?? undefined,
            });
            toast.success(roomId ? 'Parking assigned' : 'Parking released');
            setAssignSpot(null);
            setSelectedRoomId('');
            await loadData();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Assignment failed');
        }
    };

    const bookingOptions = [
        { value: '', label: '— Unassigned —' },
        ...bookings.map(b => ({
            value: String(b.roomId),
            label: `Room ${b.roomNumber ?? b.roomId} · ${b.guestName}`,
        })),
    ];

    return (
        <PageContainer>
            <div style={{ padding: 'var(--space-6)', maxWidth: 960, margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                    <div>
                        <h1 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 24, fontWeight: 600 }}>
                            <Car size={26} /> Facilities & Parking
                        </h1>
                        <p style={{ color: 'var(--notion-text-secondary)', fontSize: 14, marginTop: 4 }}>
                            Assign spots to in-house guests. Spots auto-release on checkout.
                        </p>
                    </div>
                    <Button variant="secondary" onClick={loadData} disabled={loading} icon={<RefreshCw size={16} />}>
                        Refresh
                    </Button>
                </div>

                {canManageParking && (
                    <div style={{
                        display: 'flex',
                        gap: 12,
                        marginBottom: 24,
                        padding: 16,
                        border: '1px solid var(--notion-border)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--notion-bg)',
                    }}>
                        <Input
                            placeholder="Space # (e.g. P-12)"
                            value={newSpot.spaceNumber}
                            onChange={e => setNewSpot({ ...newSpot, spaceNumber: e.target.value })}
                        />
                        <Select
                            value={newSpot.vehicleType}
                            onChange={e => setNewSpot({ ...newSpot, vehicleType: e.target.value })}
                            options={[
                                { value: 'CAR', label: 'Car' },
                                { value: 'BIKE', label: 'Bike' },
                                { value: 'EV', label: 'EV' },
                            ]}
                        />
                        <Button onClick={handleCreateSpot} icon={<Plus size={16} />}>Add spot</Button>
                    </div>
                )}

                <div style={{ border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--notion-bg-secondary)' }}>
                                {['Space', 'Type', 'Status', 'Assigned to', 'Actions'].map(h => (
                                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600 }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center' }}>Loading…</td></tr>
                            ) : spots.length === 0 ? (
                                <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--notion-text-secondary)' }}>No parking spots yet</td></tr>
                            ) : spots.map(spot => (
                                <tr key={spot.id} style={{ borderTop: '1px solid var(--notion-border)' }}>
                                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{spot.spaceNumber}</td>
                                    <td style={{ padding: '12px 16px' }}>{spot.vehicleType}</td>
                                    <td style={{ padding: '12px 16px' }}>{spot.status}</td>
                                    <td style={{ padding: '12px 16px' }}>
                                        {spot.assignedRoom?.number ? `Room ${spot.assignedRoom.number}` : '—'}
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        {canManageParking && (
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <Button size="sm" variant="secondary" onClick={() => {
                                                    setAssignSpot(spot);
                                                    setSelectedRoomId(spot.assignedToRoomId ? String(spot.assignedToRoomId) : '');
                                                }}>
                                                    Assign
                                                </Button>
                                                <Button size="sm" variant="danger" onClick={() => handleDeleteSpot(spot.id)} icon={<Trash2 size={14} />} />
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {canManageParking && bookings.length === 0 && !loading && (
                    <p style={{ marginTop: 16, fontSize: 13, color: 'var(--notion-text-secondary)' }}>
                        No checked-in guests right now — check in a booking to assign parking.
                    </p>
                )}
            </div>

            <Modal
                isOpen={!!assignSpot}
                onClose={() => { setAssignSpot(null); setSelectedRoomId(''); }}
                title={`Assign ${assignSpot?.spaceNumber ?? 'spot'}`}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <Select
                        label="In-house booking (room)"
                        value={selectedRoomId}
                        onChange={e => setSelectedRoomId(e.target.value)}
                        options={bookingOptions}
                    />
                    <p style={{ fontSize: 12, color: 'var(--notion-text-secondary)' }}>
                        Only guests currently checked in appear here. Parking clears automatically when they check out.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button variant="secondary" onClick={() => setAssignSpot(null)}>Cancel</Button>
                        <Button onClick={handleAssign}>Save</Button>
                    </div>
                </div>
            </Modal>
        </PageContainer>
    );
}
