import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { Room } from '@/lib/types/api.types';

export interface LayoutNode {
    id: number;
    type: 'ROOM' | 'TABLE' | 'FACILITY';
    x: number;
    y: number;
    w: number;
    h: number;
    rotation?: number;
    shape?: 'RECTANGLE' | 'CIRCLE' | 'L_SHAPE';
    data: any; // Room or Table data
}

export interface FloorLayout {
    id: number;
    name: string;
    rooms: Room[];
}

export interface TableNode {
    id: number;
    tableNumber: string;
    capacity: number;
    status: string;
    location: string;
    layoutProps: any;
}

export function useLayout() {
    const [layouts, setLayouts] = useState<FloorLayout[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [tables, setTables] = useState<TableNode[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch flat list of rooms and tables (visual editor)
    const fetchVisualData = useCallback(async (floorId?: number) => {
        setIsLoading(true);
        try {
            const query = floorId ? `?floorId=${floorId}` : '';
            const response = await api.get<{ rooms: Room[], tables: TableNode[] }>(`/layout/floor-plan${query}`);
            if (response.data) {
                setRooms(response.data.rooms);
                setTables(response.data.tables);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch visual data');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Fetch nested floor plan structure
    const fetchLayoutStructure = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await api.get<FloorLayout[]>('/layout/structure');
            if (response.data) {
                setLayouts(response.data);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch layout');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Save positions for rooms/tables
    const savePositions = async (
        rooms?: { id: number; layout: any }[],
        tables?: { id: number; layout: any }[]
    ) => {
        try {
            await api.post('/layout/save-positions', { rooms, tables });
            return true;
        } catch (err) {
            console.error('Failed to save layout:', err);
            return false;
        }
    };

    // Update single room position (optimistic)
    const updateRoomPosition = async (id: number, layout: any) => {
        try {
            await api.patch(`/layout/room/${id}/position`, layout);
            return true;
        } catch (err) {
            console.error('Failed to update room position:', err);
            return false;
        }
    };

    return {
        layouts,
        rooms,
        tables,
        isLoading,
        error,
        fetchVisualData,
        fetchLayoutStructure,
        savePositions,
        updateRoomPosition
    };
}
