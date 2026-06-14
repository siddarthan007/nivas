import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import type { Booking } from '@/lib/types/api.types';
import type { CheckoutPreview } from '@/components/features/bookings/CheckoutModal';
import { queryKeys } from '@/lib/queries/keys';

function getErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof ApiError) return err.message;
    if (err instanceof Error) return err.message;
    return fallback;
}

export type BookingSegment = 'all' | 'active' | 'arrivals' | 'reservations' | 'inhouse' | 'departures';

export interface BookingFilters {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    segment?: BookingSegment;
    search?: string;
    [key: string]: string | number | undefined;
}

export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

const DEFAULT_FILTERS: BookingFilters = { page: 1, limit: 20 };

async function loadBookings(filters: BookingFilters) {
    const queryParams = new URLSearchParams();
    if (filters.page) queryParams.append('page', filters.page.toString());
    queryParams.append('limit', (filters.limit || 20).toString());
    if (filters.startDate) queryParams.append('startDate', filters.startDate);
    if (filters.endDate) queryParams.append('endDate', filters.endDate);
    if (filters.segment && filters.segment !== 'all') queryParams.append('segment', filters.segment);
    if (filters.search?.trim()) queryParams.append('search', filters.search.trim());

    const response = await api.get<Booking[]>(`/bookings?${queryParams.toString()}`);
    return {
        bookings: response.data ?? [],
        pagination: response.meta ?? { page: filters.page ?? 1, limit: filters.limit ?? 20, total: 0, totalPages: 1 },
    };
}

export function useBookings() {
    const queryClient = useQueryClient();
    const [filters, setFilters] = useState<BookingFilters>(DEFAULT_FILTERS);
    const [mutationLoading, setMutationLoading] = useState(false);

    const { data, isLoading, error } = useQuery({
        queryKey: queryKeys.bookings.list(filters),
        queryFn: () => loadBookings(filters),
    });

    const bookings = data?.bookings ?? [];
    const pagination = data?.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 1 };

    const invalidateBookings = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
    }, [queryClient]);

    const fetchBookings = useCallback((next: BookingFilters = {}) => {
        setFilters(prev => ({ ...prev, ...next }));
    }, []);

    const createBooking = async (payload: unknown): Promise<Booking | null> => {
        setMutationLoading(true);
        try {
            const res = await api.post<Booking>('/bookings', payload);
            invalidateBookings();
            return res.data ?? null;
        } catch (err: unknown) {
            const msg = getErrorMessage(err, 'Failed to create booking');
            toast.error(msg);
            throw err;
        } finally {
            setMutationLoading(false);
        }
    };

    const checkIn = async (bookingId: string) => {
        setMutationLoading(true);
        try {
            const res = await api.patch<{ booking: Booking; guestPin: string }>(`/bookings/${bookingId}/check-in`);
            invalidateBookings();
            toast.success(`Check-in successful! Guest PIN: ${res.data?.guestPin}`);
            return { success: true, guestPin: res.data?.guestPin || '' };
        } catch (err: unknown) {
            const msg = getErrorMessage(err, 'Failed to check in');
            toast.error(msg);
            return { success: false, guestPin: '' };
        } finally {
            setMutationLoading(false);
        }
    };

    const walkInCheckIn = async (payload: Record<string, unknown>) => {
        setMutationLoading(true);
        try {
            const res = await api.post<{ booking: Booking; guestPin: string }>('/bookings/walk-in-check-in', payload);
            invalidateBookings();
            toast.success(`Walk-in check-in complete! Guest PIN: ${res.data?.guestPin}`);
            return { success: true, guestPin: res.data?.guestPin || '', booking: res.data?.booking };
        } catch (err: unknown) {
            const msg = getErrorMessage(err, 'Walk-in check-in failed');
            toast.error(msg);
            return { success: false, guestPin: '' };
        } finally {
            setMutationLoading(false);
        }
    };

    const checkOut = async (bookingId: string) => {
        setMutationLoading(true);
        try {
            await api.patch<{ booking: Booking }>(`/bookings/${bookingId}/check-out`);
            invalidateBookings();
            toast.success('Check-out successful');
        } catch (err: unknown) {
            const msg = getErrorMessage(err, 'Failed to check out');
            toast.error(msg);
            throw err;
        } finally {
            setMutationLoading(false);
        }
    };

    const getCheckoutPreview = async (bookingId: string): Promise<CheckoutPreview> => {
        const res = await api.get<CheckoutPreview>(`/bookings/${bookingId}/checkout-preview`);
        return res.data as CheckoutPreview;
    };

    const processCheckout = async (bookingId: string, payload: {
        payments: { method: string; amount: number; transactionId?: string; notes?: string }[];
        discount?: number;
        guestPan?: string;
        payLater?: boolean;
        creditReason?: string;
    }) => {
        setMutationLoading(true);
        try {
            const res = await api.post(`/bookings/${bookingId}/checkout`, payload);
            invalidateBookings();
            toast.success('Checkout completed successfully');
            return res.data;
        } catch (err: unknown) {
            const msg = getErrorMessage(err, 'Checkout failed');
            toast.error(msg);
            throw err;
        } finally {
            setMutationLoading(false);
        }
    };

    const updateBooking = async (bookingId: string, payload: unknown) => {
        setMutationLoading(true);
        try {
            await api.patch<{ booking: Booking }>(`/bookings/${bookingId}`, payload);
            invalidateBookings();
            toast.success('Booking updated successfully');
        } catch (err: unknown) {
            const msg = getErrorMessage(err, 'Failed to update booking');
            toast.error(msg);
            throw err;
        } finally {
            setMutationLoading(false);
        }
    };

    const cancelBooking = async (bookingId: string, reason?: string, cancellationFee?: number) => {
        setMutationLoading(true);
        try {
            await api.post(`/bookings/${bookingId}/cancel`, { reason, cancellationFee });
            invalidateBookings();
            toast.success('Booking cancelled successfully');
        } catch (err: unknown) {
            const msg = getErrorMessage(err, 'Failed to cancel booking');
            toast.error(msg);
            throw err;
        } finally {
            setMutationLoading(false);
        }
    };

    const extendStay = async (bookingId: string, newCheckOut: string, newTotalAmount?: number) => {
        setMutationLoading(true);
        try {
            await api.patch(`/bookings/${bookingId}/extend`, { newCheckOut, newTotalAmount });
            invalidateBookings();
            toast.success('Stay extended successfully');
        } catch (err: unknown) {
            const msg = getErrorMessage(err, 'Failed to extend stay');
            toast.error(msg);
            throw err;
        } finally {
            setMutationLoading(false);
        }
    };

    const changeRoom = async (bookingId: string, newRoomId: number) => {
        setMutationLoading(true);
        try {
            await api.patch(`/bookings/${bookingId}/change-room`, { newRoomId });
            invalidateBookings();
            toast.success('Room changed successfully');
        } catch (err: unknown) {
            const msg = getErrorMessage(err, 'Failed to change room');
            toast.error(msg);
            throw err;
        } finally {
            setMutationLoading(false);
        }
    };

    const updateBookingDates = async (bookingId: string, checkIn: string, checkOut: string, roomId?: number) => {
        return updateBooking(bookingId, { checkIn, checkOut, ...(roomId ? { roomId } : {}) });
    };

    return {
        bookings,
        isLoading: isLoading || mutationLoading,
        error: error instanceof Error ? error.message : null,
        pagination,
        fetchBookings,
        createBooking,
        checkIn,
        walkInCheckIn,
        checkOut,
        getCheckoutPreview,
        processCheckout,
        updateBooking,
        updateBookingDates,
        cancelBooking,
        extendStay,
        changeRoom,
    };
}
