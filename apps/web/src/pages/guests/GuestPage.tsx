'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import CustomDatePicker from '@/components/ui/DatePicker';
import DateField from '@/components/ui/DateField';
import { useDebounce } from '@/lib/hooks/useDebounce';
import {
    GuestService,
    type GuestSearchResult,
    type GuestDetails,
    type GuestFilters,
    type GuestFinancials,
    type CustomerType
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
    Banknote,
    Home,
    Trash2,
    Eye,
    Receipt,
    Hash,
    Download,
} from 'lucide-react';
import { useRouter, useSearchParams } from '@/lib/router';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { exportObjectsToCsv } from '@/lib/utils/export';
import { useTableSort } from '@/lib/hooks/useTableSort';
import SortableTh from '@/components/ui/SortableTh';
import Pagination from '@/components/ui/Pagination';
import NationalitySelect from '@/components/features/guests/NationalitySelect';
import RecordPaymentModal from '@/components/features/finance/RecordPaymentModal';
import SecurityConfirmModal from '@/components/modals/SecurityConfirmModal';
import { useModuleConfig } from '@/lib/hooks/useModuleConfig';

import CustomersHubTabs from '@/components/features/customers/CustomersHubTabs';
import CorporatePage from '@/pages/corporate/CorporatePage';

function getGuestDisplayName(guest: GuestSearchResult | GuestDetails | null | undefined): string {
    if (!guest) return 'Unknown Guest';
    const name = guest.fullName?.trim();
    if (name) return name;
    if (guest.uniqueId?.trim()) return `Guest #${guest.uniqueId.trim()}`;
    if (guest.phone?.trim()) return guest.phone.trim();
    if (guest.email?.trim()) return guest.email.trim();
    if (guest.idNumber?.trim()) return `ID: ${guest.idNumber.trim()}`;
    return 'Unknown Guest';
}

function getGuestInitial(guest: GuestSearchResult | GuestDetails | null | undefined): string {
    const name = getGuestDisplayName(guest);
    if (name === 'Unknown Guest') return '?';
    return name.charAt(0).toUpperCase();
}

function getGuestSubtitle(guest: GuestSearchResult | GuestDetails | null | undefined): string | null {
    if (!guest) return null;
    const name = guest.fullName?.trim();
    if (name) return null;
    if (guest.uniqueId?.trim()) return `Unique ID: ${guest.uniqueId.trim()}`;
    if (guest.phone?.trim()) return `Phone: ${guest.phone.trim()}`;
    if (guest.email?.trim()) return `Email: ${guest.email.trim()}`;
    if (guest.idNumber?.trim()) return `ID: ${guest.idNumber.trim()}`;
    return null;
}

export default function GuestPage() {
    const searchParams = useSearchParams();
    const hubTab = searchParams.get('tab') || 'customers';

    if (hubTab === 'corporate' || hubTab === 'agents') {
        return (
                            <div style={{ padding: 'var(--space-8)' }}>
                    <CustomersHubTabs activeTab={hubTab} />
                    <CorporatePage
                        embedded
                        initialTab={hubTab === 'agents' ? 'agents' : 'companies'}
                    />
                </div>
        );
    }

    return <CustomersListPage />;
}

function CustomersListPage() {
    const router = useRouter();
    const [guests, setGuests] = useState<GuestSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState<GuestFilters>({});
    const [showFilters, setShowFilters] = useState(false);

    const debouncedSearch = useDebounce(searchQuery, 300);

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

    const { config } = useModuleConfig();
    const isHotelEnabled = config.enableHotel;
    const isFbEnabled = config.enableFoodAndBeverage;
    const isMixed = isHotelEnabled && isFbEnabled;
    const isRestaurantOnly = !isHotelEnabled && isFbEnabled;

    const clearFilters = () => {
        setFilters({});
        setSearchQuery('');
    };

    const { sorted: sortedGuests, sortField, sortDir, toggleSort } = useTableSort(guests, undefined, 'asc');

    const handleExport = () => {
        if (guests.length === 0) {
            toast.error('No customers to export');
            return;
        }
        exportObjectsToCsv('customers.csv', [
            { header: 'Unique ID', value: g => g.uniqueId || '' },
            { header: 'Name', value: g => g.fullName },
            { header: 'Phone', value: g => g.phone || '' },
            { header: 'Email', value: g => g.email || '' },
            { header: 'PAN', value: g => g.panNumber || '' },
            { header: 'Type', value: g => g.customerType },
            { header: 'VIP', value: g => (g.isVip ? 'Yes' : 'No') },
            { header: 'Banned', value: g => (g.isBanned ? 'Yes' : 'No') },
        ], guests);
        toast.success(`Exported ${guests.length} customers`);
    };

    return (
                    <div style={{ padding: 'var(--space-8)' }}>
                <CustomersHubTabs activeTab="customers" />
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                    <div>
                        <h1 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: '24px', fontWeight: '600', color: 'var(--notion-text)' }}>
                            <Users size={28} />
                            {isRestaurantOnly ? 'Customer Management' : 'Customer & Guest Management'}
                        </h1>
                        <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', marginTop: '4px' }}>
                            {isRestaurantOnly ? 'Search, view, and manage customer profiles' : 'Search, view, and manage hotel guests and restaurant customers'}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                        <Button variant="secondary" onClick={() => fetchGuests()} disabled={loading}>
                            <RefreshCw size={14} style={{ marginRight: '8px' }} /> Refresh
                        </Button>
                        <Button variant="secondary" onClick={handleExport} disabled={loading}>
                            <Download size={14} style={{ marginRight: '8px' }} /> Export
                        </Button>
                        <Button onClick={() => router.push('/hotel/guests/new')} variant="primary">
                            <Plus size={14} style={{ marginRight: '8px' }} /> {isRestaurantOnly ? 'Add Customer' : 'Add Customer / Guest'}
                        </Button>
                    </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                    <div style={{ padding: 'var(--space-4)', background: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total</div>
                        <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--notion-blue)', marginTop: '4px' }}>{guests.length}</div>
                    </div>
                    <div style={{ padding: 'var(--space-4)', background: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>VIP</div>
                        <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--notion-yellow)', marginTop: '4px' }}>{guests.filter(g => g.isVip).length}</div>
                    </div>
                    <div style={{ padding: 'var(--space-4)', background: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Hotel Guests</div>
                        <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--notion-green)', marginTop: '4px' }}>{guests.filter(g => g.customerType === 'HOTEL_GUEST' || g.customerType === 'BOTH').length}</div>
                    </div>
                    <div style={{ padding: 'var(--space-4)', background: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Restaurant</div>
                        <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--notion-orange)', marginTop: '4px' }}>{guests.filter(g => g.customerType === 'RESTAURANT_CUSTOMER').length}</div>
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
                        <Select
                            label="Customer Type"
                            value={filters.customerType || ''}
                            onChange={e => setFilters(prev => ({ ...prev, customerType: (e.target.value as CustomerType) || undefined }))}
                            fullWidth
                            options={[
                                { value: '', label: 'All Types' },
                                { value: 'HOTEL_GUEST', label: 'Hotel Guest' },
                                { value: 'RESTAURANT_CUSTOMER', label: 'Restaurant Customer' },
                                { value: 'BOTH', label: 'Both' },
                            ]}
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
                                    <SortableTh field="uniqueId" label="Unique ID" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                                    <SortableTh field="fullName" label="Name" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500' }}>Contact</th>
                                    <SortableTh field="panNumber" label="PAN" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                                    <SortableTh field="vatNumber" label="VAT" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                                    <SortableTh field="customerType" label="Type" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500' }}>Status</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody style={{ borderTop: '1px solid var(--notion-border)' }}>
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                                                <Loader2 className="animate-spin" size={20} /> Loading...
                                            </div>
                                        </td>
                                    </tr>
                                ) : guests.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>
                                            No customers found matching your criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    sortedGuests.map(guest => (
                                        <tr key={guest.id} style={{ borderBottom: '1px solid var(--notion-border)', cursor: 'pointer' }} onClick={() => router.push(`/hotel/guests/${guest.id}`)}>
                                            <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                                                {guest.uniqueId || '—'}
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{
                                                        width: '32px', height: '32px', borderRadius: '50%',
                                                        backgroundColor: 'var(--notion-bg-tertiary)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '12px', fontWeight: '600', color: 'var(--notion-text-secondary)'
                                                    }}>
                                                        {getGuestInitial(guest)}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: '500', color: 'var(--notion-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            {getGuestDisplayName(guest)}
                                                            {guest.isVip && <Star size={12} style={{ color: 'var(--notion-yellow)', fill: 'var(--notion-yellow)' }} />}
                                                        </div>
                                                        {getGuestSubtitle(guest) && (
                                                            <div style={{ fontSize: '11px', color: 'var(--notion-text-muted)', marginTop: '2px' }}>{getGuestSubtitle(guest)}</div>
                                                        )}
                                                        {guest.notes && guest.fullName?.trim() && <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', marginTop: '2px', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{guest.notes}</div>}
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
                                            <td style={{ padding: '12px 16px', color: 'var(--notion-text-secondary)', fontSize: '13px' }}>
                                                {guest.panNumber || '—'}
                                            </td>
                                            <td style={{ padding: '12px 16px', color: 'var(--notion-text-secondary)', fontSize: '13px' }}>
                                                {guest.vatNumber || '—'}
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <span style={{
                                                    display: 'inline-flex', padding: '2px 8px', borderRadius: '4px',
                                                    fontSize: '11px', fontWeight: '500',
                                                    backgroundColor: guest.customerType === 'RESTAURANT_CUSTOMER' ? 'var(--notion-orange-bg)' : guest.customerType === 'BOTH' ? 'var(--notion-purple-bg)' : 'var(--notion-blue-bg)',
                                                    color: guest.customerType === 'RESTAURANT_CUSTOMER' ? 'var(--notion-orange)' : guest.customerType === 'BOTH' ? 'var(--notion-purple)' : 'var(--notion-blue)'
                                                }}>
                                                    {guest.customerType === 'RESTAURANT_CUSTOMER' ? 'Restaurant' : guest.customerType === 'BOTH' ? 'Both' : 'Hotel Guest'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                {guest.isBanned ? (
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                        padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '500',
                                                        backgroundColor: 'var(--notion-red-bg)', color: 'var(--notion-red)'
                                                    }}>
                                                        <Ban size={10} /> Banned
                                                    </span>
                                                ) : guest.isVip ? (
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                        padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '500',
                                                        backgroundColor: 'var(--notion-yellow-bg)', color: 'var(--notion-yellow)'
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
                                                <div style={{ display: 'flex', gap: '6px' }} onClick={(e: any) => e.stopPropagation()}>
                                                    <Button size="sm" variant="secondary" onClick={() => router.push(`/hotel/guests/${guest.id}`)}>
                                                        <Eye size={14} style={{ marginRight: '4px' }} /> View
                                                    </Button>
                                                    <Button size="sm" variant="secondary" onClick={() => window.open(`/hotel/finance?tab=customer-ledger&guestId=${encodeURIComponent(guest.id)}`, '_blank')}>
                                                        <Receipt size={14} style={{ marginRight: '4px' }} /> Ledger
                                                    </Button>
                                                    <Button size="sm" variant="secondary" onClick={() => setSelectedGuestId(guest.id)}>
                                                        <Edit3 size={14} style={{ marginRight: '4px' }} /> Edit
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
                            toast.success(`Guest "${getGuestDisplayName(deleteTarget)}" deleted`);
                            fetchGuests();
                        } catch (err: any) {
                            toast.error(err.message || 'Failed to delete guest');
                        }
                    }}
                    title="Delete Guest"
                    message={`Are you sure you want to delete "${getGuestDisplayName(deleteTarget)}"? This action cannot be undone.`}
                    confirmText="Delete Guest"
                    isDestructive
                />
            </div>
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
                    firstName: detailsData.firstName || '',
                    lastName: detailsData.lastName || '',
                    fullName: detailsData.fullName || '',
                    uniqueId: detailsData.uniqueId || '',
                    phone: detailsData.phone || '',
                    email: detailsData.email || '',
                    fatherName: detailsData.fatherName || '',
                    dob: detailsData.dob || '',
                    occupation: detailsData.occupation || '',
                    nationality: detailsData.nationality || '',
                    city: detailsData.city || '',
                    country: detailsData.country || '',
                    idType: detailsData.idType || '',
                    idNumber: detailsData.idNumber || '',
                    panNumber: detailsData.panNumber || '',
                    vatNumber: detailsData.vatNumber || '',
                    openingDueAmount: detailsData.openingDueAmount || '',
                    customerType: detailsData.customerType || 'HOTEL_GUEST',
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
                            {getGuestInitial(details)}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--notion-text)', margin: 0 }}>{getGuestDisplayName(details)}</h2>
                                {details.isVip && <span style={{ fontSize: '11px', backgroundColor: 'var(--notion-yellow-bg)', color: 'var(--notion-yellow)', padding: '2px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><Star size={10} /> VIP</span>}
                                {details.isBanned && <span style={{ fontSize: '11px', backgroundColor: 'var(--notion-red-bg)', color: 'var(--notion-red)', padding: '2px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><Ban size={10} /> Banned</span>}
                            </div>
                            {getGuestSubtitle(details) && <div style={{ fontSize: '12px', color: 'var(--notion-text-muted)', marginTop: '2px' }}>{getGuestSubtitle(details)}</div>}
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
                                        cursor: 'pointer', color: 'var(--foreground-inverse)',
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
                            padding: '10px 14px', backgroundColor: 'var(--notion-green-bg)',
                            border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)',
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
                                {tab === 'history' ? 'Bookings & Orders' : tab === 'financials' ? 'Customer Folio' : 'Profile'}
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
                                                <label style={labelStyle}>First Name</label>
                                                <Input value={editForm.firstName} onChange={(e: any) => setEditForm({ ...editForm, firstName: e.target.value, fullName: `${e.target.value} ${editForm.lastName}`.trim() })} />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Last Name</label>
                                                <Input value={editForm.lastName} onChange={(e: any) => setEditForm({ ...editForm, lastName: e.target.value, fullName: `${editForm.firstName} ${e.target.value}`.trim() })} />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Unique ID</label>
                                                <Input value={editForm.uniqueId} onChange={(e: any) => setEditForm({ ...editForm, uniqueId: e.target.value })} />
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
                                                <label style={labelStyle}>Father Name</label>
                                                <Input value={editForm.fatherName} onChange={(e: any) => setEditForm({ ...editForm, fatherName: e.target.value })} />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>DOB</label>
                                                <DateField value={editForm.dob} onChange={(v) => setEditForm({ ...editForm, dob: v })} />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Occupation</label>
                                                <Input value={editForm.occupation} onChange={(e: any) => setEditForm({ ...editForm, occupation: e.target.value })} />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Nationality</label>
                                                <Input value={editForm.nationality} onChange={(e: any) => setEditForm({ ...editForm, nationality: e.target.value })} />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>City</label>
                                                <Input value={editForm.city} onChange={(e: any) => setEditForm({ ...editForm, city: e.target.value })} />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Country</label>
                                                <Input value={editForm.country} onChange={(e: any) => setEditForm({ ...editForm, country: e.target.value })} />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>ID Type</label>
                                                <select
                                                    value={editForm.idType || ''}
                                                    onChange={(e: any) => setEditForm({ ...editForm, idType: e.target.value })}
                                                    style={{
                                                        width: '100%', padding: '8px', backgroundColor: 'var(--notion-bg)',
                                                        border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)',
                                                        fontSize: '14px', outline: 'none', color: 'var(--notion-text)'
                                                    }}
                                                >
                                                    <option value="">Select ID Type</option>
                                                    <option value="Citizenship">Citizenship</option>
                                                    <option value="Passport">Passport</option>
                                                    <option value="Voter ID">Voter ID</option>
                                                    <option value="National ID">National ID</option>
                                                    <option value="Driver's License">Driver's License</option>
                                                    <option value="Aadhar Card">Aadhar Card</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label style={labelStyle}>ID Number</label>
                                                <Input value={editForm.idNumber} onChange={(e: any) => setEditForm({ ...editForm, idNumber: e.target.value })} />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>PAN Number</label>
                                                <Input value={editForm.panNumber} onChange={(e: any) => setEditForm({ ...editForm, panNumber: e.target.value })} />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>VAT Number</label>
                                                <Input value={editForm.vatNumber} onChange={(e: any) => setEditForm({ ...editForm, vatNumber: e.target.value })} />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Opening Due</label>
                                                <Input value={editForm.openingDueAmount} onChange={(e: any) => setEditForm({ ...editForm, openingDueAmount: e.target.value })} />
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
                                            <Button onClick={handleSave} disabled={isSaving || !editForm.firstName?.trim() || !editForm.lastName?.trim()}>
                                                <Save size={14} style={{ marginRight: '4px' }} />
                                                {isSaving ? 'Saving...' : 'Save Changes'}
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    /* View Mode */
                                    <>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <label style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>Email</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--notion-text)' }}>
                                                    <span style={{ color: 'var(--notion-text-muted)' }}><Mail size={14} /></span>
                                                    {details.email || '—'}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <label style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>Phone</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--notion-text)' }}>
                                                    <span style={{ color: 'var(--notion-text-muted)' }}><Phone size={14} /></span>
                                                    {details.phone || '—'}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <label style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>Nationality</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--notion-text)' }}>
                                                    <span style={{ color: 'var(--notion-text-muted)' }}><Globe size={14} /></span>
                                                    {details.nationality || '—'}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <label style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>ID</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--notion-text)' }}>
                                                    <span style={{ color: 'var(--notion-text-muted)' }}><Shield size={14} /></span>
                                                    {details.idType ? `${details.idType}: ${details.idNumber}` : '—'}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <label style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>PAN</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--notion-text)' }}>
                                                    <span style={{ color: 'var(--notion-text-muted)' }}><Shield size={14} /></span>
                                                    {details.panNumber || '—'}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <label style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>VAT</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--notion-text)' }}>
                                                    <span style={{ color: 'var(--notion-text-muted)' }}><Shield size={14} /></span>
                                                    {details.vatNumber || '—'}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <label style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>Unique ID</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--notion-text)' }}>
                                                    <span style={{ color: 'var(--notion-text-muted)' }}><Shield size={14} /></span>
                                                    {details.uniqueId || '—'}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <label style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>Address</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--notion-text)' }}>
                                                    <span style={{ color: 'var(--notion-text-muted)' }}><MapPin size={14} /></span>
                                                    {details.address || '—'}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <label style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>Member Since</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--notion-text)' }}>
                                                    <span style={{ color: 'var(--notion-text-muted)' }}><Calendar size={14} /></span>
                                                    {details.createdAt ? format(new Date(details.createdAt), 'MMM d, yyyy') : '—'}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Stats summary */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                                            <div style={{ padding: '12px', backgroundColor: 'var(--notion-bg-tertiary)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                                <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--notion-text)' }}>{details.bookings?.length || 0}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase' }}>Stays</div>
                                            </div>
                                            <div style={{ padding: '12px', backgroundColor: 'var(--notion-bg-tertiary)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                                <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--notion-text)' }}>{details.orders?.length || 0}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase' }}>Orders</div>
                                            </div>
                                            <div style={{ padding: '12px', backgroundColor: 'var(--notion-bg-tertiary)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                                <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--notion-text)' }}>NPR {(financials?.stats.totalInvoiced || 0).toLocaleString()}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase' }}>Total Spend</div>
                                            </div>
                                            <div style={{ padding: '12px', backgroundColor: 'var(--notion-bg-tertiary)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                                <div style={{ fontSize: '20px', fontWeight: '700', color: (financials?.stats.balance || 0) > 0 ? 'var(--notion-red)' : 'var(--notion-green)' }}>
                                                    NPR {(financials?.stats.balance || 0).toLocaleString()}
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
                                                    border: `1px solid ${isActive ? 'var(--notion-border)' : 'var(--notion-border)'}`,
                                                    borderRadius: 'var(--radius-md)', padding: '12px',
                                                    backgroundColor: isActive ? 'var(--notion-green-bg)' : 'transparent',
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
                                                        <span style={{ fontWeight: '600' }}>NPR {Number(booking.totalAmount || 0).toLocaleString()}</span>
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
                                                                    <span>NPR {Number(order.totalAmount || 0).toLocaleString()}</span>
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

                        {activeTab === 'history' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
                                <h4 style={{ fontSize: '14px', fontWeight: '500', color: 'var(--notion-text)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                                    <Calendar size={16} /> Direct Orders ({details.orders?.length || 0})
                                </h4>
                                {(!details.orders || details.orders.length === 0) ? (
                                    <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', padding: '16px', textAlign: 'center', border: '1px dashed var(--notion-border)', borderRadius: 'var(--radius-lg)' }}>
                                        No direct orders found.
                                    </p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                        {details.orders.map((order: any) => (
                                            <div key={order.id} style={{
                                                border: '1px solid var(--notion-border)',
                                                borderRadius: 'var(--radius-md)', padding: '12px',
                                                backgroundColor: 'transparent',
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--notion-text)' }}>
                                                            #{order.orderNumber} — {order.orderType?.replace('_', ' ')}
                                                        </span>
                                                    </div>
                                                    <span style={{
                                                        fontSize: '12px', padding: '2px 8px', borderRadius: '99px', fontWeight: '500',
                                                        backgroundColor: 'var(--notion-bg-secondary)',
                                                        color: 'var(--notion-text-secondary)',
                                                    }}>
                                                        {order.status}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--notion-text-secondary)' }}>
                                                    <span>{order.createdAt ? format(new Date(order.createdAt), 'MMM d, yyyy h:mm a') : ''}</span>
                                                    <span style={{ fontWeight: '600' }}>NPR {Number(order.totalAmount || 0).toLocaleString()}</span>
                                                </div>
                                                {order.items && order.items.length > 0 && (
                                                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--notion-divider)' }}>
                                                        {order.items.slice(0, 3).map((item: any) => (
                                                            <div key={item.id} style={{
                                                                display: 'flex', justifyContent: 'space-between',
                                                                fontSize: '12px', padding: '3px 0',
                                                                color: 'var(--notion-text-secondary)',
                                                            }}>
                                                                <span>{item.quantity}× {item.menuItem?.name || 'Item'}</span>
                                                                <span>NPR {Number(item.quantity * (item.price || 0)).toLocaleString()}</span>
                                                            </div>
                                                        ))}
                                                        {order.items.length > 3 && (
                                                            <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)', marginTop: '2px' }}>
                                                                +{order.items.length - 3} more items
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
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
                                            <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Total Charges</div>
                                            <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--notion-text)' }}>NPR {financials.stats.totalInvoiced.toLocaleString()}</div>
                                        </div>
                                        <div style={{ padding: '16px', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)', textAlign: 'center' }}>
                                            <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Total Paid</div>
                                            <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--notion-green)' }}>NPR {financials.stats.totalPaid.toLocaleString()}</div>
                                        </div>
                                        <div style={{ padding: '16px', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)', textAlign: 'center' }}>
                                            <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Net Balance</div>
                                            <div style={{ fontSize: '18px', fontWeight: '700', color: financials.stats.balance > 0 ? 'var(--notion-red)' : financials.stats.balance < 0 ? 'var(--notion-green)' : 'var(--notion-text)' }}>
                                                {financials.stats.balance < 0 ? '−' : ''}NPR {Math.abs(financials.stats.balance).toLocaleString()}
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
                                            backgroundColor: 'var(--notion-blue)', color: 'var(--foreground-inverse)',
                                            border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                            width: '100%',
                                        }}
                                    >
                                        <CreditCard size={14} /> Record Payment — NPR {financials.stats.balance.toLocaleString()} due
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
                                                            <th style={{ padding: '10px 12px', textAlign: 'right' }}>Debit (NPR )</th>
                                                            <th style={{ padding: '10px 12px', textAlign: 'right' }}>Credit (NPR )</th>
                                                            <th style={{ padding: '10px 12px', textAlign: 'right' }}>Balance (NPR )</th>
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
                                                                    {row.debit > 0 ? `NPR ${row.debit.toLocaleString()}` : '—'}
                                                                </td>
                                                                <td style={{ padding: '10px 12px', textAlign: 'right', color: row.credit > 0 ? 'var(--notion-green)' : 'var(--notion-text-secondary)' }}>
                                                                    {row.credit > 0 ? `NPR ${row.credit.toLocaleString()}` : '—'}
                                                                </td>
                                                                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', color: row.balance > 0 ? 'var(--notion-red)' : 'var(--notion-green)' }}>
                                                                    NPR {row.balance.toLocaleString()}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tfoot style={{ backgroundColor: 'var(--notion-bg-secondary)', borderTop: '2px solid var(--notion-border)' }}>
                                                        <tr>
                                                            <td colSpan={4} style={{ padding: '10px 12px', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', color: 'var(--notion-text-secondary)' }}>Totals</td>
                                                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: 'var(--notion-red)' }}>NPR {(financials?.stats.totalInvoiced || 0).toLocaleString()}</td>
                                                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: 'var(--notion-green)' }}>NPR {(financials?.stats.totalPaid || 0).toLocaleString()}</td>
                                                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: (financials?.stats.balance || 0) > 0 ? 'var(--notion-red)' : 'var(--notion-green)' }}>NPR {(financials?.stats.balance || 0).toLocaleString()}</td>
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
                    guestName: getGuestDisplayName(details),
                    totalDue: financials?.stats.balance || 0,
                    label: `Guest: ${getGuestDisplayName(details)}`,
                } : {
                    guestName: getGuestDisplayName(details),
                    totalDue: financials?.stats.balance || 0,
                    label: `Guest: ${getGuestDisplayName(details)}`,
                }}
            />
        </Modal>
    );
}
