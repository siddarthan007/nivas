/**
 * Facilities API Hook
 * Connects to /operations/facilities endpoints
 */
import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import { toast } from 'sonner';

export interface Facility {
    id: number;
    name: string;
    type: 'GYM' | 'POOL' | 'SPA' | 'RESTAURANT' | 'LOUNGE' | 'CONFERENCE' | 'OTHER';
    location?: string;
    description?: string;
    status: 'OPEN' | 'CLOSED' | 'MAINTENANCE';
    openTime: string;
    closeTime: string;
}

export interface ParkingSpace {
    id: number;
    spaceNumber: string;
    vehicleType: 'CAR' | 'BIKE' | 'TRUCK';
    status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';
    assignedToRoomId?: number;
    assignedRoom?: { number: string; name: string };
}

export interface CreateFacilityPayload {
    name: string;
    type: Facility['type'];
    location?: string;
    description?: string;
    status: Facility['status'];
    openTime: string;
    closeTime: string;
}

export interface CreateParkingPayload {
    spaceNumber: string;
    vehicleType: ParkingSpace['vehicleType'];
}

export interface UseFacilitiesReturn {
    facilities: Facility[];
    parking: ParkingSpace[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    createFacility: (payload: CreateFacilityPayload) => Promise<boolean>;
    updateFacility: (id: number, payload: Partial<Facility>) => Promise<boolean>;
    deleteFacility: (id: number) => Promise<boolean>;
    createParkingSpace: (payload: CreateParkingPayload) => Promise<boolean>;
    assignParking: (spaceId: number, roomId: number | null) => Promise<boolean>;
}

export function useFacilities(): UseFacilitiesReturn {
    const [facilities, setFacilities] = useState<Facility[]>([]);
    const [parking, setParking] = useState<ParkingSpace[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAll = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const [facilitiesRes, parkingRes] = await Promise.all([
                api.get<Facility[]>('/operations/facilities'),
                api.get<ParkingSpace[]>('/operations/facilities/parking')
            ]);

            if (facilitiesRes.data) setFacilities(facilitiesRes.data);
            if (parkingRes.data) setParking(parkingRes.data);
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to fetch facilities';
            setError(message);
            console.error('[useFacilities]', e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createFacility = useCallback(async (payload: CreateFacilityPayload): Promise<boolean> => {
        try {
            const response = await api.post<Facility>('/operations/facilities', payload);
            if (response.data) {
                setFacilities(prev => [...prev, response.data!]);
                toast.success('Facility created');
                return true;
            }
            return false;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to create facility';
            toast.error(message);
            return false;
        }
    }, []);

    const updateFacility = useCallback(async (id: number, payload: Partial<Facility>): Promise<boolean> => {
        try {
            const response = await api.patch<Facility>(`/operations/facilities/${id}`, payload);
            if (response.data) {
                setFacilities(prev => prev.map(f => f.id === id ? { ...f, ...response.data } : f));
                toast.success('Facility updated');
                return true;
            }
            return false;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to update facility';
            toast.error(message);
            return false;
        }
    }, []);

    const deleteFacility = useCallback(async (id: number): Promise<boolean> => {
        try {
            await api.delete(`/operations/facilities/${id}`);
            setFacilities(prev => prev.filter(f => f.id !== id));
            toast.success('Facility deleted');
            return true;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to delete facility';
            toast.error(message);
            return false;
        }
    }, []);

    const createParkingSpace = useCallback(async (payload: CreateParkingPayload): Promise<boolean> => {
        try {
            const response = await api.post<ParkingSpace>('/operations/facilities/parking', payload);
            if (response.data) {
                setParking(prev => [...prev, response.data!]);
                toast.success('Parking space added');
                return true;
            }
            return false;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to add parking space';
            toast.error(message);
            return false;
        }
    }, []);

    const assignParking = useCallback(async (spaceId: number, roomId: number | null): Promise<boolean> => {
        try {
            const response = await api.patch<ParkingSpace>(`/operations/facilities/parking/${spaceId}/assign`, { roomId });
            if (response.data) {
                setParking(prev => prev.map(p => p.id === spaceId ? response.data! : p));
                toast.success(roomId ? 'Parking assigned' : 'Parking released');
                return true;
            }
            return false;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to update parking';
            toast.error(message);
            return false;
        }
    }, []);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    return {
        facilities,
        parking,
        isLoading,
        error,
        refresh: fetchAll,
        createFacility,
        updateFacility,
        deleteFacility,
        createParkingSpace,
        assignParking
    };
}

export default useFacilities;
