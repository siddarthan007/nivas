'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { Booking } from '@/lib/types/api.types';
import type { BookingFilters, BookingSegment } from '@/lib/hooks/useBookings';
import { queryKeys } from './keys';

interface BookingsListResponse {
    bookings: Booking[];
    meta?: { page: number; limit: number; total: number; totalPages: number };
}

function buildBookingsQuery(filters: BookingFilters = {}) {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.segment) params.set('segment', filters.segment);
    if (filters.search) params.set('search', filters.search);
    const qs = params.toString();
    return `/bookings${qs ? `?${qs}` : ''}`;
}

export function useBookingsQuery(filters: BookingFilters = {}) {
    return useQuery({
        queryKey: queryKeys.bookings.list(filters),
        queryFn: async (): Promise<BookingsListResponse> => {
            const res = await api.get<Booking[] | { data: Booking[]; meta?: BookingsListResponse['meta'] }>(
                buildBookingsQuery(filters)
            );
            const payload = res.data;
            if (Array.isArray(payload)) {
                return { bookings: payload };
            }
            if (payload && typeof payload === 'object' && 'data' in payload && Array.isArray((payload as any).data)) {
                return { bookings: (payload as any).data, meta: (payload as any).meta };
            }
            return { bookings: (payload as unknown as Booking[]) ?? [] };
        },
    });
}

export function useInvalidateBookings() {
    const queryClient = useQueryClient();
    return () => queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
}

export function useBookingMutations() {
    const invalidate = useInvalidateBookings();

    const checkIn = useMutation({
        mutationFn: async (bookingId: string) => api.patch(`/bookings/${bookingId}/check-in`),
        onSuccess: () => { invalidate(); toast.success('Checked in'); },
        onError: (err: Error) => toast.error(err.message || 'Check-in failed'),
    });

    const checkOut = useMutation({
        mutationFn: async (bookingId: string) => api.post(`/bookings/${bookingId}/checkout`, {}),
        onSuccess: () => { invalidate(); toast.success('Checked out'); },
        onError: (err: Error) => toast.error(err.message || 'Checkout failed'),
    });

    return { checkIn, checkOut };
}

export type { BookingSegment };
