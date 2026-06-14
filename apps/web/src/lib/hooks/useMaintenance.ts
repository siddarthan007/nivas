'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type {
    Asset,
    CreateAssetPayload,
    MaintenanceTicket,
    CreateTicketPayload,
} from '@/lib/types/api.types';

export function useMaintenance() {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [assetsRes, ticketsRes] = await Promise.allSettled([
                api.get<Asset[]>('/maintenance/assets'),
                api.get<MaintenanceTicket[]>('/maintenance/tickets')
            ]);
            
            if (assetsRes.status === 'fulfilled' && assetsRes.value.data) {
                setAssets(assetsRes.value.data);
            }
            if (ticketsRes.status === 'fulfilled' && ticketsRes.value.data) {
                setTickets(ticketsRes.value.data);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch maintenance data');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const createAsset = async (data: CreateAssetPayload) => {
        try {
            const response = await api.post<Asset>('/maintenance/assets', data);
            if (response.data) {
                setAssets(prev => [...prev, response.data!]);
                toast.success('Asset created');
                return { success: true, asset: response.data };
            }
            return { success: false, error: 'Failed to create asset' };
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to create asset';
            toast.error(msg);
            return { success: false, error: msg };
        }
    };

    const createTicket = async (data: CreateTicketPayload) => {
        try {
            const response = await api.post<MaintenanceTicket>('/maintenance/tickets', data);
            if (response.data) {
                setTickets(prev => [...prev, response.data!]);
                toast.success('Ticket created');
                return { success: true, ticket: response.data };
            }
            return { success: false, error: 'Failed to create ticket' };
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to create ticket';
            toast.error(msg);
            return { success: false, error: msg };
        }
    };

    const updateTicketStatus = async (id: number, status: string) => {
        try {
            const response = await api.patch<MaintenanceTicket>(`/maintenance/tickets/${id}/status`, { status });
            if (response.data) {
                setTickets(prev => prev.map(t => t.id === id ? response.data! : t));
                toast.success('Ticket status updated');
                return { success: true, ticket: response.data };
            }
            return { success: false, error: 'Failed to update ticket' };
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to update ticket';
            toast.error(msg);
            return { success: false, error: msg };
        }
    };

    return {
        assets,
        tickets,
        isLoading,
        error,
        fetchData,
        createAsset,
        createTicket,
        updateTicketStatus
    };
}
