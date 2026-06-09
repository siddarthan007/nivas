import { useState, useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import DateField from '@/components/ui/DateField';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface RoomLite { id: number; number: number | string; type?: string; rate?: string | number; status?: string }

/**
 * Group / block booking — reserve several rooms in one reservation (shared
 * groupRef on the backend). For corporate blocks, weddings, tour groups.
 */
export default function GroupBookingModal({ isOpen, onClose, rooms, onCreated }: {
    isOpen: boolean;
    onClose: () => void;
    rooms: RoomLite[];
    onCreated: () => void;
}) {
    const [checkIn, setCheckIn] = useState('');
    const [checkOut, setCheckOut] = useState('');
    const [guestName, setGuestName] = useState('');
    const [guestPhone, setGuestPhone] = useState('');
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [busy, setBusy] = useState(false);

    const bookable = useMemo(
        () => rooms.filter(r => r.status === 'AVAILABLE' || r.status === 'VACANT'),
        [rooms]
    );

    const toggle = (id: number) => {
        setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    };

    const reset = () => { setCheckIn(''); setCheckOut(''); setGuestName(''); setGuestPhone(''); setSelected(new Set()); };

    const submit = async () => {
        if (!checkIn || !checkOut) { toast.error('Pick dates'); return; }
        if (!guestName.trim() || guestPhone.trim().length < 5) { toast.error('Guest name + phone required'); return; }
        if (selected.size === 0) { toast.error('Select at least one room'); return; }
        setBusy(true);
        try {
            await api.post('/bookings/group', {
                roomIds: [...selected],
                checkIn, checkOut,
                guestName: guestName.trim(),
                guestPhone: guestPhone.trim(),
                guestCount: selected.size * 2,
                source: 'CORPORATE',
            });
            toast.success(`Group booking created (${selected.size} rooms)`);
            reset(); onCreated(); onClose();
        } catch (e: any) {
            toast.error(e?.message || 'Failed — a room may be unavailable for these dates');
        } finally { setBusy(false); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Group / Block Booking" size="lg">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <DateField label="Check-in" value={checkIn} onChange={setCheckIn} required />
                    <DateField label="Check-out" value={checkOut} onChange={setCheckOut} required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <Input label="Guest / Company name" value={guestName} onChange={e => setGuestName(e.target.value)} required />
                    <Input label="Phone" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} required />
                </div>

                <div>
                    <label style={{ fontSize: 13, color: 'var(--notion-text-secondary)', display: 'block', marginBottom: 6 }}>
                        Rooms ({selected.size} selected)
                    </label>
                    {bookable.length === 0 ? (
                        <div style={{ fontSize: 13, color: 'var(--notion-text-muted)' }}>No available rooms.</div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                            {bookable.map(r => {
                                const on = selected.has(r.id);
                                return (
                                    <button key={r.id} type="button" onClick={() => toggle(r.id)}
                                        style={{ padding: '8px 10px', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left',
                                            border: `1px solid ${on ? 'var(--notion-blue)' : 'var(--notion-border)'}`,
                                            background: on ? 'var(--notion-blue-bg)' : 'var(--notion-bg)' }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: on ? 'var(--notion-blue)' : 'var(--notion-text)' }}>Room {r.number}</div>
                                        <div style={{ fontSize: 11, color: 'var(--notion-text-muted)' }}>{r.type || ''}{r.rate ? ` · Rs ${Number(r.rate).toLocaleString()}` : ''}</div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={submit} disabled={busy}>{busy ? 'Creating…' : `Book ${selected.size || ''} Rooms`}</Button>
                </div>
            </div>
        </Modal>
    );
}
