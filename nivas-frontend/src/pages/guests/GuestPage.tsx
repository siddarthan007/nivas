'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import CustomDatePicker from '@/components/ui/DatePicker';
import { useDebounce } from '@/lib/hooks/useDebounce';
import {
    GuestService,
    type GuestSearchResult,
    type GuestDetails,
    type GuestFilters,
    type GuestFinancials
} from '@/lib/services/guest.service';
import {
    Users,
    Search,
    Plus,
    Phone,
    Mail,
    Calendar,
    Loader2,
    Star,
    Ban,
    Filter,
    X,
    CreditCard,
    FileText,
    MoreHorizontal,
    RefreshCw,
    Edit3,
    Save,
    MapPin,
    Globe,
    Shield,
    DollarSign,
    Home,
    Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import Pagination from '@/components/ui/Pagination';
import NationalitySelect from '@/components/features/guests/NationalitySelect';
import RecordPaymentModal from '@/components/features/payments/RecordPaymentModal';
import SecurityConfirmModal from '@/components/modals/SecurityConfirmModal';

export default function GuestPage() {
    const [guests, setGuests] = useState<GuestSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState<GuestFilters>({});
    const [showFilters, setShowFilters] = useState(false);

    const debouncedSearch = useDebounce(searchQuery, 300);

    // Modal states
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<GuestSearchResult | null>(null);

    useEffect(() => {
        fetchGuests();
    }, [debouncedSearch, filters, pagination.page, pagination.limit]);

    const fetchGuests = async () => {
        setLoading(true);
        try {
            const activeFilters: GuestFilters = {
                query: debouncedSearch || undefined,
                ...filters,
                page: pagination.page,
                limit: pagination.limit
            };

            const data = await GuestService.search(activeFilters);
            // GuestService.search currently returns GuestSearchResult[] directly, 
            // but usually it should return { data, meta } for pagination.
            // Based on previous read, it returns array. Let's assume for now it returns array
            // and we might need to adjust if pagination is supported by backend search endpoint 
            // or if we need to wrap it.
            // Actually, looking at guest.service.ts earlier:
            // search(filters?: GuestFilters): Promise<GuestSearchResult[]>
            // It seems it doesn't return full pagination meta yet. 
            // However, the controller supports it. 
            // For this UI refactor, I will stick to the existing data shape but style the table.
            setGuests(data);
        } catch (error) {
            console.error('Failed to fetch guests', error);
            toast.error('Failed to fetch guests');
        } finally {
            setLoading(false);
        }
    };

    const [createNationality, setCreateNationality] = useState('');

    const handleCreateGuest = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        try {
            await GuestService.create({
                fullName: formData.get('fullName') as string,
                phone: formData.get('phone') as string,
                email: formData.get('email') as string,
                notes: formData.get('notes') as string,
                nationality: createNationality || undefined,
                idNumber: formData.get('idNumber') as string,
            });
            toast.success('Guest created');
            setIsCreateOpen(false);
            setCreateNationality('');
            fetchGuests();
        } catch (error) {
            toast.error('Failed to create guest');
        }
    };

    const clearFilters = () => {
        setFilters({});
        setSearchQuery('');
    };

    return (
        <DashboardLayout>
            <div style={{ padding: 'var(--space-8)' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                    <div>
                        <h1 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: '24px', fontWeight: '600', color: 'var(--notion-text)' }}>
                            <Users size={28} />
                            Guest Management
                        </h1>
                        <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', marginTop: '4px' }}>
                            Search, view, and manage guest profiles
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                        <Button variant="secondary" onClick={() => fetchGuests()} disabled={loading}>
                            <RefreshCw size={14} style={{ marginRight: '8px' }} /> Refresh
                        </Button>
                        <Button onClick={() => setIsCreateOpen(true)} variant="primary">
                            <Plus size={14} style={{ marginRight: '8px' }} /> Add Guest
                        </Button>
                    </div>
                </div>

                {/* Search & Filter Bar */}
                <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)', alignItems: 'center' }}>
                    <div style={{ position: 'relative', maxWidth: '400px', flex: 1 }}>
                        <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--notion-text-secondary)' }} size={16} />
                        <input
                            type="text"
                            placeholder="Search by name, phone, email, or ID..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px 12px 8px 36px',
                                fontSize: '14px',
                                border: '1px solid var(--notion-border)',
                                borderRadius: 'var(--radius-md)',
                                backgroundColor: 'var(--notion-bg-secondary)',
                                color: 'var(--notion-text)',
                                outline: 'none'
                            }}
                        />
                    </div>

                    <Button
                        variant="secondary"
                        onClick={() => setShowFilters(!showFilters)}
                        style={{ backgroundColor: showFilters ? 'var(--notion-bg-hover)' : undefined }}
                    >
                        <Filter size={14} style={{ marginRight: '8px' }} />
                        Filters
                    </Button>

                    {(Object.keys(filters).length > 0 || searchQuery) && (
                        <Button variant="ghost" onClick={clearFilters} style={{ color: 'var(--notion-red)' }}>
                            <X size={14} style={{ marginRight: '8px' }} />
                            Clear
                        </Button>
                    )}
                </div>

                {/* Filter Options Panel */}
                {showFilters && (
                    <div style={{
                        padding: 'var(--space-4)',
                        backgroundColor: 'var(--notion-bg-secondary)',
                        border: '1px solid var(--notion-border)',
                        borderRadius: 'var(--radius-md)',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                        gap: 'var(--space-4)',
                        marginBottom: 'var(--space-6)',
                        animation: 'fadeIn 0.2s ease-out'
                    }}>
                        <Select
                            label="VIP Status"
                            value={filters.isVip === undefined ? '' : String(filters.isVip)}
                            onChange={e => setFilters(prev => ({
                                ...prev,
                                isVip: e.target.value === '' ? undefined : e.target.value === 'true'
                            }))}
                            fullWidth
                            options={[
                                { value: '', label: 'All Guests' },
                                { value: 'true', label: 'VIP Only' },
                                { value: 'false', label: 'Non-VIP' },
                            ]}
                        />
                        <Select
                            label="Banned Status"
                            value={filters.isBanned === undefined ? '' : String(filters.isBanned)}
                            onChange={e => setFilters(prev => ({
                                ...prev,
                                isBanned: e.target.value === '' ? undefined : e.target.value === 'true'
                            }))}
                            fullWidth
                            options={[
                                { value: '', label: 'All Statuses' },
                                { value: 'false', label: 'Active Only' },
                                { value: 'true', label: 'Banned Only' },
                            ]}
                        />
                        <NationalitySelect
                            label="Nationality"
                            value={filters.nationality || ''}
                            onChange={(val: string) => setFilters(prev => ({ ...prev, nationality: val || undefined }))}
                        />
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--notion-text-secondary)', marginBottom: '6px' }}>
                                Room Number
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. 101"
                                style={{ width: '100%', padding: '8px', backgroundColor: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-sm)', fontSize: '14px', outline: 'none', color: 'var(--notion-text)' }}
                                value={filters.roomNumber || ''}
                                onChange={e => setFilters(prev => ({ ...prev, roomNumber: e.target.value || undefined }))}
                            />
                        </div>
                        <div>
                            <CustomDatePicker
                                label="Date of Stay"
                                selected={filters.dateOfStay ? new Date(filters.dateOfStay) : null}
                                onChange={date => setFilters(prev => ({ ...prev, dateOfStay: date ? date.toISOString().split('T')[0] : undefined }))}
                                maxDate={new Date()}
                            />
                        </div>
                    </div>
                )}

                {/* Results Table */}
                <div style={{
                    backgroundColor: 'var(--notion-bg)',
                    border: '1px solid var(--notion-border)',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden'
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
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500' }}>Contact</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500' }}>Nationality</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500' }}>Status</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody style={{ borderTop: '1px solid var(--notion-border)' }}>
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                                                <Loader2 className="animate-spin" size={20} /> Loading...
                                            </div>
                                        </td>
                                    </tr>
                                ) : guests.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>
                                            No guests found matching your criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    guests.map(guest => (
                                        <tr key={guest.id} style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{
                                                        width: '32px', height: '32px', borderRadius: '50%',
                                                        backgroundColor: 'var(--notion-bg-tertiary)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '12px', fontWeight: '600', color: 'var(--notion-text-secondary)'
                                                    }}>
                                                        {(guest.fullName?.[0] || '?').toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: '500', color: 'var(--notion-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            {guest.fullName}
                                                            {guest.isVip && <Star size={12} style={{ color: 'var(--notion-yellow)', fill: 'var(--notion-yellow)' }} />}
                                                        </div>
                                                        {guest.notes && <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', marginTop: '2px', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{guest.notes}</div>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    {guest.phone && (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--notion-text)' }}>
                                                            <Phone size={12} style={{ color: 'var(--notion-text-secondary)' }} /> {guest.phone}
                                                        </span>
                                                    )}
                                                    {guest.email && (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--notion-text-secondary)' }}>
                                                            <Mail size={12} style={{ color: 'var(--notion-text-secondary)' }} /> {guest.email}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 16px', color: 'var(--notion-text-secondary)' }}>
                                                {guest.nationality || '—'}
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                {guest.isBanned ? (
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                        padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '500',
                                                        backgroundColor: 'rgba(235, 87, 87, 0.1)', color: 'var(--notion-red)'
                                                    }}>
                                                        <Ban size={10} /> Banned
                                                    </span>
                                                ) : guest.isVip ? (
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                        padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '500',
                                                        backgroundColor: 'rgba(235, 179, 13, 0.1)', color: 'var(--notion-yellow)'
                                                    }}>
                                                        <Star size={10} /> VIP
                                                    </span>
                                                ) : (
                                                    <span style={{
                                                        display: 'inline-flex', padding: '2px 8px', borderRadius: '4px',
                                                        fontSize: '12px', color: 'var(--notion-text-secondary)', border: '1px solid var(--notion-border)'
                                                    }}>
                                                        Regular
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <Button size="sm" variant="secondary" onClick={() => setSelectedGuestId(guest.id)}>
                                                        View Details
                                                    </Button>
                                                    <Button size="sm" variant="secondary" onClick={() => setDeleteTarget(guest)}
                                                        style={{ color: 'var(--notion-red)', padding: '4px 8px' }}>
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pagination */}
                {!loading && guests.length > 0 && (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        backgroundColor: 'var(--notion-bg-secondary)',
                        borderTop: '1px solid var(--notion-border)',
                        borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
                        fontSize: '13px',
                        color: 'var(--notion-text-secondary)',
                    }}>
                        <span>
                            Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total || guests.length)} of {pagination.total || guests.length} guests
                        </span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <Button
                                size="sm"
                                variant="secondary"
                                disabled={pagination.page <= 1}
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                            >
                                Previous
                            </Button>
                            <Button
                                size="sm"
                                variant="secondary"
                                disabled={pagination.page >= pagination.totalPages}
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}

                {/* Create Modal */}
                <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Add New Guest">
                    <form onSubmit={handleCreateGuest} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <Input name="fullName" label="Full Name *" required placeholder="John Doe" icon={<Users size={14} />} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                            <Input name="phone" label="Phone" placeholder="+91 9876543210" icon={<Phone size={14} />} />
                            <Input name="email" label="Email" type="email" placeholder="john@example.com" icon={<Mail size={14} />} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                            <NationalitySelect
                                label="Nationality"
                                value={createNationality}
                                onChange={setCreateNationality}
                            />
                            <Input name="idNumber" label="ID Number" placeholder="XXXX-XXXX" />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', color: 'var(--notion-text-secondary)', marginBottom: '4px' }}>Notes</label>
                            <textarea
                                name="notes"
                                rows={3}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    backgroundColor: 'var(--notion-bg)',
                                    border: '1px solid var(--notion-border)',
                                    borderRadius: 'var(--radius-md)',
                                    fontSize: '14px',
                                    outline: 'none',
                                    color: 'var(--notion-text)'
                                }}
                                placeholder="Allergies, preferences..."
                            ></textarea>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', paddingTop: 'var(--space-2)' }}>
                            <Button type="button" variant="secondary" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                            <Button type="submit" variant="primary">Create Guest</Button>
                        </div>
                    </form>
                </Modal>

                {/* Guest Details Modal */}
                <GuestDetailsModal
                    isOpen={!!selectedGuestId}
                    guestId={selectedGuestId}
                    onClose={() => setSelectedGuestId(null)}
                />

                {/* Delete Confirmation */}
                <SecurityConfirmModal
                    isOpen={!!deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    onConfirm={async () => {
                        if (!deleteTarget) return;
                        try {
                            await GuestService.delete(deleteTarget.id);
                            toast.success(`Guest "${deleteTarget.fullName}" deleted`);
                            fetchGuests();
                        } catch (err: any) {
                            toast.error(err.message || 'Failed to delete guest');
                        }
                    }}
                    title="Delete Guest"
                    message={`Are you sure you want to delete "${deleteTarget?.fullName}"? This action cannot be undone.`}
                    confirmText="Delete Guest"
                    isDestructive
                />
            </div>
        </DashboardLayout>
    );
}

function GuestDetailsModal({ isOpen, guestId, onClose }: { isOpen: boolean; guestId: string | null; onClose: () => void }) {
    const [activeTab, setActiveTab] = useState<'profile' | 'history' | 'financials'>('profile');
    const [details, setDetails] = useState<GuestDetails | null>(null);
    const [financials, setFinancials] = useState<GuestFinancials | null>(null);
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<any>({});
    const [isSaving, setIsSaving] = useState(false);
    const [showPayment, setShowPayment] = useState(false);
    const [paymentBookingId, setPaymentBookingId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && guestId) {
            fetchData();
        } else {
            setDetails(null);
            setFinancials(null);
            setActiveTab('profile');
            setIsEditing(false);
        }
    }, [isOpen, guestId]);

    const fetchData = async () => {
        if (!guestId) return;
        setLoading(true);
        try {
            const [detailsData, financialsData] = await Promise.all([
                GuestService.getById(guestId),
                GuestService.getFinancials(guestId)
            ]);
            setDetails(detailsData);
            setFinancials(financialsData);
            if (detailsData) {
                setEditForm({
                    fullName: detailsData.fullName || '',
                    phone: detailsData.phone || '',
                    email: detailsData.email || '',
                    nationality: detailsData.nationality || '',
                    idType: detailsData.idType || '',
                    idNumber: detailsData.idNumber || '',
                    address: detailsData.address || '',
                    notes: detailsData.notes || '',
                    isVip: detailsData.isVip || false,
                });
            }
        } catch (error) {
            toast.error('Failed to load guest details');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!guestId) return;
        setIsSaving(true);
        try {
            await GuestService.update(guestId, editForm);
            toast.success('Guest updated successfully');
            setIsEditing(false);
            await fetchData();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Failed to update guest');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    const labelStyle = { fontSize: '12px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' } as const;
    const activeBooking = details?.bookings?.find((b: any) => b.status === 'CHECKED_IN' || b.status === 'CONFIRMED');

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="" size="lg">
            {loading ? (
                <div style={{ padding: 'var(--space-12)', display: 'flex', justifyContent: 'center' }}>
                    <Loader2 className="animate-spin" size={24} style={{ color: 'var(--notion-text-secondary)' }} />
                </div>
            ) : !details ? (
                <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>Guest not found</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                    {/* Guest Header */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
                        padding: 'var(--space-4)', backgroundColor: 'var(--notion-bg-secondary)',
                        borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)',
                    }}>
                        <div style={{
                            width: '56px', height: '56px', borderRadius: '50%',
                            backgroundColor: 'var(--notion-blue-bg)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '20px', fontWeight: '700', color: 'var(--notion-blue)',
                            flexShrink: 0,
                        }}>
                            {details.fullName?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--notion-text)', margin: 0 }}>{details.fullName}</h2>
                                {details.isVip && <span style={{ fontSize: '11px', backgroundColor: 'rgba(235, 179, 13, 0.1)', color: 'var(--notion-yellow)', padding: '2px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><Star size={10} /> VIP</span>}
                                {details.isBanned && <span style={{ fontSize: '11px', backgroundColor: 'rgba(235, 87, 87, 0.1)', color: 'var(--notion-red)', padding: '2px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><Ban size={10} /> Banned</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '4px', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                                {details.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={12} /> {details.phone}</span>}
                                {details.email && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={12} /> {details.email}</span>}
                                {details.nationality && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Globe size={12} /> {details.nationality}</span>}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                                onClick={() => setIsEditing(!isEditing)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px',
                                    fontSize: '12px', fontWeight: '500', background: 'none',
                                    border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer', color: 'var(--notion-blue)',
                                }}
                            >
                                <Edit3 size={12} /> {isEditing ? 'Cancel Edit' : 'Edit'}
                            </button>
                            {financials?.stats && financials.stats.balance > 0 && (
                                <button
                                    onClick={() => { setPaymentBookingId(activeBooking?.id || null); setShowPayment(true); }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px',
                                        fontSize: '12px', fontWeight: '500', backgroundColor: 'var(--notion-blue)',
                                        border: 'none', borderRadius: 'var(--radius-md)',
                                        cursor: 'pointer', color: '#fff',
                                    }}
                                >
                                    <CreditCard size={12} /> Record Payment
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Active Booking Alert */}
                    {activeBooking && (
                        <div style={{
                            padding: '10px 14px', backgroundColor: 'rgba(68,131,97,0.06)',
                            border: '1px solid rgba(68,131,97,0.2)', borderRadius: 'var(--radius-md)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Home size={14} style={{ color: 'var(--notion-green)' }} />
                                <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--notion-text)' }}>
                                    Currently {activeBooking.status === 'CHECKED_IN' ? 'staying in' : 'booked for'} Room {activeBooking.room?.number || activeBooking.roomId}
                                </span>
                            </div>
                            <span style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>
                                {format(new Date(activeBooking.checkIn), 'MMM d')} – {format(new Date(activeBooking.checkOut), 'MMM d, yyyy')}
                            </span>
                        </div>
                    )}

                    {/* Tabs */}
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--notion-border)' }}>
                        {(['profile', 'history', 'financials'] as const).map((tab) => (
                            <button
                                key={tab}
                                style={{
                                    padding: '8px 16px', fontSize: '14px', fontWeight: '500',
                                    borderBottom: activeTab === tab ? '2px solid var(--notion-blue)' : '2px solid transparent',
                                    color: activeTab === tab ? 'var(--notion-blue)' : 'var(--notion-text-secondary)',
                                    background: 'none', border: 'none',
                                    borderBottomWidth: '2px', borderBottomStyle: 'solid',
                                    cursor: 'pointer',
                                }}
                                onClick={() => setActiveTab(tab)}
                            >
                                {tab === 'history' ? 'Bookings & Orders' : tab === 'financials' ? 'Financial Ledger' : 'Profile'}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div style={{ minHeight: '300px' }}>
                        {activeTab === 'profile' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', animation: 'fadeIn 0.2s ease-out' }}>
                                {isEditing ? (
                                    /* Edit Mode */
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                            <div>
                                                <label style={labelStyle}>Full Name *</label>
                                                <Input value={editForm.fullName} onChange={(e: any) => setEditForm({ ...editForm, fullName: e.target.value })} />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Phone</label>
                                                <Input value={editForm.phone} onChange={(e: any) => setEditForm({ ...editForm, phone: e.target.value })} />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Email</label>
                                                <Input type="email" value={editForm.email} onChange={(e: any) => setEditForm({ ...editForm, email: e.target.value })} />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Nationality</label>
                                                <Input value={editForm.nationality} onChange={(e: any) => setEditForm({ ...editForm, nationality: e.target.value })} />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>ID Type</label>
                                                <Input value={editForm.idType} onChange={(e: any) => setEditForm({ ...editForm, idType: e.target.value })} placeholder="Passport, Citizenship, etc." />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>ID Number</label>
                                                <Input value={editForm.idNumber} onChange={(e: any) => setEditForm({ ...editForm, idNumber: e.target.value })} />
                                            </div>
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Address</label>
                                            <Input value={editForm.address} onChange={(e: any) => setEditForm({ ...editForm, address: e.target.value })} placeholder="Full address" />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Notes</label>
                                            <textarea
                                                value={editForm.notes}
                                                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                                                style={{
                                                    width: '100%', minHeight: '80px', padding: '8px 12px',
                                                    backgroundColor: 'var(--notion-bg-secondary)', border: '1px solid var(--notion-border)',
                                                    borderRadius: 'var(--radius-md)', color: 'var(--notion-text)',
                                                    fontSize: '14px', fontFamily: 'inherit', resize: 'vertical',
                                                }}
                                                placeholder="Allergies, preferences..."
                                            />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--notion-text)', cursor: 'pointer' }}>
                                                <input type="checkbox" checked={editForm.isVip} onChange={e => setEditForm({ ...editForm, isVip: e.target.checked })} style={{ accentColor: 'var(--notion-yellow)' }} />
                                                <Star size={14} style={{ color: 'var(--notion-yellow)' }} /> Mark as VIP
                                            </label>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                            <Button variant="secondary" onClick={() => setIsEditing(false)}>Cancel</Button>
                                            <Button onClick={handleSave} disabled={isSaving || !editForm.fullName?.trim()}>
                                                <Save size={14} style={{ marginRight: '4px' }} />
                                                {isSaving ? 'Saving...' : 'Save Changes'}
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    /* View Mode */
                                    <>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                            {[
                                                { label: 'Email', value: details.email, icon: <Mail size={14} /> },
                                                { label: 'Phone', value: details.phone, icon: <Phone size={14} /> },
                                                { label: 'Nationality', value: details.nationality, icon: <Globe size={14} /> },
                                                { label: 'ID Details', value: details.idType ? `${details.idType}: ${details.idNumber}` : null, icon: <Shield size={14} /> },
                                                { label: 'Address', value: details.address, icon: <MapPin size={14} /> },
                                                { label: 'Member Since', value: details.createdAt ? format(new Date(details.createdAt), 'MMM d, yyyy') : null, icon: <Calendar size={14} /> },
                                            ].map((field, i) => (
                                                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <label style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>{field.label}</label>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--notion-text)' }}>
                                                        {field.icon && <span style={{ color: 'var(--notion-text-muted)' }}>{field.icon}</span>}
                                                        {field.value || '—'}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Stats summary */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                                            <div style={{ padding: '12px', backgroundColor: 'var(--notion-bg-tertiary)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                                <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--notion-text)' }}>{details.bookings?.length || 0}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase' }}>Total Stays</div>
                                            </div>
                                            <div style={{ padding: '12px', backgroundColor: 'var(--notion-bg-tertiary)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                                <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--notion-text)' }}>₹{(financials?.stats.totalInvoiced || 0).toLocaleString()}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase' }}>Total Spend</div>
                                            </div>
                                            <div style={{ padding: '12px', backgroundColor: 'var(--notion-bg-tertiary)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                                <div style={{ fontSize: '20px', fontWeight: '700', color: (financials?.stats.balance || 0) > 0 ? 'var(--notion-red)' : 'var(--notion-green)' }}>
                                                    ₹{(financials?.stats.balance || 0).toLocaleString()}
                                                </div>
                                                <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase' }}>Balance</div>
                                            </div>
                                        </div>

                                        <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)' }}>
                                            <h4 style={{ fontSize: '14px', fontWeight: '500', color: 'var(--notion-text)', margin: '0 0 8px 0' }}>Notes</h4>
                                            <p style={{ fontSize: '14px', color: 'var(--notion-text-muted)', fontStyle: details.notes ? 'normal' : 'italic', margin: 0 }}>
                                                {details.notes || "No notes available."}
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {activeTab === 'history' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', animation: 'fadeIn 0.2s ease-out' }}>
                                <h4 style={{ fontSize: '14px', fontWeight: '500', color: 'var(--notion-text)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                                    <Calendar size={16} /> Bookings ({details.bookings?.length || 0})
                                </h4>
                                {(!details.bookings || details.bookings.length === 0) ? (
                                    <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', padding: '16px', textAlign: 'center', border: '1px dashed var(--notion-border)', borderRadius: 'var(--radius-lg)' }}>
                                        No booking history found.
                                    </p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                        {details.bookings.map((booking: any) => {
                                            const isActive = booking.status === 'CHECKED_IN' || booking.status === 'CONFIRMED';
                                            return (
                                                <div key={booking.id} style={{
                                                    border: `1px solid ${isActive ? 'rgba(68,131,97,0.3)' : 'var(--notion-border)'}`,
                                                    borderRadius: 'var(--radius-md)', padding: '12px',
                                                    backgroundColor: isActive ? 'rgba(68,131,97,0.04)' : 'transparent',
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <Home size={14} style={{ color: isActive ? 'var(--notion-green)' : 'var(--notion-text-secondary)' }} />
                                                            <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--notion-text)' }}>
                                                                Room {booking.room?.number || booking.roomId}
                                                            </span>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span style={{
                                                                fontSize: '12px', padding: '2px 8px', borderRadius: '99px', fontWeight: '500',
                                                                backgroundColor: isActive ? 'var(--notion-green-bg)' : booking.status === 'CANCELLED' ? 'var(--notion-red-bg)' : 'var(--notion-bg-secondary)',
                                                                color: isActive ? 'var(--notion-green)' : booking.status === 'CANCELLED' ? 'var(--notion-red)' : 'var(--notion-text-secondary)',
                                                            }}>
                                                                {booking.status}
                                                            </span>
                                                            {isActive && (
                                                                <button
                                                                    onClick={() => { setPaymentBookingId(booking.id); setShowPayment(true); }}
                                                                    style={{
                                                                        display: 'flex', alignItems: 'center', gap: '4px',
                                                                        fontSize: '11px', padding: '3px 8px',
                                                                        background: 'none', border: '1px solid var(--notion-border)',
                                                                        borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                                                                        color: 'var(--notion-blue)',
                                                                    }}
                                                                >
                                                                    <DollarSign size={10} /> Pay
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--notion-text-secondary)' }}>
                                                        <span>{format(new Date(booking.checkIn), 'MMM d, yyyy')} – {format(new Date(booking.checkOut), 'MMM d')}</span>
                                                        <span style={{ fontWeight: '600' }}>₹{Number(booking.totalAmount || 0).toLocaleString()}</span>
                                                    </div>
                                                    {/* Orders under this booking */}
                                                    {booking.orders && booking.orders.length > 0 && (
                                                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--notion-divider)' }}>
                                                            <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                                                                Orders ({booking.orders.length})
                                                            </div>
                                                            {booking.orders.slice(0, 3).map((order: any) => (
                                                                <div key={order.id} style={{
                                                                    display: 'flex', justifyContent: 'space-between',
                                                                    fontSize: '12px', padding: '3px 0',
                                                                    color: 'var(--notion-text-secondary)',
                                                                }}>
                                                                    <span>#{order.orderNumber} — {order.items?.length || 0} items</span>
                                                                    <span>₹{Number(order.totalAmount || 0).toLocaleString()}</span>
                                                                </div>
                                                            ))}
                                                            {booking.orders.length > 3 && (
                                                                <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)', marginTop: '2px' }}>
                                                                    +{booking.orders.length - 3} more orders
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'financials' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', animation: 'fadeIn 0.2s ease-out' }}>
                                {/* Financial Stats */}
                                {financials?.stats && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
                                        <div style={{ padding: '16px', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)', textAlign: 'center' }}>
                                            <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Total Invoiced</div>
                                            <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--notion-text)' }}>₹{financials.stats.totalInvoiced.toLocaleString()}</div>
                                        </div>
                                        <div style={{ padding: '16px', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)', textAlign: 'center' }}>
                                            <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Total Paid</div>
                                            <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--notion-green)' }}>₹{financials.stats.totalPaid.toLocaleString()}</div>
                                        </div>
                                        <div style={{ padding: '16px', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)', textAlign: 'center' }}>
                                            <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Balance Due</div>
                                            <div style={{ fontSize: '18px', fontWeight: '700', color: financials.stats.balance > 0 ? 'var(--notion-red)' : 'var(--notion-text)' }}>
                                                ₹{financials.stats.balance.toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Record Payment Button */}
                                {financials?.stats && financials.stats.balance > 0 && (
                                    <button
                                        onClick={() => { setPaymentBookingId(activeBooking?.id || null); setShowPayment(true); }}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                            padding: '10px 16px', fontSize: '13px', fontWeight: '500',
                                            backgroundColor: 'var(--notion-blue)', color: '#fff',
                                            border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                            width: '100%',
                                        }}
                                    >
                                        <CreditCard size={14} /> Record Payment — ₹{financials.stats.balance.toLocaleString()} due
                                    </button>
                                )}

                                {/* Detailed Account - Merged Chronological Transactions */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                                    <h4 style={{ fontSize: '14px', fontWeight: '500', color: 'var(--notion-text)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                                        <FileText size={16} /> Account Transactions
                                    </h4>
                                    {(() => {
                                        const transactions: Array<{ date: Date; type: 'Invoice' | 'Payment'; ref: string; description: string; debit: number; credit: number }> = [];
                                        (financials?.invoices || []).forEach((inv: any) => {
                                            transactions.push({
                                                date: new Date(inv.createdAt),
                                                type: 'Invoice',
                                                ref: inv.invoiceNumber || '—',
                                                description: inv.status === 'PAID' ? 'Invoice (Paid)' : 'Invoice (Pending)',
                                                debit: Number(inv.grandTotal || 0),
                                                credit: 0
                                            });
                                        });
                                        (financials?.payments || []).forEach((pay: any) => {
                                            transactions.push({
                                                date: new Date(pay.createdAt),
                                                type: 'Payment',
                                                ref: pay.receiptNumber || '—',
                                                description: `Payment (${pay.paymentMethod || 'Cash'})`,
                                                debit: 0,
                                                credit: Number(pay.amount || 0)
                                            });
                                        });
                                        transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

                                        if (transactions.length === 0) {
                                            return <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', padding: '16px', textAlign: 'center', border: '1px dashed var(--notion-border)', borderRadius: 'var(--radius-lg)' }}>No transactions found.</p>;
                                        }

                                        let runningBalance = 0;
                                        const rows = transactions.map((txn, idx) => {
                                            runningBalance += txn.debit - txn.credit;
                                            return { ...txn, balance: runningBalance, idx };
                                        });

                                        return (
                                            <div style={{ border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                                                <table style={{ width: '100%', textAlign: 'left', fontSize: '13px', borderCollapse: 'collapse' }}>
                                                    <thead style={{ backgroundColor: 'var(--notion-bg-secondary)', borderBottom: '1px solid var(--notion-border)', color: 'var(--notion-text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>
                                                        <tr>
                                                            <th style={{ padding: '10px 12px' }}>Date</th>
                                                            <th style={{ padding: '10px 12px' }}>Type</th>
                                                            <th style={{ padding: '10px 12px' }}>Ref #</th>
                                                            <th style={{ padding: '10px 12px' }}>Description</th>
                                                            <th style={{ padding: '10px 12px', textAlign: 'right' }}>Debit (₹)</th>
                                                            <th style={{ padding: '10px 12px', textAlign: 'right' }}>Credit (₹)</th>
                                                            <th style={{ padding: '10px 12px', textAlign: 'right' }}>Balance (₹)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {rows.map(row => (
                                                            <tr key={`${row.type}-${row.idx}`} style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                                                <td style={{ padding: '10px 12px', color: 'var(--notion-text-secondary)' }}>{format(row.date, 'MMM d, yyyy')}</td>
                                                                <td style={{ padding: '10px 12px' }}>
                                                                    <span style={{
                                                                        fontSize: '11px', padding: '2px 8px', borderRadius: '99px', fontWeight: '500',
                                                                        backgroundColor: row.type === 'Invoice' ? 'var(--notion-blue-bg)' : 'var(--notion-green-bg)',
                                                                        color: row.type === 'Invoice' ? 'var(--notion-blue)' : 'var(--notion-green)'
                                                                    }}>
                                                                        {row.type}
                                                                    </span>
                                                                </td>
                                                                <td style={{ padding: '10px 12px', fontWeight: '500', color: 'var(--notion-text)' }}>{row.ref}</td>
                                                                <td style={{ padding: '10px 12px', color: 'var(--notion-text-secondary)' }}>{row.description}</td>
                                                                <td style={{ padding: '10px 12px', textAlign: 'right', color: row.debit > 0 ? 'var(--notion-red)' : 'var(--notion-text-secondary)' }}>
                                                                    {row.debit > 0 ? `₹${row.debit.toLocaleString()}` : '—'}
                                                                </td>
                                                                <td style={{ padding: '10px 12px', textAlign: 'right', color: row.credit > 0 ? 'var(--notion-green)' : 'var(--notion-text-secondary)' }}>
                                                                    {row.credit > 0 ? `₹${row.credit.toLocaleString()}` : '—'}
                                                                </td>
                                                                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', color: row.balance > 0 ? 'var(--notion-red)' : 'var(--notion-green)' }}>
                                                                    ₹{row.balance.toLocaleString()}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tfoot style={{ backgroundColor: 'var(--notion-bg-secondary)', borderTop: '2px solid var(--notion-border)' }}>
                                                        <tr>
                                                            <td colSpan={4} style={{ padding: '10px 12px', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', color: 'var(--notion-text-secondary)' }}>Totals</td>
                                                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: 'var(--notion-red)' }}>₹{(financials?.stats.totalInvoiced || 0).toLocaleString()}</td>
                                                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: 'var(--notion-green)' }}>₹{(financials?.stats.totalPaid || 0).toLocaleString()}</td>
                                                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: (financials?.stats.balance || 0) > 0 ? 'var(--notion-red)' : 'var(--notion-green)' }}>₹{(financials?.stats.balance || 0).toLocaleString()}</td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            <div style={{ marginTop: 'var(--space-6)', display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="secondary" onClick={onClose}>Close</Button>
            </div>

            {/* Record Payment Modal */}
            <RecordPaymentModal
                isOpen={showPayment}
                onClose={() => setShowPayment(false)}
                onSuccess={() => fetchData()}
                context={paymentBookingId ? {
                    bookingId: paymentBookingId,
                    guestName: details?.fullName,
                    totalDue: financials?.stats.balance || 0,
                    label: `Guest: ${details?.fullName || 'Unknown'}`,
                } : {
                    guestName: details?.fullName,
                    totalDue: financials?.stats.balance || 0,
                    label: `Guest: ${details?.fullName || 'Unknown'}`,
                }}
            />
        </Modal>
    );
}
