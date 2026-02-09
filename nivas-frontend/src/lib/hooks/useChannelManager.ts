/**
 * Channel Manager API Hook
 * Connects to /channel-manager endpoints
 */
import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import { toast } from 'sonner';

export type ChannelCode = 'BOOKING_COM' | 'EXPEDIA' | 'AGODA' | 'MMT' | 'GOIBIBO' | 'AIRBNB';

export interface ChannelConnection {
    id: number;
    channelCode: ChannelCode;
    channelName: string;
    hotelCode?: string;
    isActive: boolean;
    syncRates: boolean;
    syncAvailability: boolean;
    syncReservations: boolean;
    rateMultiplier?: number;
    minLeadTime?: number;
    lastSyncAt?: string;
    status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
}

export interface SyncLog {
    id: number;
    channelId: number;
    channelCode: string;
    action: 'RATES' | 'INVENTORY' | 'RESERVATION';
    status: 'SUCCESS' | 'FAILED' | 'PENDING';
    message: string;
    createdAt: string;
}

export interface CreateChannelPayload {
    channelCode: ChannelCode;
    channelName: string;
    apiKey?: string;
    apiSecret?: string;
    hotelCode?: string;
    syncRates?: boolean;
    syncAvailability?: boolean;
    syncReservations?: boolean;
    rateMultiplier?: number;
    minLeadTime?: number;
}

export interface UseChannelManagerReturn {
    channels: ChannelConnection[];
    logs: SyncLog[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    createChannel: (payload: CreateChannelPayload) => Promise<boolean>;
    updateChannel: (id: number, payload: Partial<ChannelConnection>) => Promise<boolean>;
    deleteChannel: (id: number) => Promise<boolean>;
    syncInventory: (channelId: number) => Promise<boolean>;
    syncRates: (channelId: number) => Promise<boolean>;
    toggleChannel: (id: number, isActive: boolean) => Promise<boolean>;
}

export function useChannelManager(): UseChannelManagerReturn {
    const [channels, setChannels] = useState<ChannelConnection[]>([]);
    const [logs, setLogs] = useState<SyncLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAll = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const [channelsRes, logsRes] = await Promise.all([
                api.get<ChannelConnection[]>('/channel-manager/channels'),
                api.get<SyncLog[]>('/channel-manager/sync-logs?limit=20')
            ]);

            if (channelsRes.data) setChannels(channelsRes.data);
            if (logsRes.data) setLogs(logsRes.data);
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to fetch channel data';
            setError(message);
            console.error('[useChannelManager]', e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createChannel = useCallback(async (payload: CreateChannelPayload): Promise<boolean> => {
        try {
            const response = await api.post<ChannelConnection>('/channel-manager/channels', payload);
            if (response.data) {
                setChannels(prev => [...prev, response.data!]);
                toast.success('Channel connected');
                return true;
            }
            return false;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to connect channel';
            toast.error(message);
            return false;
        }
    }, []);

    const updateChannel = useCallback(async (id: number, payload: Partial<ChannelConnection>): Promise<boolean> => {
        try {
            const response = await api.patch<ChannelConnection>(`/channel-manager/channels/${id}`, payload);
            if (response.data) {
                setChannels(prev => prev.map(c => c.id === id ? { ...c, ...response.data } : c));
                toast.success('Channel settings updated');
                return true;
            }
            return false;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to update channel';
            toast.error(message);
            return false;
        }
    }, []);

    const deleteChannel = useCallback(async (id: number): Promise<boolean> => {
        try {
            await api.delete(`/channel-manager/channels/${id}`);
            setChannels(prev => prev.filter(c => c.id !== id));
            toast.success('Channel disconnected');
            return true;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to disconnect channel';
            toast.error(message);
            return false;
        }
    }, []);

    const syncInventory = useCallback(async (channelId: number): Promise<boolean> => {
        try {
            await api.post(`/channel-manager/channels/${channelId}/sync-inventory`);
            toast.success('Inventory sync started');
            return true;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to sync inventory';
            toast.error(message);
            return false;
        }
    }, []);

    const syncRates = useCallback(async (channelId: number): Promise<boolean> => {
        try {
            await api.post(`/channel-manager/channels/${channelId}/sync-rates`);
            toast.success('Rate sync started');
            return true;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to sync rates';
            toast.error(message);
            return false;
        }
    }, []);

    const toggleChannel = useCallback(async (id: number, isActive: boolean): Promise<boolean> => {
        return updateChannel(id, { isActive });
    }, [updateChannel]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    return {
        channels,
        logs,
        isLoading,
        error,
        refresh: fetchAll,
        createChannel,
        updateChannel,
        deleteChannel,
        syncInventory,
        syncRates,
        toggleChannel
    };
}

export default useChannelManager;
