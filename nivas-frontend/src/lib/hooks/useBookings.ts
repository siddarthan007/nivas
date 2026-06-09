import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import type { Booking } from '@/lib/types/api.types';

function getErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof ApiError) return err.message;
    if (err instanceof Error) return err.message;
    return fallback;
}

export type BookingSegment = 'all' | 'arrivals' | 'reservations' | 'inhouse' | 'departures';

export interface BookingFilters {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    segment?: BookingSegment;
    search?: string;
}

export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export function useBookings() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, limit: 20, total: 0, totalPages: 1 });

    const fetchBookings = useCallback(async (filters: BookingFilters = {}) => {
        setIsLoading(true);
        try {
            const queryParams = new URLSearchParams();
            if (filters.page) queryParams.append('page', filters.page.toString());
            queryParams.append('limit', (filters.limit || 20).toString());
            if (filters.startDate) queryParams.append('startDate', filters.startDate);
            if (filters.endDate) queryParams.append('endDate', filters.endDate);
            if (filters.segment && filters.segment !== 'all') queryParams.append('segment', filters.segment);
            if (filters.search && filters.search.trim()) queryParams.append('search', filters.search.trim());

            const response = await api.get<Booking[]>(`/bookings?${queryParams.toString()}`);
            if (response.data) {
                setBookings(response.data);
            }
            if (response.meta) {
                setPagination(response.meta);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch bookings');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createBooking = async (data: any) => {
        setIsLoading(true);
        try {
            await api.post('/bookings', data);
            await fetchBookings();
        } catch (err: unknown) {
            const msg = getErrorMessage(err, 'Failed to create booking');
            setError(msg);
            toast.error(msg);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const checkIn = async (bookingId: string) => {
        setIsLoading(true);
        try {
            const res = await api.patch<{ booking: Booking, guestPin: string }>(`/bookings/${bookingId}/check-in`);
            await fetchBookings();
            toast.success(`Check-in successful! Guest PIN: ${res.data?.guestPin}`);
            return { success: true, guestPin: res.data?.guestPin || '' };
        } catch (err: unknown) {
            const msg = getErrorMessage(err, 'Failed to check in');
            setError(msg);
            toast.error(msg);
            return { success: false, guestPin: '' };
        } finally {
            setIsLoading(false);
        }
    };

    const checkOut = async (bookingId: string) => {
        setIsLoading(true);
        try {
            await api.patch(`/bookings/${bookingId}/check-out`);
            await fetchBookings();
            toast.success('Check-out successful');
        } catch (err: unknown) {
            const msg = getErrorMessage(err, 'Failed to check out');
            setError(msg);
            toast.error(msg);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const getCheckoutPreview = async (bookingId: string): Promise<any> => {
        try {
            const res = await api.get<any>(`/bookings/${bookingId}/checkout-preview`);
            return res.data;
        } catch (err: unknown) {
            const msg = getErrorMessage(err, 'Failed to load checkout preview');
            toast.error(msg);
            throw err;
        }
    };

    const processCheckout = async (bookingId: string, data: {
        payments: { method: string; amount: number; transactionId?: string; notes?: string }[];
        discount?: number;
        guestPan?: string;
        payLater?: boolean;
        creditReason?: string;
    }): Promise<any> => {
        setIsLoading(true);
        try {
            const res = await api.post(`/bookings/${bookingId}/checkout`, data);
            await fetchBookings();
            toast.success('Checkout completed successfully');
            return res.data;
        } catch (err: unknown) {
            const msg = getErrorMessage(err, 'Checkout failed');
            setError(msg);
            toast.error(msg);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const updateBooking = async (bookingId: string, data: any) => {
        setIsLoading(true);
        try {
            await api.patch(`/bookings/${bookingId}`, data);
            await fetchBookings();
            toast.success('Booking updated successfully');
        } catch (err: unknown) {
            const msg = getErrorMessage(err, 'Failed to update booking');
            toast.error(msg);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const cancelBooking = async (bookingId: string, reason?: string, cancellationFee?: number) => {
        setIsLoading(true);
        try {
            await api.post(`/bookings/${bookingId}/cancel`, { reason, cancellationFee });
            await fetchBookings();
            toast.success('Booking cancelled successfully');
        } catch (err: unknown) {
            const msg = getErrorMessage(err, 'Failed to cancel booking');
            toast.error(msg);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const extendStay = async (bookingId: string, newCheckOut: string, newTotalAmount?: number) => {
        setIsLoading(true);
        try {
            await api.patch(`/bookings/${bookingId}/extend`, { newCheckOut, newTotalAmount });
            await fetchBookings();
            toast.success('Stay extended successfully');
        } catch (err: unknown) {
            const msg = getErrorMessage(err, 'Failed to extend stay');
            toast.error(msg);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const changeRoom = async (bookingId: string, newRoomId: number) => {
        setIsLoading(true);
        try {
            await api.patch(`/bookings/${bookingId}/change-room`, { newRoomId });
            await fetchBookings();
            toast.success('Room changed successfully');
        } catch (err: unknown) {
            const msg = getErrorMessage(err, 'Failed to change room');
            toast.error(msg);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const updateBookingDates = async (bookingId: string, checkIn: string, checkOut: string, roomId?: number) => {
        return updateBooking(bookingId, { checkIn, checkOut, ...(roomId ? { roomId } : {}) });
    };

    return {
        bookings,
        isLoading,
        error,
        pagination,
        fetchBookings,
        createBooking,
        checkIn,
        checkOut,
        getCheckoutPreview,
        processCheckout,
        updateBooking,
        updateBookingDates,
        cancelBooking,
        extendStay,
        changeRoom
    };
}

