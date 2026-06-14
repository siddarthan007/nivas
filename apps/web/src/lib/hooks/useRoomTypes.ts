'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

export interface RoomTypeItem {
    id: number;
    hotelId: number;
    name: string;
    code: string;
    description?: string;
    baseRate: string;
    sortOrder: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export function useRoomTypes() {
    const [roomTypes, setRoomTypes] = useState<RoomTypeItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchRoomTypes = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await api.get<RoomTypeItem[]>('/room-types');
            setRoomTypes(res.data || []);
        } catch (err) {
            console.warn('Failed to fetch room types:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRoomTypes();
    }, [fetchRoomTypes]);

    const createRoomType = async (data: { name: string; code: string; description?: string; baseRate?: string }) => {
        const res = await api.post<RoomTypeItem>('/room-types', data);
        if (res.data) {
            setRoomTypes(prev => [...prev, res.data!]);
        }
        return res.data;
    };

    const updateRoomType = async (id: number, data: Partial<RoomTypeItem>) => {
        const res = await api.patch<RoomTypeItem>(`/room-types/${id}`, data);
        if (res.data) {
            setRoomTypes(prev => prev.map(rt => rt.id === id ? res.data! : rt));
        }
        return res.data;
    };

    const deleteRoomType = async (id: number) => {
        await api.delete(`/room-types/${id}`);
        setRoomTypes(prev => prev.filter(rt => rt.id !== id));
    };

    return {
        roomTypes,
        isLoading,
        fetchRoomTypes,
        createRoomType,
        updateRoomType,
        deleteRoomType,
    };
}
