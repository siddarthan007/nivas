import { useState, useCallback } from 'react';
import api from '../api';
import { toast } from 'sonner';

export interface Venue {
    id: number;
    hotelId: number;
    name: string;
    capacity: number;
    description?: string;
    amenities?: string[];
    baseRateHalf?: string;
    baseRateFull?: string;
    isActive: boolean;
    createdAt: string;
}

export type BanquetBookingStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

export interface BanquetBooking {
    id: string;
    banquetId: number;
    guestId?: string;
    invoiceId?: string;
    eventName: string;
    eventType?: 'WEDDING' | 'CONFERENCE' | 'BIRTHDAY' | 'CORPORATE' | 'OTHER';
    eventDate: string;
    endDate?: string;
    startTime: string;
    endTime: string;
    expectedGuests: number;
    contactName: string;
    contactPhone: string;
    organizerName?: string;
    organizerPhone?: string;
    contactEmail?: string;
    status: BanquetBookingStatus;
    cateringRequired: boolean;
    cateringPackage?: string;
    cateringPax?: number;
    decorationRequired: boolean;
    avEquipment?: string[];
    specialRequirements?: string;
    totalAmount?: number;
    advanceAmount?: number;
    createdAt: string;
    venue?: Venue;
    guest?: { id: string; fullName: string; phone: string } | null;
    invoice?: { id: string; invoiceNumber: string; grandTotal: string } | null;
}

export interface CreateVenuePayload {
    name: string;
    capacity: number;
    description?: string;
    amenities?: string[];
    baseRateHalf?: number;
    baseRateFull?: number;
}

export interface CreateBookingPayload {
    banquetId: number;
    eventName: string;
    eventType?: 'WEDDING' | 'CONFERENCE' | 'BIRTHDAY' | 'CORPORATE' | 'OTHER';
    eventDate: string;
    endDate?: string;
    startTime: string;
    endTime: string;
    expectedGuests: number;
    contactName: string;
    contactPhone: string;
    contactEmail?: string;
    guestId?: string;
    cateringRequired?: boolean;
    cateringPackage?: string;
    cateringPax?: number;
    decorationRequired?: boolean;
    avEquipment?: string[];
    specialRequirements?: string;
    totalAmount?: number;
    advanceAmount?: number;
}

function normalizeVenue(raw: any): Venue {
    return {
        id: Number(raw.id),
        hotelId: Number(raw.hotelId),
        name: raw.name ?? '',
        capacity: Number(raw.capacity ?? 0),
        description: raw.description ?? raw.area ?? undefined,
        amenities: Array.isArray(raw.amenities) ? raw.amenities : [],
        baseRateHalf: raw.baseRateHalf ?? undefined,
        baseRateFull: raw.baseRateFull ?? undefined,
        isActive: raw.isActive ?? true,
        createdAt: raw.createdAt ?? new Date().toISOString(),
    };
}

function normalizeBooking(raw: any): BanquetBooking {
    return {
        id: String(raw.id),
        banquetId: Number(raw.banquetId ?? 0),
        guestId: raw.guestId ?? undefined,
        invoiceId: raw.invoiceId ?? undefined,
        eventName: raw.eventName ?? '',
        eventType: raw.eventType ?? undefined,
        eventDate: raw.eventDate ?? '',
        endDate: raw.endDate ?? undefined,
        startTime: raw.startTime ?? '',
        endTime: raw.endTime ?? '',
        expectedGuests: Number(raw.expectedGuests ?? 0),
        contactName: raw.contactName ?? raw.organizerName ?? '',
        contactPhone: raw.contactPhone ?? raw.organizerPhone ?? '',
        organizerName: raw.organizerName ?? undefined,
        organizerPhone: raw.organizerPhone ?? undefined,
        contactEmail: raw.contactEmail ?? raw.organizerEmail ?? undefined,
        status: (raw.status ?? 'PENDING') as BanquetBookingStatus,
        cateringRequired: Boolean(raw.cateringRequired),
        cateringPackage: raw.cateringPackage ?? undefined,
        cateringPax: raw.cateringPax !== null && raw.cateringPax !== undefined ? Number(raw.cateringPax) : undefined,
        decorationRequired: Boolean(raw.decorationRequired),
        avEquipment: Array.isArray(raw.avEquipment) ? raw.avEquipment : [],
        specialRequirements: raw.specialRequirements ?? undefined,
        totalAmount: raw.totalAmount !== null && raw.totalAmount !== undefined ? Number(raw.totalAmount) : undefined,
        advanceAmount: raw.advanceAmount !== null && raw.advanceAmount !== undefined ? Number(raw.advanceAmount) : undefined,
        createdAt: raw.createdAt ?? new Date().toISOString(),
        venue: raw.banquet ? normalizeVenue(raw.banquet) : undefined,
        guest: raw.guest ? { id: raw.guest.id, fullName: raw.guest.fullName, phone: raw.guest.phone } : undefined,
        invoice: raw.invoice ? { id: raw.invoice.id, invoiceNumber: raw.invoice.invoiceNumber, grandTotal: raw.invoice.grandTotal } : undefined,
    };
}

export function useEvents() {
    const [venues, setVenues] = useState<Venue[]>([]);
    const [bookings, setBookings] = useState<BanquetBooking[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchVenues = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await api.get<any[]>('/banquets/venues');
            setVenues((res.data || []).map(normalizeVenue));
        } catch (err: any) {
            toast.error(err?.message || 'Failed to fetch venues');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createVenue = async (data: CreateVenuePayload) => {
        setIsLoading(true);
        try {
            await api.post('/banquets/venues', data);
            await fetchVenues();
            toast.success('Venue created');
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to create venue');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const updateVenue = async (id: number, data: Partial<CreateVenuePayload & { isActive?: boolean }>) => {
        setIsLoading(true);
        try {
            await api.patch(`/banquets/venues/${id}`, data);
            await fetchVenues();
            toast.success('Venue updated');
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to update venue');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const deleteVenue = async (id: number) => {
        setIsLoading(true);
        try {
            await api.delete(`/banquets/venues/${id}`);
            await fetchVenues();
            toast.success('Venue deleted');
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to delete venue');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const fetchBookings = useCallback(async (status?: string) => {
        setIsLoading(true);
        try {
            const url = status ? `/banquets/bookings?status=${encodeURIComponent(status)}` : '/banquets/bookings';
            const res = await api.get<any[]>(url);
            setBookings((res.data || []).map(normalizeBooking));
        } catch (err: any) {
            toast.error(err?.message || 'Failed to fetch bookings');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const getBooking = async (id: string) => {
        try {
            const res = await api.get<any>(`/banquets/bookings/${id}`);
            return res.data ? normalizeBooking(res.data) : null;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to fetch booking');
            return null;
        }
    };

    const createBooking = async (data: CreateBookingPayload) => {
        setIsLoading(true);
        try {
            await api.post('/banquets/bookings', data);
            await fetchBookings();
            toast.success('Booking created');
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to create booking');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const updateBookingStatus = async (id: string, status: BanquetBookingStatus) => {
        setIsLoading(true);
        try {
            await api.patch(`/banquets/bookings/${id}/status`, { status });
            await fetchBookings();
            toast.success('Booking status updated');
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to update status');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const updateBooking = async (id: string, data: Partial<CreateBookingPayload & { status?: BanquetBookingStatus }>) => {
        setIsLoading(true);
        try {
            await api.patch(`/banquets/bookings/${id}`, data);
            await fetchBookings();
            toast.success('Booking updated');
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to update booking');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const deleteBooking = async (id: string) => {
        setIsLoading(true);
        try {
            await api.delete(`/banquets/bookings/${id}`);
            await fetchBookings();
            toast.success('Booking deleted');
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to delete booking');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const checkAvailability = async (venueId: number, date: string, startTime: string, endTime: string) => {
        try {
            const params = `date=${encodeURIComponent(date)}&startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`;
            const res = await api.get<{ isAvailable: boolean }>(`/banquets/venues/${venueId}/availability?${params}`);
            return res.data?.isAvailable ?? false;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to check availability');
            return false;
        }
    };

    return {
        venues,
        bookings,
        isLoading,
        fetchVenues,
        createVenue,
        updateVenue,
        deleteVenue,
        fetchBookings,
        getBooking,
        createBooking,
        updateBookingStatus,
        updateBooking,
        deleteBooking,
        checkAvailability,
    };
}
