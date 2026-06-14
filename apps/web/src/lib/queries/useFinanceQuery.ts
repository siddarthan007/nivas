'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Invoice, Payment, CreditNote } from '@/lib/hooks/useFinance';
import { queryKeys } from './keys';

export function useFinancePaymentsQuery(limit = 50) {
    return useQuery({
        queryKey: queryKeys.finance.payments(limit),
        queryFn: async () => {
            const res = await api.get<Payment[]>(`/finance/payments?limit=${limit}`);
            return res.data ?? [];
        },
    });
}

export function useFinanceInvoicesQuery(limit = 50) {
    return useQuery({
        queryKey: queryKeys.finance.invoices(limit),
        queryFn: async () => {
            const res = await api.get<Invoice[]>(`/invoices?limit=${limit}`);
            return res.data ?? [];
        },
    });
}

export function useFinanceCreditNotesQuery(limit = 50) {
    return useQuery({
        queryKey: queryKeys.finance.creditNotes(limit),
        queryFn: async () => {
            const res = await api.get<CreditNote[]>(`/credit-notes?limit=${limit}`);
            return res.data ?? [];
        },
    });
}

export function useCustomerLedgersQuery() {
    return useQuery({
        queryKey: queryKeys.finance.customerLedgers,
        queryFn: async () => {
            const res = await api.get<any[]>('/billing/customer-ledgers');
            return Array.isArray(res.data) ? res.data : [];
        },
        staleTime: 15_000,
    });
}

export function useLiveCustomerLedgersQuery() {
    return useQuery({
        queryKey: queryKeys.finance.liveLedgers,
        queryFn: async () => {
            const res = await api.get<any[]>('/billing/customer-ledgers/live');
            return Array.isArray(res.data) ? res.data : [];
        },
        staleTime: 15_000,
    });
}

export function useInvalidateFinance() {
    const queryClient = useQueryClient();
    return () => {
        queryClient.invalidateQueries({ queryKey: ['finance'] });
        queryClient.invalidateQueries({ queryKey: queryKeys.finance.customerLedgers });
    };
}
