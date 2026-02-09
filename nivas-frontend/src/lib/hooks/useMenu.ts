import { useState, useCallback } from 'react';
import api from '../api';
import { toast } from 'sonner';
import type { MenuItem, CreateMenuItemPayload } from '../types/api.types';

export function useMenu() {
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchMenu = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await api.get<MenuItem[]>('/menu');
            setMenuItems(res.data || []);
        } catch (err: any) {
            const msg = err?.response?.data?.message || err.message || 'Failed to fetch menu';
            setError(msg);
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createItem = async (data: CreateMenuItemPayload) => {
        setIsLoading(true);
        try {
            await api.post('/menu', data);
            await fetchMenu();
            toast.success('Menu item created successfully');
            return true;
        } catch (err: any) {
            const msg = err?.response?.data?.message || err.message || 'Failed to create item';
            toast.error(msg);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const updateItem = async (id: number, data: Partial<CreateMenuItemPayload>) => {
        setIsLoading(true);
        try {
            await api.patch(`/menu/${id}`, data);
            await fetchMenu();
            toast.success('Menu item updated successfully');
            return true;
        } catch (err: any) {
            const msg = err?.response?.data?.message || err.message || 'Failed to update item';
            toast.error(msg);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const deleteItem = async (id: number) => {
        setIsLoading(true);
        try {
            await api.delete(`/menu/${id}`);
            await fetchMenu();
            toast.success('Menu item deleted successfully');
            return true;
        } catch (err: any) {
            const msg = err?.response?.data?.message || err.message || 'Failed to delete item';
            toast.error(msg);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        menuItems,
        isLoading,
        error,
        fetchMenu,
        createItem,
        updateItem,
        deleteItem
    };
}
