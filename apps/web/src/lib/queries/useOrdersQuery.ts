'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from './keys';

export interface OrdersQueryFilters {
    status?: string[];
    type?: string;
    search?: string;
    [key: string]: string | string[] | undefined;
}

export function useOrdersQuery(filters: OrdersQueryFilters = {}) {
    return useQuery({
        queryKey: queryKeys.orders.list(filters),
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters.status?.length) params.set('status', filters.status.join(','));
            if (filters.type) params.set('type', filters.type);
            if (filters.search) params.set('search', filters.search);
            const qs = params.toString();
            const res = await api.get<any[]>(`/orders${qs ? `?${qs}` : ''}`);
            return Array.isArray(res.data) ? res.data : [];
        },
    });
}

export function useInvalidateOrders() {
    const queryClient = useQueryClient();
    return () => queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
}
