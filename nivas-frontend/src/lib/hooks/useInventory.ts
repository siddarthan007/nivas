import { useState, useCallback } from 'react';
import api from '../api';
import { toast } from 'sonner';
import type { InventoryItem, CreateInventoryPayload, ItemCategory } from '../types/api.types';

export function useInventory() {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchInventory = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await api.get<InventoryItem[]>('/inventory');
            setItems(res.data || []);
        } catch (err: any) {
            const msg = err?.response?.data?.message || err.message || 'Failed to fetch inventory';
            setError(msg);
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const addItem = async (data: CreateInventoryPayload) => {
        setIsLoading(true);
        try {
            await api.post('/inventory', data);
            await fetchInventory();
            toast.success('Inventory item added successfully');
            return true;
        } catch (err: any) {
            const msg = err?.response?.data?.message || err.message || 'Failed to add item';
            toast.error(msg);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const updateStock = async (id: number, quantity: number) => {
        setIsLoading(true);
        try {
            await api.patch(`/inventory/${id}`, { quantity });
            await fetchInventory();
            toast.success('Stock updated successfully');
            return true;
        } catch (err: any) {
            const msg = err?.response?.data?.message || err.message || 'Failed to update stock';
            toast.error(msg);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const deleteItem = async (id: number) => {
        setIsLoading(true);
        try {
            await api.delete(`/inventory/${id}`);
            await fetchInventory();
            toast.success('Item deleted successfully');
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
        items,
        isLoading,
        error,
        fetchInventory,
        addItem,
        updateStock,
        deleteItem
    };
}
