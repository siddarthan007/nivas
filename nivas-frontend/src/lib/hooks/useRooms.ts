'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type {
    Room,
    CreateRoomPayload,
    UpdateRoomPayload,
} from '@/lib/types/api.types';

/**
 * Hook for rooms management with CRUD operations
 */
export function useRooms() {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch all rooms
    const fetchRooms = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await api.get<Room[]>('/rooms');
            if (response.data) {
                setRooms(response.data);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch rooms');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchRooms();
    }, [fetchRooms]);

    // Create a new room
    const createRoom = async (data: CreateRoomPayload) => {
        try {
            const response = await api.post<Room>('/rooms', data);
            if (response.data) {
                setRooms(prev => [...prev, response.data!]);
                return { success: true, room: response.data };
            }
            return { success: false, error: 'Failed to create room' };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Failed to create room' };
        }
    };

    // Update a room
    const updateRoom = async (id: number, data: UpdateRoomPayload) => {
        try {
            const response = await api.patch<Room>(`/rooms/${id}`, data);
            if (response.data) {
                setRooms(prev => prev.map(r => r.id === id ? response.data! : r));
                return { success: true, room: response.data };
            }
            return { success: false, error: 'Failed to update room' };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Failed to update room' };
        }
    };

    // Delete a room
    const deleteRoom = async (id: number) => {
        try {
            await api.delete(`/rooms/${id}`);
            setRooms(prev => prev.filter(r => r.id !== id));
            return { success: true };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Failed to delete room' };
        }
    };

    // Update room status
    const updateStatus = async (id: number, status: Room['status']) => {
        return updateRoom(id, { status });
    };

    // Computed stats (must match actual backend room.status values)
    const stats = {
        total: rooms.length,
        available: rooms.filter(r => r.status === 'AVAILABLE').length,
        occupied: rooms.filter(r => r.status === 'OCCUPIED').length,
        cleaning: rooms.filter(r => r.status === 'CLEANING').length,
        maintenance: rooms.filter(r => r.status === 'MAINTENANCE').length,
        outOfOrder: rooms.filter(r => r.status === 'OUT_OF_ORDER').length,
    };

    return {
        rooms,
        isLoading,
        error,
        stats,
        fetchRooms,
        createRoom,
        updateRoom,
        deleteRoom,
        updateStatus,
    };
}

export default useRooms;
