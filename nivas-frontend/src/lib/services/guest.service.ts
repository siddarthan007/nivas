import { api } from '@/lib/api';

export interface Guest {
    id: string;
    hotelId: number;
    fullName: string;
    phone?: string;
    email?: string;
    idType?: string;
    idNumber?: string;
    address?: string;
    notes?: string;
    isVip: boolean;
    isBanned: boolean;
    nationality?: string;
    createdAt: string;
}

export interface CreateGuestPayload {
    fullName: string;
    phone?: string;
    email?: string;
    idType?: string;
    idNumber?: string;
    address?: string;
    notes?: string;
    nationality?: string;
}

export interface GuestSearchResult extends Guest { }

export interface GuestDetails extends Guest {
    bookings: any[]; // refined type later
}

export interface GuestFilters {
    query?: string;
    isVip?: boolean;
    isBanned?: boolean;
    nationality?: string;
    roomNumber?: string;
    dateOfStay?: string;
    page?: number;
    limit?: number;
}

export interface GuestFinancials {
    invoices: any[]; // refine type if possible
    payments: any[];
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
        // Ensure stats numbers are parsed (backend decimal columns return strings)
        return {
            invoices: data.invoices || [],
            payments: data.payments || [],
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
