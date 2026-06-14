export const queryKeys = {
    bookings: {
        all: ['bookings'] as const,
        list: (filters: Record<string, unknown>) => ['bookings', 'list', filters] as const,
    },
    orders: {
        all: ['orders'] as const,
        list: (filters?: Record<string, unknown>) => ['orders', 'list', filters ?? {}] as const,
    },
    finance: {
        payments: (limit?: number) => ['finance', 'payments', limit ?? 50] as const,
        invoices: (limit?: number) => ['finance', 'invoices', limit ?? 50] as const,
        creditNotes: (limit?: number) => ['finance', 'credit-notes', limit ?? 50] as const,
        liveLedgers: ['finance', 'live-ledgers'] as const,
        customerLedgers: ['finance', 'customer-ledgers'] as const,
    },
} as const;
