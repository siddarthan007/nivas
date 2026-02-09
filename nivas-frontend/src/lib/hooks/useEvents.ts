import { useState, useCallback } from 'react';
import api from '../api';
import { toast } from 'sonner';

// Types
export interface Venue {
    id: number;
    hotelId: number;
    name: string;
    capacity: number;
    description?: string;
    amenities?: string[];
    isActive: boolean;
    createdAt: string;
}

export interface BanquetBooking {
    id: number;
    banquetId: number;
    eventName: string;
    eventType?: 'WEDDING' | 'CONFERENCE' | 'BIRTHDAY' | 'CORPORATE' | 'OTHER';
    eventDate: string;
    startTime: string;
    endTime: string;
    expectedGuests?: number;
    contactName?: string;
    contactPhone?: string;
    organizerName?: string;
    organizerPhone?: string;
    contactEmail?: string;
    status: 'INQUIRY' | 'TENTATIVE' | 'CONFIRMED' | 'CANCELLED';
    cateringRequired: boolean;
    cateringDetails?: any;
    decorRequired: boolean;
    avEquipment?: string[];
    specialRequirements?: string;
    totalAmount?: number;
    advanceAmount?: number;
    createdAt: string;
    venue?: Venue;
}

export interface CreateVenuePayload {
    name: string;
    capacity: number;
    description?: string;
    amenities?: string[];
}

export interface CreateBookingPayload {
    banquetId: number;
    eventName: string;
    eventType?: 'WEDDING' | 'CONFERENCE' | 'BIRTHDAY' | 'CORPORATE' | 'OTHER';
    eventDate: string;
    startTime: string;
    endTime: string;
    expectedGuests: number;
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    cateringRequired?: boolean;
    cateringPackage?: string;
    cateringPax?: number;
    decorationRequired?: boolean;
    avEquipment?: string[];
    specialRequirements?: string;
    totalAmount?: number;
    advanceAmount?: number;
}

export function useEvents() {
    const [venues, setVenues] = useState<Venue[]>([]);
    const [bookings, setBookings] = useState<BanquetBooking[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Venues
    const fetchVenues = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await api.get<Venue[]>('/banquets/venues');
            setVenues(res.data || []);
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

    // Bookings
    const fetchBookings = useCallback(async (status?: string) => {
        setIsLoading(true);
        try {
            const url = status ? `/banquets/bookings?status=${encodeURIComponent(status)}` : '/banquets/bookings';
            const res = await api.get<BanquetBooking[]>(url);
            setBookings(res.data || []);
        } catch (err: any) {
            toast.error(err?.message || 'Failed to fetch bookings');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const getBooking = async (id: string) => {
        try {
            const res = await api.get<BanquetBooking>(`/banquets/bookings/${id}`);
            return res.data;
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

    const updateBookingStatus = async (id: string, status: 'INQUIRY' | 'TENTATIVE' | 'CONFIRMED' | 'CANCELLED') => {
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

    const updateBooking = async (id: string, data: Partial<CreateBookingPayload & { status?: string }>) => {
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
            const res = await api.get<{ available: boolean }>(`/banquets/venues/${venueId}/availability?${params}`);
            return res.data?.available ?? false;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to check availability');
            return false;
        }
    };

    return {
        // State
        venues,
        bookings,
        isLoading,
        // Venues
        fetchVenues,
        createVenue,
        updateVenue,
        deleteVenue,
        // Bookings
        fetchBookings,
        getBooking,
        createBooking,
        updateBookingStatus,
        updateBooking,
        deleteBooking,
        checkAvailability
    };
}
