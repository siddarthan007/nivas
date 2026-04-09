'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useBookings } from '@/lib/hooks/useBookings';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import CustomDatePicker from '@/components/ui/DatePicker';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import { useRooms } from '@/lib/hooks/useRooms';
import { useCorporate } from '@/lib/hooks/useCorporate';
import { Skeleton } from '@/components/ui/Skeleton';
import {
    CalendarDays,
    Plus,
    Search,
    RefreshCw,
    User,
    Phone,
    Mail,
    CreditCard,
    CheckCircle2,
    Calendar,
    LogOut,
    LogIn,
    UserCircle,
    Clock,
    Check,
    Copy,
    Pencil,
    XCircle,
    ArrowRightLeft,
    CalendarPlus,
    MoreHorizontal
} from 'lucide-react';
import Pagination from '@/components/ui/Pagination';
import { GuestSearchInput } from '@/components/features/guests/GuestSearchInput';
import type { GuestSearchResult } from '@/lib/services/guest.service';
import NationalitySelect from '@/components/features/guests/NationalitySelect';
import type { CreateBookingPayload, BookingSource, Booking, BookingStatus } from '@/lib/types/api.types';
import { format } from 'date-fns';

const BOOKING_SOURCES: BookingSource[] = ['WALK_IN', 'PHONE', 'WEBSITE', 'OTA', 'TRAVEL_AGENT', 'CORPORATE'];

// Status Badge Component
function BookingStatusBadge({ status }: { status: string }) {
    const colors: Record<string, { bg: string; text: string }> = {
        CONFIRMED: { bg: 'var(--notion-blue-bg)', text: 'var(--notion-blue)' },
        CHECKED_IN: { bg: 'var(--notion-green-bg)', text: 'var(--notion-green)' },
        CHECKED_OUT: { bg: 'var(--notion-gray-bg)', text: 'var(--notion-text-secondary)' },
        CANCELLED: { bg: 'var(--notion-red-bg)', text: 'var(--notion-red)' },
        NO_SHOW: { bg: 'var(--notion-yellow-bg)', text: 'var(--notion-orange)' }
    };

    const color = colors[status] || { bg: 'var(--notion-gray-bg)', text: 'var(--notion-text)' };

    return (
        <span style={{
            backgroundColor: color.bg,
            color: color.text,
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '500',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
        }}>
            {status === 'CHECKED_IN' && <CheckCircle2 size={12} />}
            {status.replace('_', ' ')}
        </span>
    );
}

// Check-In Success Modal
function CheckInSuccessModal({
    isOpen,
    onClose,
    guestPin,
}: {
    isOpen: boolean;
    onClose: () => void;
    guestPin: string;
}) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(guestPin);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Check-In Successful">
            <div style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
                <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--notion-green-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto var(--space-4)',
                }}>
                    <Check size={32} style={{ color: 'var(--notion-green)' }} />
                </div>

                <p style={{
                    fontSize: '14px',
                    color: 'var(--notion-text-secondary)',
                    marginBottom: 'var(--space-4)',
                }}>
                    Guest has been checked in successfully. Share this PIN for room service orders:
                </p>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--notion-bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--space-4)',
                }}>
                    <span style={{
                        fontSize: '28px',
                        fontWeight: '700',
                        letterSpacing: '4px',
                        color: 'var(--notion-text)',
                    }}>
                        {guestPin}
                    </span>
                    <button
                        onClick={handleCopy}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: copied ? 'var(--notion-green)' : 'var(--notion-text-secondary)',
                        }}
                    >
                        {copied ? <Check size={20} /> : <Copy size={20} />}
                    </button>
                </div>

                <Button onClick={onClose} style={{ width: '100%' }}>
                    Done
                </Button>
            </div>
        </Modal>
    );
}

// Booking Create Modal
function CreateBookingModal({
    isOpen,
    onClose,
    onCreate
}: {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (data: CreateBookingPayload) => Promise<void>;
}) {
    const { rooms } = useRooms();
    const { companies, agents } = useCorporate();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1);
    const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
    const [isExistingGuest, setIsExistingGuest] = useState(false);
    const [formData, setFormData] = useState<Partial<CreateBookingPayload>>({
        roomId: undefined,
        guestName: '',
        guestPhone: '',
        guestEmail: '',
        guestCount: 1,
        checkIn: new Date().toISOString().split('T')[0],
        checkOut: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        totalAmount: 0,
        advancePayment: 0,
        source: 'WALK_IN',
        nationality: '',
        corporateAccountId: undefined,
        travelAgentId: undefined,
    });

    // Reset step on open
    useEffect(() => {
        if (isOpen) setStep(1);
    }, [isOpen]);

    // Auto-calculate amount
    useEffect(() => {
        if (formData.roomId && formData.checkIn && formData.checkOut) {
            const room = rooms.find(r => r.id === Number(formData.roomId));
            if (room) {
                const start = new Date(formData.checkIn);
                const end = new Date(formData.checkOut);
                const nights = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                setFormData(prev => ({ ...prev, totalAmount: room.rate * nights }));
            }
        }
    }, [formData.roomId, formData.checkIn, formData.checkOut, rooms]);

    const handleGuestSelect = (guest: GuestSearchResult) => {
        setSelectedGuestId(guest.id);
        setIsExistingGuest(true);
        setFormData(prev => ({
            ...prev,
            guestName: guest.fullName,
            guestPhone: guest.phone || '',
            guestEmail: guest.email || '',
            nationality: guest.nationality || '',
            guestId: guest.id
        }));
    };

    const handleAddNewGuest = (name: string) => {
        setSelectedGuestId(null);
        setIsExistingGuest(false);
        setFormData(prev => ({
            ...prev,
            guestName: name,
            guestPhone: '',
            guestEmail: '',
            nationality: '',
            guestId: undefined
        }));
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            await onCreate(formData as CreateBookingPayload);
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const availableRooms = rooms.filter(r => r.status === 'VACANT' || r.status === 'AVAILABLE');
    const selectedRoom = rooms.find(r => r.id === Number(formData.roomId));
    const nights = formData.checkIn && formData.checkOut
        ? Math.max(1, Math.ceil((new Date(formData.checkOut).getTime() - new Date(formData.checkIn).getTime()) / 86400000))
        : 0;

    const canProceedStep1 = formData.roomId && formData.checkIn && formData.checkOut;
    const canProceedStep2 = formData.guestName && formData.guestPhone;

    const stepLabelStyle: React.CSSProperties = { fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', whiteSpace: 'nowrap' };
    const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', color: 'var(--notion-text-secondary)', marginBottom: '4px' };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="New Booking">
            {/* Step Indicator */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', marginBottom: 'var(--space-5)', position: 'relative' }}>
                {/* Connecting lines layer */}
                <div style={{ position: 'absolute', top: '14px', left: '16.66%', right: '16.66%', display: 'flex' }}>
                    <div style={{
                        flex: 1, height: '2px',
                        backgroundColor: step > 1 ? 'var(--notion-blue)' : 'var(--notion-border)',
                        transition: 'background-color 200ms ease',
                    }} />
                    <div style={{
                        flex: 1, height: '2px',
                        backgroundColor: step > 2 ? 'var(--notion-blue)' : 'var(--notion-border)',
                        transition: 'background-color 200ms ease',
                    }} />
                </div>
                {/* Steps */}
                {[
                    { num: 1, label: 'Room &\nDates' },
                    { num: 2, label: 'Guest Info' },
                    { num: 3, label: 'Payment' },
                ].map((s) => (
                    <div key={s.num} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                        <div style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '12px', fontWeight: '600',
                            backgroundColor: step >= s.num ? 'var(--notion-blue)' : 'var(--notion-bg-secondary)',
                            color: step >= s.num ? 'white' : 'var(--notion-text-secondary)',
                            border: step >= s.num ? 'none' : '1px solid var(--notion-border)',
                            transition: 'all 200ms ease',
                        }}>
                            {step > s.num ? <Check size={14} /> : s.num}
                        </div>
                        <span style={{
                            ...stepLabelStyle,
                            marginTop: '6px',
                            color: step >= s.num ? 'var(--notion-blue)' : 'var(--notion-text-secondary)',
                            lineHeight: '1.3',
                        }}>
                            {s.label}
                        </span>
                    </div>
                ))}
            </div>

            {/* Step 1: Room & Dates */}
            {step === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', animation: 'fadeIn 0.2s ease-out' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                        <CustomDatePicker
                            label="Check-in"
                            required
                            selected={formData.checkIn ? new Date(formData.checkIn) : null}
                            onChange={(date) => {
                                if (date) setFormData({ ...formData, checkIn: date.toISOString().split('T')[0] });
                            }}
                            minDate={new Date()}
                        />
                        <CustomDatePicker
                            label="Check-out"
                            required
                            selected={formData.checkOut ? new Date(formData.checkOut) : null}
                            onChange={(date) => {
                                if (date) setFormData({ ...formData, checkOut: date.toISOString().split('T')[0] });
                            }}
                            minDate={formData.checkIn ? new Date(formData.checkIn) : new Date()}
                        />
                    </div>

                    <div>
                        <label style={labelStyle}>Room *</label>
                        <Select
                            value={formData.roomId?.toString() || ''}
                            onChange={e => setFormData({ ...formData, roomId: Number(e.target.value) })}
                            options={[
                                { value: '', label: 'Select a room...' },
                                ...availableRooms.map(r => ({
                                    value: r.id.toString(),
                                    label: `${r.number} - ${r.type} (₹${r.rate}/night)`
                                }))
                            ]}
                        />
                    </div>

                    {/* Room Preview */}
                    {selectedRoom && (
                        <div style={{
                            padding: 'var(--space-3)',
                            backgroundColor: 'var(--notion-bg-secondary)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--notion-border)',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--notion-text)' }}>
                                        Room {selectedRoom.number} — {selectedRoom.type}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', marginTop: '2px' }}>
                                        {nights} night{nights !== 1 ? 's' : ''} × ₹{selectedRoom.rate?.toLocaleString()}
                                    </div>
                                </div>
                                <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--notion-blue)' }}>
                                    ₹{(formData.totalAmount || 0).toLocaleString()}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Step 2: Guest Info */}
            {step === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', animation: 'fadeIn 0.2s ease-out' }}>
                    <div>
                        <label style={labelStyle}>Guest *</label>
                        <GuestSearchInput
                            onSelect={handleGuestSelect}
                            onAddNew={handleAddNewGuest}
                            placeholder="Search existing guest or type to create new..."
                        />
                        {isExistingGuest && selectedGuestId && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                marginTop: '6px', fontSize: '12px', color: 'var(--notion-green)',
                                padding: '4px 8px', backgroundColor: 'var(--notion-green-bg)',
                                borderRadius: 'var(--radius-sm)', width: 'fit-content'
                            }}>
                                <CheckCircle2 size={12} />
                                Existing guest linked
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                        <div>
                            <label style={labelStyle}>Phone *</label>
                            <Input required placeholder="9876543210" value={formData.guestPhone}
                                onChange={e => setFormData({ ...formData, guestPhone: e.target.value })}
                                icon={<Phone size={14} />} disabled={isExistingGuest}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Email</label>
                            <Input type="email" placeholder="john@example.com" value={formData.guestEmail}
                                onChange={e => setFormData({ ...formData, guestEmail: e.target.value })}
                                icon={<Mail size={14} />} disabled={isExistingGuest}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                        <NationalitySelect label="Nationality" value={formData.nationality || ''} onChange={val => setFormData({ ...formData, nationality: val })} />
                        <div>
                            <label style={labelStyle}>Guests</label>
                            <Input type="number" min={1} value={formData.guestCount}
                                onChange={e => setFormData({ ...formData, guestCount: Number(e.target.value) })}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                        <div>
                            <label style={labelStyle}>ID Type</label>
                            <Select
                                value={formData.idType || ''}
                                onChange={e => setFormData({ ...formData, idType: e.target.value })}
                                fullWidth
                                options={[
                                    { value: '', label: 'Select ID type' },
                                    { value: 'CITIZENSHIP', label: 'Citizenship' },
                                    { value: 'PASSPORT', label: 'Passport' },
                                    { value: 'DRIVING_LICENSE', label: 'Driving License' },
                                    { value: 'NATIONAL_ID', label: 'National ID' },
                                    { value: 'OTHER', label: 'Other' },
                                ]}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>ID Number</label>
                            <Input placeholder="Enter ID number" value={formData.idNumber || ''}
                                onChange={e => setFormData({ ...formData, idNumber: e.target.value })} disabled={isExistingGuest}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Step 3: Payment & Source */}
            {step === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', animation: 'fadeIn 0.2s ease-out' }}>
                    {/* Booking Summary */}
                    <div style={{
                        padding: 'var(--space-4)',
                        backgroundColor: 'var(--notion-bg-secondary)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--notion-border)',
                    }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--notion-text)', marginBottom: 'var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Booking Summary
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                            <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Room</div>
                            <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--notion-text)', textAlign: 'right' }}>
                                {selectedRoom ? `${selectedRoom.number} (${selectedRoom.type})` : '—'}
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Guest</div>
                            <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--notion-text)', textAlign: 'right' }}>
                                {formData.guestName || '—'}
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Duration</div>
                            <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--notion-text)', textAlign: 'right' }}>
                                {nights} night{nights !== 1 ? 's' : ''} ({formData.checkIn} → {formData.checkOut})
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                        <div>
                            <label style={labelStyle}>Total Amount (₹) *</label>
                            <Input type="number" required value={formData.totalAmount}
                                onChange={e => setFormData({ ...formData, totalAmount: Number(e.target.value) })}
                                icon={<CreditCard size={14} />}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Advance Payment (₹)</label>
                            <Input type="number" value={formData.advancePayment}
                                onChange={e => setFormData({ ...formData, advancePayment: Number(e.target.value) })}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={labelStyle}>Booking Source</label>
                        <Select
                            value={formData.source || 'WALK_IN'}
                            onChange={e => {
                                const source = e.target.value as BookingSource;
                                setFormData({
                                    ...formData,
                                    source,
                                    corporateAccountId: source !== 'CORPORATE' ? undefined : formData.corporateAccountId,
                                    travelAgentId: source !== 'TRAVEL_AGENT' ? undefined : formData.travelAgentId,
                                });
                            }}
                            options={BOOKING_SOURCES.map(s => ({ value: s, label: s.replace('_', ' ') }))}
                        />
                    </div>

                    {formData.source === 'CORPORATE' && (
                        <div>
                            <label style={labelStyle}>Corporate Account</label>
                            <Select
                                value={formData.corporateAccountId?.toString() || ''}
                                onChange={e => setFormData({ ...formData, corporateAccountId: e.target.value ? Number(e.target.value) : undefined })}
                                options={[
                                    { value: '', label: 'Select corporate account...' },
                                    ...companies.filter(c => c.status === 'ACTIVE').map(c => ({
                                        value: c.id.toString(),
                                        label: c.companyName,
                                    })),
                                ]}
                            />
                        </div>
                    )}

                    {formData.source === 'TRAVEL_AGENT' && (
                        <div>
                            <label style={labelStyle}>Travel Agent</label>
                            <Select
                                value={formData.travelAgentId?.toString() || ''}
                                onChange={e => setFormData({ ...formData, travelAgentId: e.target.value ? Number(e.target.value) : undefined })}
                                options={[
                                    { value: '', label: 'Select travel agent...' },
                                    ...agents.filter(a => a.status === 'ACTIVE').map(a => ({
                                        value: a.id.toString(),
                                        label: a.agencyName ? `${a.name} (${a.agencyName})` : a.name,
                                    })),
                                ]}
                            />
                        </div>
                    )}

                    {/* Balance indicator */}
                    {formData.totalAmount && formData.advancePayment !== undefined && (
                        <div style={{
                            padding: 'var(--space-3)',
                            backgroundColor: (formData.totalAmount - (formData.advancePayment || 0)) > 0 ? 'var(--notion-red-bg)' : 'var(--notion-green-bg)',
                            borderRadius: 'var(--radius-md)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                            <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--notion-text)' }}>
                                Balance Due
                            </span>
                            <span style={{ fontSize: '16px', fontWeight: '700', color: (formData.totalAmount - (formData.advancePayment || 0)) > 0 ? 'var(--notion-red)' : 'var(--notion-green)' }}>
                                ₹{((formData.totalAmount || 0) - (formData.advancePayment || 0)).toLocaleString()}
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Navigation Buttons */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'space-between', marginTop: 'var(--space-5)' }}>
                <Button variant="secondary" onClick={step === 1 ? onClose : () => setStep(step - 1)} disabled={loading} type="button">
                    {step === 1 ? 'Cancel' : '← Back'}
                </Button>
                {step < 3 ? (
                    <Button variant="primary" onClick={() => setStep(step + 1)}
                        disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
                    >
                        Next →
                    </Button>
                ) : (
                    <Button variant="primary" onClick={handleSubmit} disabled={loading}>
                        {loading ? 'Creating...' : 'Create Booking'}
                    </Button>
                )}
            </div>
        </Modal>
    );
}

function EditBookingModal({
    isOpen,
    onClose,
    booking,
    onSave,
}: {
    isOpen: boolean;
    onClose: () => void;
    booking: Booking | null;
    onSave: (id: string, data: any) => Promise<void>;
}) {
    const { rooms } = useRooms();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<any>({});


    useEffect(() => {
        if (booking) {
            setFormData({
                guestName: booking.guestName,
                guestPhone: booking.guestPhone,
                guestEmail: booking.guestEmail || '',
                guestCount: booking.guestCount,
                checkIn: new Date(booking.checkIn).toISOString().split('T')[0],
                checkOut: new Date(booking.checkOut).toISOString().split('T')[0],
                totalAmount: booking.totalAmount,
                advancePayment: booking.advancePayment || 0,
                source: booking.source || 'WALK_IN'
            });
        }
    }, [booking]);

    if (!booking) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSave(booking.id, formData);
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Booking">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <div>
                        <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Guest Name</label>
                        <Input required value={formData.guestName || ''} onChange={e => setFormData({ ...formData, guestName: e.target.value })} icon={<User size={14} />} />
                    </div>
                    <div>
                        <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Guest Phone</label>
                        <Input required value={formData.guestPhone || ''} onChange={e => setFormData({ ...formData, guestPhone: e.target.value })} icon={<Phone size={14} />} />
                    </div>
                </div>
                <div>
                    <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Email</label>
                    <Input value={formData.guestEmail || ''} onChange={e => setFormData({ ...formData, guestEmail: e.target.value })} icon={<Mail size={14} />} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <div>
                        <CustomDatePicker label="Check-in" selected={formData.checkIn ? new Date(formData.checkIn) : null} onChange={(date) => date && setFormData({ ...formData, checkIn: date.toISOString().split('T')[0] })} />
                    </div>
                    <div>
                        <CustomDatePicker label="Check-out" selected={formData.checkOut ? new Date(formData.checkOut) : null} onChange={(date) => date && setFormData({ ...formData, checkOut: date.toISOString().split('T')[0] })} />
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <div>
                        <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Total Amount (₹)</label>
                        <Input type="number" value={formData.totalAmount} onChange={e => setFormData({ ...formData, totalAmount: Number(e.target.value) })} />
                    </div>
                    <div>
                        <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Source</label>
                        <Select value={formData.source || 'WALK_IN'} onChange={e => setFormData({ ...formData, source: e.target.value })} options={BOOKING_SOURCES.map(s => ({ value: s, label: s.replace('_', ' ') }))} />
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                    <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
                    <Button variant="primary" type="submit" loading={loading}>Save Changes</Button>
                </div>
            </form>
        </Modal>
    );
}

function CancelBookingModal({
    isOpen,
    onClose,
    booking,
    onConfirm,
}: {
    isOpen: boolean;
    onClose: () => void;
    booking: Booking | null;
    onConfirm: (id: string, reason?: string) => Promise<void>;
}) {
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);

    if (!booking) return null;

    const handleConfirm = async () => {
        setLoading(true);
        try {
            await onConfirm(booking.id, reason);
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Cancel Booking">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <p style={{ color: 'var(--notion-text-secondary)', fontSize: '14px' }}>
                    Are you sure you want to cancel the booking for <strong style={{ color: 'var(--notion-text)' }}>{booking.guestName}</strong>?
                    {booking.status === 'CHECKED_IN' && ' The guest is currently checked in. This will also release the room.'}
                </p>
                <div>
                    <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Reason (optional)</label>
                    <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for cancellation..." />
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                    <Button variant="secondary" onClick={onClose}>Keep Booking</Button>
                    <Button variant="primary" onClick={handleConfirm} loading={loading} style={{ backgroundColor: 'var(--notion-red)' }}>Cancel Booking</Button>
                </div>
            </div>
        </Modal>
    );
}

function ChangeRoomModal({
    isOpen,
    onClose,
    booking,
    onConfirm,
}: {
    isOpen: boolean;
    onClose: () => void;
    booking: Booking | null;
    onConfirm: (bookingId: string, newRoomId: number) => Promise<void>;
}) {
    const { rooms } = useRooms();
    const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    if (!booking) return null;

    const availableRooms = rooms.filter(r => r.status === 'AVAILABLE' || r.status === 'VACANT');

    const handleConfirm = async () => {
        if (!selectedRoom) return;
        setLoading(true);
        try {
            await onConfirm(booking.id, selectedRoom);
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Change Room">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <p style={{ color: 'var(--notion-text-secondary)', fontSize: '14px' }}>
                    Current room: <strong style={{ color: 'var(--notion-text)' }}>Room {booking.room?.number}</strong>
                </p>
                <div>
                    <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">New Room</label>
                    <Select
                        value={selectedRoom?.toString() || ''}
                        onChange={e => setSelectedRoom(e.target.value ? Number(e.target.value) : null)}
                        options={[
                            { value: '', label: 'Select a room...' },
                            ...availableRooms.map(r => ({ value: r.id.toString(), label: `Room ${r.number} - ${r.type} (₹${r.rate})` })),
                        ]}
                    />
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" onClick={handleConfirm} loading={loading} disabled={!selectedRoom}>Change Room</Button>
                </div>
            </div>
        </Modal>
    );
}

export default function BookingsPage() {
    const { bookings, isLoading, pagination, fetchBookings, createBooking, checkIn, checkOut, updateBooking, cancelBooking, extendStay, changeRoom } = useBookings();
    const [currentPage, setCurrentPage] = useState(1);
    const [pageLimit, setPageLimit] = useState(20);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [checkInSuccess, setCheckInSuccess] = useState<{ show: boolean; pin: string }>({ show: false, pin: '' });
    const [editBooking, setEditBooking] = useState<Booking | null>(null);
    const [cancelBookingTarget, setCancelBookingTarget] = useState<Booking | null>(null);
    const [changeRoomTarget, setChangeRoomTarget] = useState<Booking | null>(null);
    const [actionMenuId, setActionMenuId] = useState<string | null>(null);

    useEffect(() => {
        fetchBookings({ page: currentPage, limit: pageLimit });
    }, [currentPage, pageLimit]);

    const filteredBookings = bookings.filter(b =>
        (b.guestName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.guestPhone || '').includes(searchQuery) ||
        (b.id || '').includes(searchQuery)
    );

    const handleCheckIn = async (bookingId: string) => {
        const result = await checkIn(bookingId);
        if (result.success && result.guestPin) {
            setCheckInSuccess({ show: true, pin: result.guestPin });
        }
    };

    return (
        <DashboardLayout>
            <div style={{ padding: 'var(--space-8)' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                    <div>
                        <h1 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: '24px', fontWeight: '600', color: 'var(--notion-text)' }}>
                            <CalendarDays size={28} />
                            Bookings
                        </h1>
                        <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', marginTop: '4px' }}>
                            Manage reservations, check-ins, and check-outs
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                        <Button variant="secondary" onClick={() => fetchBookings()} disabled={isLoading}>
                            <RefreshCw size={14} style={{ marginRight: '8px' }} /> Refresh
                        </Button>
                        <Button onClick={() => setIsCreateOpen(true)} variant="primary">
                            <Plus size={14} style={{ marginRight: '8px' }} /> New Booking
                        </Button>
                    </div>
                </div>

                {/* Filters */}
                <div style={{ marginBottom: 'var(--space-6)', maxWidth: '400px' }}>
                    <Input
                        placeholder="Search by guest name, phone, or booking ID..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        icon={<Search size={16} />}
                    />
                </div>

                {/* Bookings List */}
                <div style={{
                    backgroundColor: 'var(--notion-bg)',
                    border: '1px solid var(--notion-border)',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'visible'
                }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                            <thead style={{
                                backgroundColor: 'var(--notion-bg-secondary)',
                                borderBottom: '1px solid var(--notion-border)',
                                color: 'var(--notion-text-secondary)'
                            }}>
                                <tr>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500' }}>Guest</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500' }}>Room</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500' }}>Dates</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500' }}>Amount</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500' }}>Status</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody style={{ borderTop: '1px solid var(--notion-border)' }}>
                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={`skeleton-${i}`} style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                            <td style={{ padding: '12px 16px' }}>
                                                <Skeleton width="70%" height={14} style={{ marginBottom: '6px' }} />
                                                <Skeleton width="50%" height={12} />
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <Skeleton width="60%" height={14} style={{ marginBottom: '6px' }} />
                                                <Skeleton width="40%" height={12} />
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <Skeleton width="80%" height={14} />
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <Skeleton width="50%" height={14} />
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <Skeleton width={72} height={24} borderRadius="4px" />
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <Skeleton width={80} height={28} borderRadius="var(--radius-md)" />
                                            </td>
                                        </tr>
                                    ))
                                ) : filteredBookings.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>
                                            No bookings found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredBookings.map(booking => (
                                        <tr key={booking.id} style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ fontWeight: '500', color: 'var(--notion-text)' }}>{booking.guestName}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>{booking.guestPhone}</div>
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                {booking.room ? (
                                                    <span style={{ fontWeight: '500' }}>Room {booking.room.number}</span>
                                                ) : 'N/A'}
                                                <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>{booking.room?.type}</div>
                                            </td>
                                            <td style={{ padding: '12px 16px', color: 'var(--notion-text-secondary)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Calendar size={12} />
                                                    {format(new Date(booking.checkIn), 'MMM d')} - {format(new Date(booking.checkOut), 'MMM d')}
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 16px', fontWeight: '500' }}>
                                                ₹{(booking.totalAmount ?? 0).toLocaleString()}
                                                {booking.advancePayment !== undefined && booking.advancePayment > 0 && (
                                                    <span style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', display: 'block' }}>
                                                        Adv: ₹{booking.advancePayment}
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <BookingStatusBadge status={booking.status} />
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                    {booking.status === 'CONFIRMED' && (
                                                        <Button size="sm" variant="secondary" onClick={() => handleCheckIn(booking.id)} title="Check In">
                                                            <LogIn size={14} style={{ marginRight: '4px' }} /> Check In
                                                        </Button>
                                                    )}
                                                    {booking.status === 'CHECKED_IN' && (
                                                        <Button size="sm" variant="secondary" onClick={() => checkOut(booking.id)} title="Check Out">
                                                            <LogOut size={14} style={{ marginRight: '4px' }} /> Check Out
                                                        </Button>
                                                    )}
                                                    {(booking.status === 'CONFIRMED' || booking.status === 'CHECKED_IN') && (
                                                        <div style={{ position: 'relative' }}>
                                                            <Button size="sm" variant="secondary" onClick={() => setActionMenuId(actionMenuId === booking.id ? null : booking.id)} title="More Actions">
                                                                <MoreHorizontal size={14} />
                                                            </Button>
                                                            {actionMenuId === booking.id && (
                                                                <div style={{
                                                                    position: 'absolute', right: 0, top: '100%', zIndex: 9999,
                                                                    backgroundColor: 'var(--notion-bg)', border: '1px solid var(--notion-border)',
                                                                    borderRadius: 'var(--radius-md)', padding: '4px 0', minWidth: '160px',
                                                                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)', marginTop: '4px'
                                                                }}>
                                                                    <button onClick={() => { setEditBooking(booking); setActionMenuId(null); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', fontSize: '13px', color: 'var(--notion-text)', background: 'none', border: 'none', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--notion-bg-hover)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                                                        <Pencil size={14} /> Edit Booking
                                                                    </button>
                                                                    {booking.status === 'CHECKED_IN' && (
                                                                        <>
                                                                            <button onClick={() => { setChangeRoomTarget(booking); setActionMenuId(null); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', fontSize: '13px', color: 'var(--notion-text)', background: 'none', border: 'none', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--notion-bg-hover)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                                                                <ArrowRightLeft size={14} /> Change Room
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                    <div style={{ height: '1px', backgroundColor: 'var(--notion-border)', margin: '4px 0' }} />
                                                                    <button onClick={() => { setCancelBookingTarget(booking); setActionMenuId(null); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', fontSize: '13px', color: 'var(--notion-red)', background: 'none', border: 'none', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--notion-bg-hover)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                                                        <XCircle size={14} /> Cancel Booking
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {pagination.total > 0 && (
                    <Pagination
                        page={currentPage}
                        totalPages={pagination.totalPages}
                        total={pagination.total}
                        limit={pageLimit}
                        onPageChange={setCurrentPage}
                        onLimitChange={(l) => { setPageLimit(l); setCurrentPage(1); }}
                    />
                )}

                <CreateBookingModal
                    isOpen={isCreateOpen}
                    onClose={() => setIsCreateOpen(false)}
                    onCreate={createBooking}
                />

                <CheckInSuccessModal
                    isOpen={checkInSuccess.show}
                    onClose={() => setCheckInSuccess({ show: false, pin: '' })}
                    guestPin={checkInSuccess.pin}
                />

                <EditBookingModal
                    isOpen={!!editBooking}
                    onClose={() => setEditBooking(null)}
                    booking={editBooking}
                    onSave={updateBooking}
                />

                <CancelBookingModal
                    isOpen={!!cancelBookingTarget}
                    onClose={() => setCancelBookingTarget(null)}
                    booking={cancelBookingTarget}
                    onConfirm={cancelBooking}
                />

                <ChangeRoomModal
                    isOpen={!!changeRoomTarget}
                    onClose={() => setChangeRoomTarget(null)}
                    booking={changeRoomTarget}
                    onConfirm={changeRoom}
                />
            </div>
        </DashboardLayout>
    );
}
