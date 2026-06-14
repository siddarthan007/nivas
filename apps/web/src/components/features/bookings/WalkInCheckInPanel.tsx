'use client';

import { useEffect, useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import DateField from '@/components/ui/DateField';
import { GuestSearchInput } from '@/components/features/guests/GuestSearchInput';
import NationalitySelect from '@/components/features/guests/NationalitySelect';
import { useRooms } from '@/lib/hooks/useRooms';
import { useBookings } from '@/lib/hooks/useBookings';
import type { GuestSearchResult } from '@/lib/services/guest.service';
import { BedDouble, Loader2, User } from 'lucide-react';

interface WalkInCheckInPanelProps {
    prefill?: {
        guestId?: string;
        guestName?: string;
        guestPhone?: string;
        guestEmail?: string;
        nationality?: string;
        idType?: string;
        idNumber?: string;
    };
    onSuccess: (result: { guestPin: string; guestName: string; roomId: number }) => void;
}

export default function WalkInCheckInPanel({ prefill, onSuccess }: WalkInCheckInPanelProps) {
    const { rooms } = useRooms();
    const { bookings, walkInCheckIn } = useBookings();
    const [busy, setBusy] = useState(false);
    const [guestId, setGuestId] = useState<string | undefined>(prefill?.guestId);
    const [form, setForm] = useState({
        guestName: prefill?.guestName || '',
        guestPhone: prefill?.guestPhone || '',
        guestEmail: prefill?.guestEmail || '',
        nationality: prefill?.nationality || '',
        idType: prefill?.idType || '',
        idNumber: prefill?.idNumber || '',
        roomId: '',
        checkOut: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        guestCount: '1',
        advancePayment: '',
    });

    useEffect(() => {
        if (!prefill) return;
        setGuestId(prefill.guestId);
        setForm(prev => ({
            ...prev,
            guestName: prefill.guestName || prev.guestName,
            guestPhone: prefill.guestPhone || prev.guestPhone,
            guestEmail: prefill.guestEmail || prev.guestEmail,
            nationality: prefill.nationality || prev.nationality,
            idType: prefill.idType || prev.idType,
            idNumber: prefill.idNumber || prev.idNumber,
        }));
    }, [prefill]);

    const checkInToday = new Date().toISOString().split('T')[0];
    const checkOutDate = form.checkOut ? new Date(form.checkOut) : null;
    const checkInDate = new Date(checkInToday);

    const availableRooms = useMemo(() => rooms.filter(r => {
        if (r.status === 'MAINTENANCE') return false;
        if (!checkOutDate) return r.status !== 'OCCUPIED';
        const hasConflict = bookings.some(b =>
            b.roomId === r.id &&
            (b.status === 'CONFIRMED' || b.status === 'CHECKED_IN') &&
            checkInDate < new Date(b.checkOut) &&
            checkOutDate > new Date(b.checkIn)
        );
        return !hasConflict && r.status !== 'OCCUPIED';
    }), [rooms, bookings, checkOutDate, checkInDate]);

    const selectedRoom = rooms.find(r => r.id === Number(form.roomId));
    const nights = form.checkOut
        ? Math.max(1, Math.ceil((new Date(form.checkOut).getTime() - checkInDate.getTime()) / 86400000))
        : 1;
    const estimatedTotal = selectedRoom ? selectedRoom.rate * nights : 0;

    const handleGuestSelect = (guest: GuestSearchResult) => {
        setGuestId(guest.id);
        setForm(prev => ({
            ...prev,
            guestName: guest.fullName,
            guestPhone: guest.phone || '',
            guestEmail: guest.email || '',
            nationality: guest.nationality || prev.nationality,
            idType: guest.idType || prev.idType,
            idNumber: guest.idNumber || prev.idNumber,
        }));
    };

    const handleAddNewGuest = (name: string) => {
        setGuestId(undefined);
        setForm(prev => ({ ...prev, guestName: name }));
    };

    const handleSubmit = async () => {
        if (!form.guestName.trim() || !form.guestPhone.trim() || !form.roomId || !form.checkOut) return;
        setBusy(true);
        try {
            const result = await walkInCheckIn({
                roomId: Number(form.roomId),
                guestId,
                guestName: form.guestName.trim(),
                guestPhone: form.guestPhone.trim(),
                guestEmail: form.guestEmail || undefined,
                guestCount: Number(form.guestCount) || 1,
                checkOut: form.checkOut,
                totalAmount: estimatedTotal,
                advancePayment: form.advancePayment ? Number(form.advancePayment) : undefined,
                nationality: form.nationality || undefined,
                idType: form.idType || undefined,
                idNumber: form.idNumber || undefined,
            });
            if (result?.success) {
                onSuccess({
                    guestPin: result.guestPin,
                    guestName: form.guestName.trim(),
                    roomId: Number(form.roomId),
                });
            }
        } finally {
            setBusy(false);
        }
    };

    const labelStyle: React.CSSProperties = { fontSize: '12px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' };
    const canSubmit = form.guestName.trim() && form.guestPhone.trim().length >= 5 && form.roomId && form.checkOut;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', padding: 'var(--space-3)', background: 'var(--notion-bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                Register a walk-in guest, assign a room, and complete check-in in one step. A guest profile is created or linked automatically.
            </div>

            <div>
                <label style={labelStyle}>Guest</label>
                <GuestSearchInput
                    value={form.guestName}
                    onSelect={handleGuestSelect}
                    onAddNew={handleAddNewGuest}
                    placeholder="Search existing guest or type a new name..."
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div>
                    <label style={labelStyle}>Phone *</label>
                    <Input value={form.guestPhone} onChange={e => setForm(p => ({ ...p, guestPhone: e.target.value }))} placeholder="9851187548" />
                </div>
                <div>
                    <label style={labelStyle}>Email</label>
                    <Input value={form.guestEmail} onChange={e => setForm(p => ({ ...p, guestEmail: e.target.value }))} placeholder="guest@email.com" />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div>
                    <label style={labelStyle}>ID Type</label>
                    <select value={form.idType} onChange={e => setForm(p => ({ ...p, idType: e.target.value }))} style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)', background: 'var(--notion-bg)', color: 'var(--notion-text)' }}>
                        <option value="">Select</option>
                        <option value="Passport">Passport</option>
                        <option value="Citizenship">Citizenship</option>
                        <option value="National ID">National ID</option>
                    </select>
                </div>
                <div>
                    <label style={labelStyle}>ID Number</label>
                    <Input value={form.idNumber} onChange={e => setForm(p => ({ ...p, idNumber: e.target.value }))} placeholder="ID number" />
                </div>
            </div>

            <NationalitySelect label="Nationality" value={form.nationality} onChange={val => setForm(p => ({ ...p, nationality: val }))} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
                <div>
                    <label style={labelStyle}>Check-out *</label>
                    <DateField value={form.checkOut} min={checkInToday} onChange={v => setForm(p => ({ ...p, checkOut: v }))} />
                </div>
                <div>
                    <label style={labelStyle}>Guests</label>
                    <Input type="number" min={1} value={form.guestCount} onChange={e => setForm(p => ({ ...p, guestCount: e.target.value }))} />
                </div>
                <div>
                    <label style={labelStyle}>Advance (NPR)</label>
                    <Input type="number" value={form.advancePayment} onChange={e => setForm(p => ({ ...p, advancePayment: e.target.value }))} placeholder="0" />
                </div>
            </div>

            <div>
                <label style={labelStyle}>Available room *</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
                    {availableRooms.length === 0 ? (
                        <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>No rooms available for selected dates.</div>
                    ) : availableRooms.map(room => {
                        const active = form.roomId === String(room.id);
                        return (
                            <button
                                key={room.id}
                                type="button"
                                onClick={() => setForm(p => ({ ...p, roomId: String(room.id) }))}
                                style={{
                                    padding: '10px', textAlign: 'left', borderRadius: 'var(--radius-md)',
                                    border: active ? '2px solid var(--notion-blue)' : '1px solid var(--notion-border)',
                                    background: active ? 'var(--notion-blue-bg)' : 'var(--notion-bg-secondary)',
                                    cursor: 'pointer',
                                }}
                            >
                                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--notion-text)' }}>Room {room.number}</div>
                                <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)' }}>{room.type} · NPR {room.rate}/night</div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {selectedRoom && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                    <BedDouble size={14} />
                    {nights} night{nights > 1 ? 's' : ''} · estimated NPR {estimatedTotal.toLocaleString()}
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button onClick={handleSubmit} disabled={busy || !canSubmit}>
                    {busy ? <Loader2 size={14} className="animate-spin" style={{ marginRight: 6 }} /> : <User size={14} style={{ marginRight: 6 }} />}
                    {busy ? 'Checking in...' : 'Check In Walk-in Guest'}
                </Button>
            </div>
        </div>
    );
}
