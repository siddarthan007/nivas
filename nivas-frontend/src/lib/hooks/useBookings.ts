import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { Booking } from '@/lib/types/api.types';

export interface BookingFilters {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
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

            const response = await api.get<Booking[]>(`/bookings?${queryParams.toString()}`);
            if (response.data) {
                setBookings(response.data);
            }
            if ((response as any).meta) {
                setPagination((response as any).meta);
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
        } catch (err: any) {
            setError(err?.response?.data?.message || err.message || 'Failed to create booking');
            toast.error(err?.response?.data?.message || 'Failed to create booking');
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
        } catch (err: any) {
            const msg = err?.response?.data?.message || err.message || 'Failed to check in';
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
        } catch (err: any) {
            const msg = err?.response?.data?.message || err.message || 'Failed to check out';
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
        } catch (err: any) {
            const msg = err?.response?.data?.message || err.message || 'Failed to update booking';
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
        } catch (err: any) {
            const msg = err?.response?.data?.message || err.message || 'Failed to cancel booking';
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
        } catch (err: any) {
            const msg = err?.response?.data?.message || err.message || 'Failed to extend stay';
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
        } catch (err: any) {
            const msg = err?.response?.data?.message || err.message || 'Failed to change room';
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
        updateBooking,
        updateBookingDates,
        cancelBooking,
        extendStay,
        changeRoom
    };
}
