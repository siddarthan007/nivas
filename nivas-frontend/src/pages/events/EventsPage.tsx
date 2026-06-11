'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    useEvents,
    type Venue,
    type BanquetBooking,
    type CreateVenuePayload,
    type CreateBookingPayload,
    type BanquetBookingStatus,
} from '@/lib/hooks/useEvents';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { SkeletonCard } from '@/components/ui';
import CustomDatePicker from '@/components/ui/DatePicker';
import TimePicker from '@/components/ui/TimePicker';
import DateField from '@/components/ui/DateField';
import VenueGantt from '@/components/features/events/VenueGantt';
import {
    Calendar,
    MapPin,
    Users,
    Plus,
    RefreshCw,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    Trash2,
    Pencil,
    History,
    CalendarRange,
    Receipt,
    User,
    Search,
    ChevronLeft,
    ChevronRight,
    Check,
} from 'lucide-react';
import SecurityConfirmModal from '@/components/modals/SecurityConfirmModal';
import { useCRM } from '@/lib/hooks/useCRM';

const formatInputDate = (date: Date) => date.toISOString().slice(0, 10);
const formatCurrency = (amount?: number) => `NPR ${(amount || 0).toLocaleString()}`;

type TabId = 'bookings' | 'calendar' | 'venues' | 'history';

function TabNav({ activeTab, onTabChange }: { activeTab: TabId; onTabChange: (tab: TabId) => void }) {
    const tabs = [
        { id: 'bookings' as const, label: 'Bookings', icon: Calendar },
        { id: 'calendar' as const, label: 'Calendar', icon: CalendarRange },
        { id: 'venues' as const, label: 'Venues', icon: MapPin },
        { id: 'history' as const, label: 'History', icon: History },
    ];

    return (
        <div style={{ display: 'flex', gap: 'var(--space-1)', borderBottom: '1px solid var(--notion-divider)', marginBottom: 'var(--space-6)' }}>
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        padding: 'var(--space-3) var(--space-4)',
                        fontSize: '14px',
                        fontWeight: activeTab === tab.id ? '600' : '400',
                        color: activeTab === tab.id ? 'var(--notion-text)' : 'var(--notion-text-secondary)',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderBottom: activeTab === tab.id ? '2px solid var(--notion-blue)' : '2px solid transparent',
                        cursor: 'pointer',
                    }}
                >
                    <tab.icon size={16} />
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

function BookingCard({ booking, onUpdateStatus, onDelete }: {
    booking: BanquetBooking;
    onUpdateStatus: (status: BanquetBookingStatus) => void;
    onDelete: () => void;
}) {
    const statusConfig: Record<BanquetBookingStatus, { color: string; bg: string; icon: typeof AlertCircle; label: string }> = {
        PENDING: { color: 'var(--notion-orange)', bg: 'var(--notion-orange-bg)', icon: AlertCircle, label: 'Pending' },
        CONFIRMED: { color: 'var(--notion-blue)', bg: 'var(--notion-blue-bg)', icon: CheckCircle, label: 'Confirmed' },
        COMPLETED: { color: 'var(--notion-green)', bg: 'var(--notion-green-bg)', icon: CheckCircle, label: 'Completed' },
        CANCELLED: { color: 'var(--notion-red)', bg: 'var(--notion-red-bg)', icon: XCircle, label: 'Cancelled' },
    };

    const config = statusConfig[booking.status];
    const StatusIcon = config.icon;

    return (
        <div style={{ backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)', padding: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                <div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--notion-text)' }}>{booking.eventName}</div>
                    <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>{booking.eventType || 'Event'}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', fontSize: '12px', fontWeight: '500', backgroundColor: config.bg, color: config.color, borderRadius: 'var(--radius-sm)' }}>
                    <StatusIcon size={12} />
                    {config.label}
                </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={12} />
                    {new Date(booking.eventDate).toLocaleDateString()}
                    {booking.endDate && booking.endDate !== booking.eventDate && (
                        <span> - {new Date(booking.endDate).toLocaleDateString()}</span>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} />
                    {booking.startTime} - {booking.endTime}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Users size={12} />
                    {booking.expectedGuests} guests
                </div>
                {booking.venue && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={12} />
                        {booking.venue.name}
                    </div>
                )}
            </div>

            <div style={{ fontSize: '13px', marginBottom: 'var(--space-3)' }}>
                <div style={{ color: 'var(--notion-text)' }}>{booking.contactName}</div>
                <div style={{ color: 'var(--notion-text-secondary)' }}>{booking.contactPhone}</div>
                {booking.guest && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', color: 'var(--notion-blue)' }}>
                        <User size={12} />
                        <a href={`/guests?id=${booking.guest.id}`} style={{ color: 'var(--notion-blue)', textDecoration: 'none' }}>{booking.guest.fullName}</a>
                    </div>
                )}
                {booking.invoice && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', color: 'var(--notion-green)' }}>
                        <Receipt size={12} />
                        Invoice: {booking.invoice.invoiceNumber}
                    </div>
                )}
            </div>

            {booking.totalAmount !== undefined && (
                <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--notion-green)', marginBottom: 'var(--space-3)' }}>
                    {formatCurrency(booking.totalAmount)}
                </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {booking.status === 'PENDING' && (
                    <>
                        <Button size="sm" onClick={() => onUpdateStatus('CONFIRMED')}>Confirm</Button>
                        <Button size="sm" variant="secondary" onClick={() => onUpdateStatus('CANCELLED')}>Cancel</Button>
                    </>
                )}
                {booking.status === 'CONFIRMED' && (
                    <>
                        <Button size="sm" onClick={() => onUpdateStatus('COMPLETED')}>Mark Completed</Button>
                        <Button size="sm" variant="secondary" onClick={() => onUpdateStatus('CANCELLED')}>Cancel</Button>
                    </>
                )}
                <Button size="sm" variant="ghost" onClick={onDelete} style={{ color: 'var(--notion-red)' }}>
                    <Trash2 size={12} />
                </Button>
            </div>
        </div>
    );
}

function VenueCard({ venue, onToggle, onEdit, onDelete }: {
    venue: Venue;
    onToggle: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) {
    return (
        <div style={{ backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)', padding: 'var(--space-4)', opacity: venue.isActive ? 1 : 0.6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--notion-text)' }}>{venue.name}</div>
                <div style={{ padding: '4px 10px', fontSize: '12px', fontWeight: '500', backgroundColor: venue.isActive ? 'var(--notion-green-bg)' : 'var(--notion-bg-tertiary)', color: venue.isActive ? 'var(--notion-green)' : 'var(--notion-text-secondary)', borderRadius: 'var(--radius-sm)' }}>
                    {venue.isActive ? 'Active' : 'Inactive'}
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'var(--notion-blue)', marginBottom: 'var(--space-2)' }}>
                <Users size={14} />
                Capacity: {venue.capacity}
            </div>
            {(venue.baseRateHalf || venue.baseRateFull) && (
                <div style={{ fontSize: '13px', color: 'var(--notion-green)', marginBottom: 'var(--space-2)' }}>
                    {venue.baseRateHalf && <span>Half-day: {formatCurrency(Number(venue.baseRateHalf))} </span>}
                    {venue.baseRateFull && <span>Full-day: {formatCurrency(Number(venue.baseRateFull))}</span>}
                </div>
            )}

            {venue.description && <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)' }}>{venue.description}</div>}

            {venue.amenities && venue.amenities.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: 'var(--space-3)' }}>
                    {venue.amenities.map((amenity, index) => (
                        <span key={index} style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: 'var(--notion-bg-tertiary)', color: 'var(--notion-text-secondary)', borderRadius: '4px' }}>
                            {amenity}
                        </span>
                    ))}
                </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button size="sm" variant="secondary" onClick={onToggle}>{venue.isActive ? 'Deactivate' : 'Activate'}</Button>
                <Button size="sm" variant="ghost" onClick={onEdit}><Pencil size={12} /></Button>
                <Button size="sm" variant="ghost" onClick={onDelete} style={{ color: 'var(--notion-red)' }}><Trash2 size={12} /></Button>
            </div>
        </div>
    );
}

function CreateVenueModal({ isOpen, onClose, onSubmit }: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: CreateVenuePayload) => Promise<boolean>;
}) {
    const [formData, setFormData] = useState<CreateVenuePayload>({ name: '', capacity: 50 });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const success = await onSubmit(formData);
        setIsSubmitting(false);
        if (success) {
            setFormData({ name: '', capacity: 50 });
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Venue">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Venue Name *" required />
                <Input type="number" min={1} value={formData.capacity || ''} onChange={e => setFormData({ ...formData, capacity: e.target.value === '' ? 0 : parseInt(e.target.value, 10) })} placeholder="Capacity" />
                <Input value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Description" />
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <Input type="number" min={0} value={formData.baseRateHalf || ''} onChange={e => setFormData({ ...formData, baseRateHalf: parseFloat(e.target.value) || undefined })} placeholder="Half-day Rate (NPR)" style={{ flex: 1 }} />
                    <Input type="number" min={0} value={formData.baseRateFull || ''} onChange={e => setFormData({ ...formData, baseRateFull: parseFloat(e.target.value) || undefined })} placeholder="Full-day Rate (NPR)" style={{ flex: 1 }} />
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting || !formData.name.trim()} style={{ flex: 1 }}>{isSubmitting ? 'Creating...' : 'Create'}</Button>
                </div>
            </form>
        </Modal>
    );
}

function EditVenueModal({ isOpen, onClose, venue, onSubmit }: {
    isOpen: boolean;
    onClose: () => void;
    venue: Venue | null;
    onSubmit: (id: number, data: Partial<CreateVenuePayload>) => Promise<boolean>;
}) {
    const [formData, setFormData] = useState<Partial<CreateVenuePayload>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (venue) {
            setFormData({
                name: venue.name,
                capacity: venue.capacity,
                description: venue.description || '',
                amenities: venue.amenities || [],
                baseRateHalf: venue.baseRateHalf ? Number(venue.baseRateHalf) : undefined,
                baseRateFull: venue.baseRateFull ? Number(venue.baseRateFull) : undefined,
            });
        }
    }, [venue]);

    if (!venue) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const success = await onSubmit(venue.id, formData);
        setIsSubmitting(false);
        if (success) onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Venue">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <Input value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Venue Name *" required />
                <Input type="number" min={1} value={formData.capacity || ''} onChange={e => setFormData({ ...formData, capacity: e.target.value === '' ? undefined : parseInt(e.target.value, 10) })} placeholder="Capacity" />
                <Input value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Description" />
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <Input type="number" min={0} value={formData.baseRateHalf || ''} onChange={e => setFormData({ ...formData, baseRateHalf: parseFloat(e.target.value) || undefined })} placeholder="Half-day Rate (NPR)" style={{ flex: 1 }} />
                    <Input type="number" min={0} value={formData.baseRateFull || ''} onChange={e => setFormData({ ...formData, baseRateFull: parseFloat(e.target.value) || undefined })} placeholder="Full-day Rate (NPR)" style={{ flex: 1 }} />
                </div>
                <Input value={(formData.amenities || []).join(', ')} onChange={e => setFormData({ ...formData, amenities: e.target.value.split(',').map(value => value.trim()).filter(Boolean) })} placeholder="Amenities (comma separated)" />
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting || !(formData.name || '').trim()} style={{ flex: 1 }}>{isSubmitting ? 'Saving...' : 'Save Changes'}</Button>
                </div>
            </form>
        </Modal>
    );
}

function CreateBookingModal({ isOpen, onClose, onSubmit, venues }: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: CreateBookingPayload) => Promise<boolean>;
    venues: Venue[];
}) {
    const { searchGuests, guests: crmGuests } = useCRM();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState<CreateBookingPayload>({
        banquetId: 0,
        eventName: '',
        eventDate: formatInputDate(new Date()),
        startTime: '10:00',
        endTime: '18:00',
        expectedGuests: 1,
        contactName: '',
        contactPhone: '',
    });
    const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(), null]);
    const [isMultiDay, setIsMultiDay] = useState(false);
    const [guestSearch, setGuestSearch] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!formData.banquetId && venues.length > 0) {
            setFormData(current => ({ ...current, banquetId: venues[0]?.id || 0 }));
        }
    }, [formData.banquetId, venues]);

    // Reset step when modal opens
    useEffect(() => {
        if (isOpen) setStep(1);
    }, [isOpen]);

    const resetForm = () => {
        setFormData({
            banquetId: venues[0]?.id || 0,
            eventName: '',
            eventDate: formatInputDate(new Date()),
            startTime: '10:00',
            endTime: '18:00',
            expectedGuests: 1,
            contactName: '',
            contactPhone: '',
        });
        setDateRange([new Date(), null]);
        setIsMultiDay(false);
        setGuestSearch('');
        setStep(1);
    };

    const handleDateRangeChange = (update: [Date | null, Date | null]) => {
        setDateRange(update);
        const [start, end] = update;
        setFormData(current => ({
            ...current,
            eventDate: start ? formatInputDate(start) : current.eventDate,
            endDate: end ? formatInputDate(end) : undefined,
        }));
    };

    const handleGuestSelect = (guest: any) => {
        const guestName = [guest.firstName, guest.lastName].filter(Boolean).join(' ') || guest.name || '';
        setFormData(current => ({
            ...current,
            guestId: guest.id,
            contactName: guestName || current.contactName,
            contactPhone: guest.phone || current.contactPhone,
        }));
        setGuestSearch('');
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        const success = await onSubmit(formData);
        setIsSubmitting(false);
        if (success) {
            resetForm();
            onClose();
        }
    };

    const selectedVenue = venues.find(v => v.id === formData.banquetId);
    const suggestedAmount = selectedVenue?.baseRateFull ? Number(selectedVenue.baseRateFull) : undefined;

    const canProceed = () => {
        if (step === 1) return formData.banquetId && formData.eventName.trim() && formData.eventDate;
        if (step === 2) return formData.contactName.trim() && formData.contactPhone.trim();
        return true;
    };

    const stepLabelStyle: React.CSSProperties = {
        fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em',
        textAlign: 'center', whiteSpace: 'nowrap',
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="New Banquet Booking" size="lg">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {/* Step indicator */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', marginBottom: 'var(--space-2)', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '14px', left: '25%', right: '25%', display: 'flex' }}>
                        <div style={{ flex: 1, height: '2px', backgroundColor: step > 1 ? 'var(--notion-blue)' : 'var(--notion-border)' }} />
                    </div>
                    {[
                        { num: 1, label: 'Event Details' },
                        { num: 2, label: 'Contact & Billing' },
                        { num: 3, label: 'Confirm' },
                    ].map(s => (
                        <div key={s.num} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                            <div style={{
                                width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '12px', fontWeight: '600',
                                backgroundColor: step >= s.num ? 'var(--notion-blue)' : 'var(--notion-bg-secondary)',
                                color: step >= s.num ? 'white' : 'var(--notion-text-secondary)',
                                border: step >= s.num ? 'none' : '1px solid var(--notion-border)',
                            }}>
                                {step > s.num ? <Check size={14} /> : s.num}
                            </div>
                            <span style={{ ...stepLabelStyle, marginTop: '6px', color: step >= s.num ? 'var(--notion-blue)' : 'var(--notion-text-secondary)' }}>{s.label}</span>
                        </div>
                    ))}
                </div>

                {/* Step 1: Event Details */}
                {step === 1 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        <Select
                            value={formData.banquetId}
                            onChange={e => setFormData({ ...formData, banquetId: parseInt(e.target.value, 10) || 0 })}
                            fullWidth
                            options={venues.map(venue => ({ value: venue.id, label: venue.name }))}
                        />
                        {selectedVenue && (selectedVenue.baseRateHalf || selectedVenue.baseRateFull) && (
                            <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                                Venue rates: {selectedVenue.baseRateHalf && `Half-day ${formatCurrency(Number(selectedVenue.baseRateHalf))}`} {selectedVenue.baseRateFull && `Full-day ${formatCurrency(Number(selectedVenue.baseRateFull))}`}
                            </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                            <Input value={formData.eventName} onChange={e => setFormData({ ...formData, eventName: e.target.value })} placeholder="Event Name *" required />
                            <Select
                                value={formData.eventType || ''}
                                onChange={e => {
                                    const nextValue = e.target.value as CreateBookingPayload['eventType'] | '';
                                    setFormData({ ...formData, eventType: nextValue || undefined });
                                }}
                                fullWidth
                                options={[
                                    { value: '', label: 'Select Event Type' },
                                    { value: 'WEDDING', label: 'Wedding' },
                                    { value: 'CONFERENCE', label: 'Conference' },
                                    { value: 'BIRTHDAY', label: 'Birthday' },
                                    { value: 'CORPORATE', label: 'Corporate' },
                                    { value: 'OTHER', label: 'Other' },
                                ]}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <input type="checkbox" id="multiDay" checked={isMultiDay} onChange={e => {
                                setIsMultiDay(e.target.checked);
                                if (!e.target.checked) {
                                    setFormData(current => ({ ...current, endDate: undefined }));
                                    setDateRange([dateRange[0], null]);
                                }
                            }} style={{ accentColor: 'var(--notion-blue)' }} />
                            <label htmlFor="multiDay" style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', cursor: 'pointer' }}>Multi-day event</label>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
                            {isMultiDay ? (
                                <CustomDatePicker label="Event Dates" selectsRange startDate={dateRange[0]} endDate={dateRange[1]} onChange={handleDateRangeChange as any} minDate={new Date()} required />
                            ) : (
                                <CustomDatePicker label="Event Date" selected={formData.eventDate ? new Date(formData.eventDate) : null} onChange={date => setFormData({ ...formData, eventDate: date ? formatInputDate(date) : '' })} minDate={new Date()} required />
                            )}
                            <TimePicker label="Start Time" value={formData.startTime} onChange={v => setFormData({ ...formData, startTime: v })} />
                            <TimePicker label="End Time" value={formData.endTime} onChange={v => setFormData({ ...formData, endTime: v })} />
                        </div>
                        <Input type="number" min={1} value={formData.expectedGuests || ''} onChange={e => setFormData({ ...formData, expectedGuests: e.target.value === '' ? 1 : parseInt(e.target.value, 10) })} placeholder="Expected Guests *" required />
                    </div>
                )}

                {/* Step 2: Contact & Billing */}
                {step === 2 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        <div style={{ position: 'relative' }}>
                            <Input type="text" value={guestSearch} onChange={e => { setGuestSearch(e.target.value); if (e.target.value.length > 1) searchGuests(e.target.value); }} placeholder="Search customer from CRM..." icon={<Search size={16} />} />
                            {guestSearch && crmGuests.length > 0 && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', zIndex: 1000, maxHeight: '200px', overflowY: 'auto' }}>
                                    {crmGuests.map(guest => (
                                        <button key={guest.id} type="button" onClick={() => handleGuestSelect(guest)} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid var(--notion-border)', cursor: 'pointer', fontSize: '13px', color: 'var(--notion-text)' }}>
                                            {[guest.firstName, guest.lastName].filter(Boolean).join(' ')} {guest.phone && `(${guest.phone})`}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {formData.guestId && <div style={{ fontSize: '12px', color: 'var(--notion-green)', marginTop: '4px' }}>Linked to CRM guest</div>}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                            <Input value={formData.contactName} onChange={e => setFormData({ ...formData, contactName: e.target.value })} placeholder="Contact Name *" required />
                            <Input value={formData.contactPhone} onChange={e => setFormData({ ...formData, contactPhone: e.target.value })} placeholder="Contact Phone *" required />
                        </div>
                        <Input value={formData.contactEmail} onChange={e => setFormData({ ...formData, contactEmail: e.target.value })} placeholder="Contact Email" />
                        <textarea value={formData.specialRequirements || ''} onChange={e => setFormData({ ...formData, specialRequirements: e.target.value })} placeholder="Special requests, dietary needs, setup notes..." rows={3} style={{ width: '100%', padding: '8px', backgroundColor: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', fontSize: '14px', outline: 'none', color: 'var(--notion-text)', resize: 'vertical' }} />
                        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                            <Input type="number" min={0} value={formData.totalAmount || ''} onChange={e => setFormData({ ...formData, totalAmount: parseFloat(e.target.value) || undefined })} placeholder={`Total Amount${suggestedAmount ? ` (suggested: ${formatCurrency(suggestedAmount)})` : ''}`} style={{ flex: 1 }} />
                            <Input type="number" min={0} value={formData.advanceAmount || ''} onChange={e => setFormData({ ...formData, advanceAmount: parseFloat(e.target.value) || undefined })} placeholder="Advance Amount" style={{ flex: 1 }} />
                        </div>
                    </div>
                )}

                {/* Step 3: Review */}
                {step === 3 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        <div style={{ backgroundColor: 'var(--notion-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)', padding: 'var(--space-4)' }}>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--notion-text)', marginBottom: 'var(--space-3)' }}>Booking Summary</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                                <div><strong style={{ color: 'var(--notion-text)' }}>Venue:</strong> {selectedVenue?.name || '—'}</div>
                                <div><strong style={{ color: 'var(--notion-text)' }}>Event:</strong> {formData.eventName || '—'}</div>
                                <div><strong style={{ color: 'var(--notion-text)' }}>Date:</strong> {formData.eventDate}{formData.endDate ? ` – ${formData.endDate}` : ''}</div>
                                <div><strong style={{ color: 'var(--notion-text)' }}>Time:</strong> {formData.startTime} – {formData.endTime}</div>
                                <div><strong style={{ color: 'var(--notion-text)' }}>Guests:</strong> {formData.expectedGuests || '—'}</div>
                                <div><strong style={{ color: 'var(--notion-text)' }}>Type:</strong> {formData.eventType || '—'}</div>
                                <div><strong style={{ color: 'var(--notion-text)' }}>Contact:</strong> {formData.contactName} {formData.contactPhone && `(${formData.contactPhone})`}</div>
                                <div><strong style={{ color: 'var(--notion-text)' }}>Total:</strong> {formData.totalAmount ? formatCurrency(formData.totalAmount) : '—'}</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Navigation */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-2)' }}>
                    <Button variant="secondary" onClick={() => { if (step === 1) { resetForm(); onClose(); } else setStep(step - 1); }}>
                        {step === 1 ? 'Cancel' : <><ChevronLeft size={14} style={{ marginRight: '4px' }} /> Back</>}
                    </Button>
                    {step < 3 ? (
                        <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
                            Next <ChevronRight size={14} style={{ marginLeft: '4px' }} />
                        </Button>
                    ) : (
                        <Button onClick={handleSubmit} disabled={isSubmitting || !canProceed()}>
                            <Check size={14} style={{ marginRight: '4px' }} />
                            {isSubmitting ? 'Creating...' : 'Confirm Booking'}
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
}

export default function EventsPage() {
    const {
        venues,
        bookings,
        isLoading,
        fetchVenues,
        createVenue,
        updateVenue,
        deleteVenue,
        fetchBookings,
        createBooking,
        updateBookingStatus,
        deleteBooking,
    } = useEvents();

    const [activeTab, setActiveTab] = useState<TabId>('bookings');
    const [isVenueModalOpen, setIsVenueModalOpen] = useState(false);
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
    const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
    const [deleteVenueTarget, setDeleteVenueTarget] = useState<Venue | null>(null);
    const [deleteBookingTarget, setDeleteBookingTarget] = useState<BanquetBooking | null>(null);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [bookingSort, setBookingSort] = useState<'date' | 'amount' | 'guests'>('date');
    const [bookingSortDir, setBookingSortDir] = useState<'asc' | 'desc'>('desc');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [venueSearch, setVenueSearch] = useState('');
    const [venueSort, setVenueSort] = useState<'name' | 'capacity'>('name');
    const [venueSortDir, setVenueSortDir] = useState<'asc' | 'desc'>('asc');

    useEffect(() => {
        fetchVenues();
        fetchBookings();
    }, [fetchVenues, fetchBookings]);

    const filteredBookings = useMemo(() => {
        let data = [...bookings];
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            data = data.filter(b =>
                (b.eventName || '').toLowerCase().includes(q) ||
                (b.contactName || '').toLowerCase().includes(q) ||
                (b.venue?.name || '').toLowerCase().includes(q) ||
                (b.eventType || '').toLowerCase().includes(q)
            );
        }
        if (dateFrom) data = data.filter(b => new Date(b.eventDate) >= new Date(dateFrom));
        if (dateTo) data = data.filter(b => new Date(b.eventDate) <= new Date(dateTo + 'T23:59:59'));
        data.sort((a, b) => {
            let cmp = 0;
            if (bookingSort === 'date') cmp = new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime();
            else if (bookingSort === 'amount') cmp = (a.totalAmount || 0) - (b.totalAmount || 0);
            else if (bookingSort === 'guests') cmp = a.expectedGuests - b.expectedGuests;
            return bookingSortDir === 'asc' ? cmp : -cmp;
        });
        return data;
    }, [bookings, searchQuery, dateFrom, dateTo, bookingSort, bookingSortDir]);

    const filteredVenues = useMemo(() => {
        let data = [...venues];
        if (venueSearch.trim()) {
            const q = venueSearch.toLowerCase();
            data = data.filter(v => (v.name || '').toLowerCase().includes(q));
        }
        data.sort((a, b) => {
            let cmp = 0;
            if (venueSort === 'name') cmp = (a.name || '').localeCompare(b.name || '');
            else if (venueSort === 'capacity') cmp = a.capacity - b.capacity;
            return venueSortDir === 'asc' ? cmp : -cmp;
        });
        return data;
    }, [venues, venueSearch, venueSort, venueSortDir]);

    return (
        <DashboardLayout>
            <div style={{ padding: 'var(--space-8)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                    <div>
                        <h1 style={{ fontSize: '28px', fontWeight: '600', color: 'var(--notion-text)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <Calendar size={28} />
                            Events & Banquets
                        </h1>
                        <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', marginTop: 'var(--space-1)' }}>
                            Venue management and event bookings
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                        <Button variant="secondary" onClick={() => { fetchVenues(); fetchBookings(); }} disabled={isLoading}>
                            <RefreshCw size={14} style={{ marginRight: '6px' }} />
                            Refresh
                        </Button>
                        {activeTab === 'venues' && <Button onClick={() => setIsVenueModalOpen(true)}><Plus size={14} style={{ marginRight: '6px' }} />Add Venue</Button>}
                        {activeTab === 'bookings' && venues.length > 0 && <Button onClick={() => setIsBookingModalOpen(true)}><Plus size={14} style={{ marginRight: '6px' }} />New Booking</Button>}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-6)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{ fontSize: '20px', fontWeight: '600', color: 'var(--notion-text)' }}>{venues.filter(venue => venue.isActive).length}</span>
                        <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Active Venues</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{ fontSize: '20px', fontWeight: '600', color: 'var(--notion-blue)' }}>{bookings.filter(booking => booking.status === 'CONFIRMED').length}</span>
                        <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Confirmed</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{ fontSize: '20px', fontWeight: '600', color: 'var(--notion-orange)' }}>{bookings.filter(booking => booking.status === 'PENDING').length}</span>
                        <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Pending</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{ fontSize: '20px', fontWeight: '600', color: 'var(--notion-green)' }}>{bookings.filter(booking => booking.status === 'COMPLETED').length}</span>
                        <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Completed</span>
                    </div>
                </div>

                <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

                {isLoading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 'var(--space-4)' }}>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <SkeletonCard key={i} />
                        ))}
                    </div>
                ) : activeTab === 'bookings' ? (
                    <>
                        {bookings.length > 0 && (
                            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
                                <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--notion-text-muted)' }} />
                                    <input type="text" placeholder="Search events..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                        style={{ width: '100%', padding: '7px 10px 7px 32px', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)', backgroundColor: 'var(--notion-bg)', color: 'var(--notion-text)', fontSize: '13px', outline: 'none' }} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Calendar size={14} style={{ color: 'var(--notion-text-muted)' }} />
                                    <div style={{ width: '150px' }}><DateField value={dateFrom} onChange={setDateFrom} placeholder="From" fullWidth /></div>
                                    <span style={{ color: 'var(--notion-text-muted)', fontSize: '13px' }}>to</span>
                                    <div style={{ width: '150px' }}><DateField value={dateTo} onChange={setDateTo} placeholder="To" fullWidth /></div>
                                </div>
                                <select value={`${bookingSort}:${bookingSortDir}`} onChange={e => { const [f, d] = e.target.value.split(':'); setBookingSort(f as any); setBookingSortDir(d as any); }}
                                    style={{ padding: '7px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)', backgroundColor: 'var(--notion-bg)', color: 'var(--notion-text)', fontSize: '13px', cursor: 'pointer' }}>
                                    <option value="date:desc">Newest First</option>
                                    <option value="date:asc">Oldest First</option>
                                    <option value="amount:desc">Highest Amount</option>
                                    <option value="amount:asc">Lowest Amount</option>
                                    <option value="guests:desc">Most Guests</option>
                                    <option value="guests:asc">Least Guests</option>
                                </select>
                                <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>{filteredBookings.length} results</div>
                            </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 'var(--space-4)' }}>
                            {bookings.length === 0 ? (
                                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-12)', color: 'var(--notion-text-secondary)' }}>
                                    <Calendar size={48} style={{ opacity: 0.3, marginBottom: 'var(--space-4)' }} />
                                    <p>No bookings yet</p>
                                    {venues.length > 0 && <Button onClick={() => setIsBookingModalOpen(true)} style={{ marginTop: 'var(--space-4)' }}>Create First Booking</Button>}
                                </div>
                            ) : filteredBookings.length === 0 ? (
                                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-12)', color: 'var(--notion-text-secondary)' }}>
                                    <Search size={48} style={{ opacity: 0.3, marginBottom: 'var(--space-4)' }} />
                                    <p>No bookings match your filters</p>
                                </div>
                            ) : (
                                filteredBookings.map(booking => (
                                    <BookingCard
                                        key={booking.id}
                                        booking={booking}
                                        onUpdateStatus={status => updateBookingStatus(booking.id, status)}
                                        onDelete={() => setDeleteBookingTarget(booking)}
                                    />
                                ))
                            )}
                        </div>
                    </>
                ) : activeTab === 'calendar' ? (
                    <VenueGantt venues={venues} bookings={bookings as any} />
                ) : activeTab === 'venues' ? (
                    <>
                        {venues.length > 0 && (
                            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
                                <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--notion-text-muted)' }} />
                                    <input type="text" placeholder="Search venues..." value={venueSearch} onChange={e => setVenueSearch(e.target.value)}
                                        style={{ width: '100%', padding: '7px 10px 7px 32px', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)', backgroundColor: 'var(--notion-bg)', color: 'var(--notion-text)', fontSize: '13px', outline: 'none' }} />
                                </div>
                                <select value={`${venueSort}:${venueSortDir}`} onChange={e => { const [f, d] = e.target.value.split(':'); setVenueSort(f as any); setVenueSortDir(d as any); }}
                                    style={{ padding: '7px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)', backgroundColor: 'var(--notion-bg)', color: 'var(--notion-text)', fontSize: '13px', cursor: 'pointer' }}>
                                    <option value="name:asc">Name A-Z</option>
                                    <option value="name:desc">Name Z-A</option>
                                    <option value="capacity:desc">Highest Capacity</option>
                                    <option value="capacity:asc">Lowest Capacity</option>
                                </select>
                                <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>{filteredVenues.length} results</div>
                            </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
                            {venues.length === 0 ? (
                                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-12)', color: 'var(--notion-text-secondary)' }}>
                                    <MapPin size={48} style={{ opacity: 0.3, marginBottom: 'var(--space-4)' }} />
                                    <p>No venues yet</p>
                                    <Button onClick={() => setIsVenueModalOpen(true)} style={{ marginTop: 'var(--space-4)' }}>Add First Venue</Button>
                                </div>
                            ) : filteredVenues.length === 0 ? (
                                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-12)', color: 'var(--notion-text-secondary)' }}>
                                    <Search size={48} style={{ opacity: 0.3, marginBottom: 'var(--space-4)' }} />
                                    <p>No venues match your search</p>
                                </div>
                            ) : (
                                filteredVenues.map(venue => (
                                    <VenueCard
                                        key={venue.id}
                                        venue={venue}
                                        onToggle={() => updateVenue(venue.id, { isActive: !venue.isActive })}
                                        onEdit={() => setEditingVenue(venue)}
                                        onDelete={() => setDeleteVenueTarget(venue)}
                                    />
                                ))
                            )}
                        </div>
                    </>
                ) : (
                    <div>
                        {(() => {
                            const completed = bookings.filter(b => b.status === 'COMPLETED');
                            const cancelled = bookings.filter(b => b.status === 'CANCELLED');
                            const totalRevenue = completed.reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);
                            const totalAdvance = completed.reduce((sum, b) => sum + (Number(b.advanceAmount) || 0), 0);
                            return (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                                        <div style={{ background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                                            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--notion-text)' }}>{completed.length}</div>
                                            <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Completed Events</div>
                                        </div>
                                        <div style={{ background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                                            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--notion-green)' }}>{formatCurrency(totalRevenue)}</div>
                                            <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Total Revenue</div>
                                        </div>
                                        <div style={{ background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                                            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--notion-blue)' }}>{formatCurrency(totalAdvance)}</div>
                                            <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Total Advance</div>
                                        </div>
                                        <div style={{ background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                                            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--notion-red)' }}>{cancelled.length}</div>
                                            <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Cancelled</div>
                                        </div>
                                    </div>
                                    <div style={{ background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                                                <thead style={{ backgroundColor: 'var(--notion-bg-secondary)', borderBottom: '1px solid var(--notion-border)', color: 'var(--notion-text-secondary)' }}>
                                                    <tr>
                                                        {['Event', 'Date', 'Venue', 'Guests', 'Status', 'Amount', 'Invoice'].map(h => (
                                                            <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 500 }}>{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {[...completed, ...cancelled].sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime()).map(b => (
                                                        <tr key={b.id} style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                                            <td style={{ padding: '12px 16px', fontWeight: 500 }}>{b.eventName}</td>
                                                            <td style={{ padding: '12px 16px', color: 'var(--notion-text-secondary)' }}>
                                                                {new Date(b.eventDate).toLocaleDateString()}
                                                                {b.endDate && b.endDate !== b.eventDate && ` - ${new Date(b.endDate).toLocaleDateString()}`}
                                                            </td>
                                                            <td style={{ padding: '12px 16px', color: 'var(--notion-text-secondary)' }}>{b.venue?.name || '-'}</td>
                                                            <td style={{ padding: '12px 16px', color: 'var(--notion-text-secondary)' }}>{b.expectedGuests}</td>
                                                            <td style={{ padding: '12px 16px' }}>
                                                                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: b.status === 'COMPLETED' ? 'var(--notion-green-bg)' : 'var(--notion-red-bg)', color: b.status === 'COMPLETED' ? 'var(--notion-green)' : 'var(--notion-red)' }}>
                                                                    {b.status}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '12px 16px', fontWeight: 500 }}>{formatCurrency(b.totalAmount)}</td>
                                                            <td style={{ padding: '12px 16px' }}>
                                                                {b.invoice ? (
                                                                    <span style={{ fontSize: '12px', color: 'var(--notion-green)' }}>{b.invoice.invoiceNumber}</span>
                                                                ) : (
                                                                    <span style={{ fontSize: '12px', color: 'var(--notion-text-muted)' }}>-</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        {completed.length === 0 && cancelled.length === 0 && (
                                            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>
                                                No completed or cancelled events yet.
                                            </div>
                                        )}
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                )}
            </div>

            <CreateVenueModal isOpen={isVenueModalOpen} onClose={() => setIsVenueModalOpen(false)} onSubmit={createVenue} />
            <EditVenueModal isOpen={!!editingVenue} onClose={() => setEditingVenue(null)} venue={editingVenue} onSubmit={updateVenue} />
            <CreateBookingModal isOpen={isBookingModalOpen} onClose={() => setIsBookingModalOpen(false)} onSubmit={createBooking} venues={venues} />

            <SecurityConfirmModal
                isOpen={!!deleteVenueTarget}
                onClose={() => setDeleteVenueTarget(null)}
                onConfirm={async () => {
                    if (!deleteVenueTarget) return;
                    await deleteVenue(deleteVenueTarget.id);
                }}
                title="Delete Venue"
                message={`Delete venue "${deleteVenueTarget?.name}"? This action cannot be undone.`}
                confirmText="Delete Venue"
                isDestructive
            />

            <SecurityConfirmModal
                isOpen={!!deleteBookingTarget}
                onClose={() => setDeleteBookingTarget(null)}
                onConfirm={async () => {
                    if (!deleteBookingTarget) return;
                    await deleteBooking(deleteBookingTarget.id);
                }}
                title="Delete Booking"
                message={`Delete booking "${deleteBookingTarget?.eventName}"? This action cannot be undone.`}
                confirmText="Delete Booking"
                isDestructive
            />
        </DashboardLayout>
    );
}
