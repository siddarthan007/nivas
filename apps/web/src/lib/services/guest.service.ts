import { api } from '@/lib/api';

export type CustomerType = 'HOTEL_GUEST' | 'RESTAURANT_CUSTOMER' | 'BOTH';

export interface Guest {
    id: string;
    hotelId: number;
    firstName?: string;
    lastName?: string;
    fullName: string;
    uniqueId?: string;
    phone?: string;
    email?: string;
    fatherName?: string;
    dob?: string;
    occupation?: string;
    nationality?: string;
    address?: string;
    city?: string;
    country?: string;
    idType?: string;
    idNumber?: string;
    panNumber?: string;
    vatNumber?: string;
    openingDueAmount?: string;
    photoUrl?: string;
    signatureUrl?: string;
    customerType?: CustomerType;
    notes?: string;
    isVip: boolean;
    isBanned: boolean;
    createdAt: string;
}

export interface CreateGuestPayload {
    firstName?: string;
    lastName?: string;
    fullName: string;
    uniqueId?: string;
    phone?: string;
    email?: string;
    fatherName?: string;
    dob?: string;
    occupation?: string;
    nationality?: string;
    address?: string;
    city?: string;
    country?: string;
    idType?: string;
    idNumber?: string;
    panNumber?: string;
    vatNumber?: string;
    openingDueAmount?: string;
    photoUrl?: string;
    signatureUrl?: string;
    customerType?: CustomerType;
    notes?: string;
}

export interface GuestSearchResult extends Guest { }

export interface GuestDetails extends Guest {
    bookings: any[];
    orders: any[];
}

export interface GuestFilters {
    query?: string;
    isVip?: boolean;
    isBanned?: boolean;
    nationality?: string;
    roomNumber?: string;
    dateOfStay?: string;
    customerType?: CustomerType;
    page?: number;
    limit?: number;
}

export interface GuestFinancials {
    invoices: any[];
    payments: any[];
    orders: any[];
    folioCharges?: Array<{ description: string; amount: number; date?: string; category?: string }>;
    liveFolio?: { summary?: { totalCharges?: number; balance?: number } };
    liveCharges?: number;
    liveBalance?: number;
    stats: {
        totalInvoiced: number;
        totalPaid: number;
        balance: number;
    };
}

export const GuestService = {
    search: async (filters: GuestFilters | string): Promise<GuestSearchResult[]> => {
        const params = new URLSearchParams();
        if (typeof filters === 'string') {
            params.append('q', filters);
        } else {
            if (filters.query) params.append('q', filters.query);
            if (filters.isVip !== undefined) params.append('isVip', String(filters.isVip));
            if (filters.isBanned !== undefined) params.append('isBanned', String(filters.isBanned));
            if (filters.nationality) params.append('nationality', filters.nationality);
            if (filters.roomNumber) params.append('roomNumber', filters.roomNumber);
            if (filters.dateOfStay) params.append('dateOfStay', filters.dateOfStay);
            if (filters.customerType) params.append('customerType', filters.customerType);
        }

        const { data } = await api.get<GuestSearchResult[]>(`/guests/search?${params.toString()}`);
        return data || [];
    },

    getById: async (id: string): Promise<GuestDetails | null> => {
        const { data } = await api.get<GuestDetails>(`/guests/${id}`);
        return data || null;
    },

    getFinancials: async (id: string): Promise<GuestFinancials | null> => {
        const { data } = await api.get<any>(`/guests/${id}/financials`);
        if (!data) return null;
        return {
            invoices: data.invoices || [],
            payments: data.payments || [],
            orders: data.orders || [],
            folioCharges: data.folioCharges || [],
            liveFolio: data.liveFolio,
            liveCharges: data.liveCharges != null ? Number(data.liveCharges) : undefined,
            liveBalance: data.liveBalance != null ? Number(data.liveBalance) : undefined,
            stats: {
                totalInvoiced: Number(data.stats?.totalInvoiced || 0),
                totalPaid: Number(data.stats?.totalPaid || 0),
                balance: Number(data.stats?.balance || 0),
            }
        };
    },

    create: async (payload: CreateGuestPayload) => {
        const { data } = await api.post<Guest>('/guests', payload);
        return data;
    },

    update: async (id: string, payload: Partial<Guest>) => {
        const { data } = await api.patch<Guest>(`/guests/${id}`, payload);
        return data;
    },

    delete: async (id: string) => {
        await api.delete(`/guests/${id}`);
    }
};
