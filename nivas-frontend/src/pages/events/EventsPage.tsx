'use client';

import { useState, useEffect } from 'react';
import { useEvents, type Venue, type BanquetBooking, type CreateVenuePayload, type CreateBookingPayload } from '@/lib/hooks/useEvents';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
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
    Pencil
} from 'lucide-react';

// Tab Navigation
function TabNav({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
    const tabs = [
        { id: 'bookings', label: 'Bookings', icon: Calendar },
        { id: 'venues', label: 'Venues', icon: MapPin },
    ];

    return (
        <div style={{
            display: 'flex',
            gap: 'var(--space-1)',
            borderBottom: '1px solid var(--notion-divider)',
            marginBottom: 'var(--space-6)',
        }}>
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

// Booking Card
function BookingCard({ booking, onUpdateStatus, onDelete }: { booking: BanquetBooking; onUpdateStatus: (status: string) => void; onDelete: () => void }) {
    const statusConfig: Record<string, { color: string; bg: string; icon: any }> = {
        INQUIRY: { color: 'var(--notion-text-secondary)', bg: 'var(--notion-bg-tertiary)', icon: AlertCircle },
        TENTATIVE: { color: 'var(--notion-orange)', bg: 'var(--notion-orange-bg)', icon: Clock },
        CONFIRMED: { color: 'var(--notion-green)', bg: 'var(--notion-green-bg)', icon: CheckCircle },
        CANCELLED: { color: 'var(--notion-red)', bg: 'var(--notion-red-bg)', icon: XCircle },
    };

    const config = statusConfig[booking.status] ?? statusConfig.INQUIRY;
    const StatusIcon = config!.icon;

    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--notion-border)',
            padding: 'var(--space-4)',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                <div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--notion-text)' }}>
                        {booking.eventName}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                        {booking.eventType || 'Event'}
                    </div>
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: '500',
                    backgroundColor: config!.bg,
                    color: config!.color,
                    borderRadius: 'var(--radius-sm)',
                }}>
                    <StatusIcon size={12} />
                    {booking.status}
                </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={12} />
                    {new Date(booking.eventDate).toLocaleDateString()}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} />
                    {booking.startTime} - {booking.endTime}
                </div>
                {booking.expectedGuests && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Users size={12} />
                        {booking.expectedGuests} guests
                    </div>
                )}
            </div>

            <div style={{ fontSize: '13px', marginBottom: 'var(--space-3)' }}>
                <div style={{ color: 'var(--notion-text)' }}>{booking.contactName}</div>
                <div style={{ color: 'var(--notion-text-secondary)' }}>{booking.contactPhone}</div>
            </div>

            {booking.totalAmount && (
                <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--notion-green)', marginBottom: 'var(--space-3)' }}>
                    ₹{(booking.totalAmount || 0).toLocaleString()}
                </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                {booking.status !== 'CANCELLED' && (
                    <>
                        {booking.status === 'INQUIRY' && (
                            <Button size="sm" variant="secondary" onClick={() => onUpdateStatus('TENTATIVE')}>
                                Make Tentative
                            </Button>
                        )}
                        {(booking.status === 'INQUIRY' || booking.status === 'TENTATIVE') && (
                            <Button size="sm" onClick={() => onUpdateStatus('CONFIRMED')}>
                                Confirm
                            </Button>
                        )}
                        <Button size="sm" variant="secondary" onClick={() => onUpdateStatus('CANCELLED')}>
                            Cancel
                        </Button>
                    </>
                )}
                <Button size="sm" variant="ghost" onClick={onDelete} style={{ color: 'var(--notion-red)' }}>
                    <Trash2 size={12} />
                </Button>
            </div>
        </div>
    );
}

// Venue Card
function VenueCard({ venue, onToggle, onEdit, onDelete }: {
    venue: Venue;
    onToggle: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) {
    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--notion-border)',
            padding: 'var(--space-4)',
            opacity: venue.isActive ? 1 : 0.6,
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--notion-text)' }}>
                    {venue.name}
                </div>
                <div style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: '500',
                    backgroundColor: venue.isActive ? 'var(--notion-green-bg)' : 'var(--notion-bg-tertiary)',
                    color: venue.isActive ? 'var(--notion-green)' : 'var(--notion-text-secondary)',
                    borderRadius: 'var(--radius-sm)',
                }}>
                    {venue.isActive ? 'Active' : 'Inactive'}
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'var(--notion-blue)', marginBottom: 'var(--space-2)' }}>
                <Users size={14} />
                Capacity: {venue.capacity}
            </div>

            {venue.description && (
                <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)' }}>
                    {venue.description}
                </div>
            )}

            {venue.amenities && venue.amenities.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: 'var(--space-3)' }}>
                    {venue.amenities.map((amenity, i) => (
                        <span key={i} style={{
                            padding: '2px 8px',
                            fontSize: '11px',
                            backgroundColor: 'var(--notion-bg-tertiary)',
                            color: 'var(--notion-text-secondary)',
                            borderRadius: '4px',
                        }}>
                            {amenity}
                        </span>
                    ))}
                </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button size="sm" variant="secondary" onClick={onToggle}>
                    {venue.isActive ? 'Deactivate' : 'Activate'}
                </Button>
                <Button size="sm" variant="ghost" onClick={onEdit}>
                    <Pencil size={12} />
                </Button>
                <Button size="sm" variant="ghost" onClick={onDelete} style={{ color: 'var(--notion-red)' }}>
                    <Trash2 size={12} />
                </Button>
            </div>
        </div>
    );
}

// Create Venue Modal
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
                <Input
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Venue Name *"
                    required
                />
                <Input
                    type="number"
                    min={1}
                    value={formData.capacity}
                    onChange={e => setFormData({ ...formData, capacity: parseInt(e.target.value) || 50 })}
                    placeholder="Capacity"
                />
                <Input
                    value={formData.description || ''}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Description"
                />
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting || !formData.name.trim()} style={{ flex: 1 }}>
                        {isSubmitting ? 'Creating...' : 'Create'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

// Edit Venue Modal
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
            });
        }
    }, [venue]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!venue) return;
        setIsSubmitting(true);
        const success = await onSubmit(venue.id, formData);
        setIsSubmitting(false);
        if (success) onClose();
    };

    if (!venue) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Venue">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <Input
                    value={formData.name || ''}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Venue Name *"
                    required
                />
                <Input
                    type="number"
                    min={1}
                    value={formData.capacity || 50}
                    onChange={e => setFormData({ ...formData, capacity: parseInt(e.target.value) || 50 })}
                    placeholder="Capacity"
                />
                <Input
                    value={formData.description || ''}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Description"
                />
                <Input
                    value={(formData.amenities || []).join(', ')}
                    onChange={e => setFormData({ ...formData, amenities: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    placeholder="Amenities (comma separated)"
                />
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting || !(formData.name || '').trim()} style={{ flex: 1 }}>
                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

// Create Booking Modal
function CreateBookingModal({ isOpen, onClose, onSubmit, venues }: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: CreateBookingPayload) => Promise<boolean>;
    venues: Venue[];
}) {
    const [formData, setFormData] = useState<CreateBookingPayload>({
        banquetId: venues[0]?.id || 0,
        eventName: '',
        eventDate: new Date().toISOString().split('T')[0] as string,
        startTime: '10:00',
        endTime: '18:00',
        contactName: '',
        contactPhone: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const success = await onSubmit(formData);
        setIsSubmitting(false);
        if (success) {
            setFormData({
                banquetId: venues[0]?.id || 0,
                eventName: '',
                eventDate: new Date().toISOString().split('T')[0] as string,
                startTime: '10:00',
                endTime: '18:00',
                contactName: '',
                contactPhone: '',
            });
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create Booking">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <select
                    value={formData.banquetId}
                    onChange={e => setFormData({ ...formData, banquetId: parseInt(e.target.value) })}
                    style={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: '14px',
                        border: '1px solid var(--notion-border)',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--notion-bg-secondary)',
                        color: 'var(--notion-text)',
                    }}
                >
                    {venues.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                </select>
                <Input
                    value={formData.eventName}
                    onChange={e => setFormData({ ...formData, eventName: e.target.value })}
                    placeholder="Event Name *"
                    required
                />
                <select
                    value={formData.eventType || ''}
                    onChange={e => setFormData({ ...formData, eventType: e.target.value as any })}
                    style={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: '14px',
                        border: '1px solid var(--notion-border)',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--notion-bg-secondary)',
                        color: 'var(--notion-text)',
                    }}
                >
                    <option value="">Select Event Type</option>
                    <option value="WEDDING">Wedding</option>
                    <option value="CONFERENCE">Conference</option>
                    <option value="BIRTHDAY">Birthday</option>
                    <option value="CORPORATE">Corporate</option>
                    <option value="OTHER">Other</option>
                </select>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <Input
                        type="date"
                        value={formData.eventDate}
                        onChange={e => setFormData({ ...formData, eventDate: e.target.value })}
                        style={{ flex: 1 }}
                    />
                    <Input
                        type="time"
                        value={formData.startTime}
                        onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                        style={{ flex: 1 }}
                    />
                    <Input
                        type="time"
                        value={formData.endTime}
                        onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                        style={{ flex: 1 }}
                    />
                </div>
                <Input
                    value={formData.contactName}
                    onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                    placeholder="Contact Name *"
                    required
                />
                <Input
                    value={formData.contactPhone}
                    onChange={e => setFormData({ ...formData, contactPhone: e.target.value })}
                    placeholder="Contact Phone *"
                    required
                />
                <Input
                    type="number"
                    value={formData.expectedGuests || ''}
                    onChange={e => setFormData({ ...formData, expectedGuests: parseInt(e.target.value) || undefined })}
                    placeholder="Expected Guests"
                />
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting || !formData.eventName.trim() || !formData.contactName.trim()} style={{ flex: 1 }}>
                        {isSubmitting ? 'Creating...' : 'Create'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

// Main Page
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

    const [activeTab, setActiveTab] = useState('bookings');
    const [isVenueModalOpen, setIsVenueModalOpen] = useState(false);
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
    const [editingVenue, setEditingVenue] = useState<Venue | null>(null);

    const handleDeleteVenue = async (venue: Venue) => {
        if (!confirm(`Delete venue "${venue.name}"? This action cannot be undone.`)) return;
        await deleteVenue(venue.id);
    };

    const handleDeleteBooking = async (booking: BanquetBooking) => {
        if (!confirm(`Delete booking "${booking.eventName}"? This action cannot be undone.`)) return;
        await deleteBooking(String(booking.id));
    };

    useEffect(() => {
        fetchVenues();
        fetchBookings();
    }, [fetchVenues, fetchBookings]);

    return (
        <DashboardLayout>
            <div style={{ padding: 'var(--space-8)' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                        <div>
                            <h1 style={{
                                fontSize: '28px',
                                fontWeight: '600',
                                color: 'var(--notion-text)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-3)',
                            }}>
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
                            {activeTab === 'venues' && (
                                <Button onClick={() => setIsVenueModalOpen(true)}>
                                    <Plus size={14} style={{ marginRight: '6px' }} />
                                    Add Venue
                                </Button>
                            )}
                            {activeTab === 'bookings' && venues.length > 0 && (
                                <Button onClick={() => setIsBookingModalOpen(true)}>
                                    <Plus size={14} style={{ marginRight: '6px' }} />
                                    New Booking
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Stats */}
                    <div style={{ display: 'flex', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <span style={{ fontSize: '20px', fontWeight: '600', color: 'var(--notion-text)' }}>{venues.filter(v => v.isActive).length}</span>
                            <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Active Venues</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <span style={{ fontSize: '20px', fontWeight: '600', color: 'var(--notion-green)' }}>{bookings.filter(b => b.status === 'CONFIRMED').length}</span>
                            <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Confirmed</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <span style={{ fontSize: '20px', fontWeight: '600', color: 'var(--notion-orange)' }}>{bookings.filter(b => b.status === 'TENTATIVE').length}</span>
                            <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Tentative</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <span style={{ fontSize: '20px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>{bookings.filter(b => b.status === 'INQUIRY').length}</span>
                            <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Inquiries</span>
                        </div>
                    </div>

                    {/* Tabs */}
                    <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

                    {/* Bookings Tab */}
                    {activeTab === 'bookings' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 'var(--space-4)' }}>
                            {bookings.length === 0 ? (
                                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-12)', color: 'var(--notion-text-secondary)' }}>
                                    <Calendar size={48} style={{ opacity: 0.3, marginBottom: 'var(--space-4)' }} />
                                    <p>No bookings yet</p>
                                    {venues.length > 0 && (
                                        <Button onClick={() => setIsBookingModalOpen(true)} style={{ marginTop: 'var(--space-4)' }}>
                                            Create First Booking
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                bookings.map(booking => (
                                    <BookingCard
                                        key={booking.id}
                                        booking={booking}
                                        onUpdateStatus={(status) => updateBookingStatus(String(booking.id), status as any)}
                                        onDelete={() => handleDeleteBooking(booking)}
                                    />
                                ))
                            )}
                        </div>
                    )}

                    {/* Venues Tab */}
                    {activeTab === 'venues' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
                            {venues.length === 0 ? (
                                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-12)', color: 'var(--notion-text-secondary)' }}>
                                    <MapPin size={48} style={{ opacity: 0.3, marginBottom: 'var(--space-4)' }} />
                                    <p>No venues yet</p>
                                    <Button onClick={() => setIsVenueModalOpen(true)} style={{ marginTop: 'var(--space-4)' }}>
                                        Add First Venue
                                    </Button>
                                </div>
                            ) : (
                                venues.map(venue => (
                                    <VenueCard
                                        key={venue.id}
                                        venue={venue}
                                        onToggle={() => updateVenue(venue.id, { isActive: !venue.isActive })}
                                        onEdit={() => setEditingVenue(venue)}
                                        onDelete={() => handleDeleteVenue(venue)}
                                    />
                                ))
                            )}
                        </div>
                    )}
            </div>

            {/* Modals */}
            <CreateVenueModal isOpen={isVenueModalOpen} onClose={() => setIsVenueModalOpen(false)} onSubmit={createVenue} />
            <EditVenueModal isOpen={!!editingVenue} onClose={() => setEditingVenue(null)} venue={editingVenue} onSubmit={updateVenue} />
            <CreateBookingModal isOpen={isBookingModalOpen} onClose={() => setIsBookingModalOpen(false)} onSubmit={createBooking} venues={venues} />
        </DashboardLayout>
    );
}
