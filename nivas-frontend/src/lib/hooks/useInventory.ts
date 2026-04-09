import { useState, useCallback, useEffect } from 'react';
import api, { ApiError } from '../api';
import { toast } from 'sonner';
import type { InventoryItem, CreateInventoryPayload, ItemCategory } from '../types/api.types';

function getErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof ApiError) return err.message;
    if (err instanceof Error) return err.message;
    return fallback;
}

// Normalize backend fields (quantity→currentStock, lowStockThreshold→minStock)
function normalizeItem(raw: any): InventoryItem {
    return {
        ...raw,
        currentStock: raw.currentStock ?? raw.quantity ?? 0,
        minStock: raw.minStock ?? raw.lowStockThreshold ?? 5,
        reorderLevel: raw.reorderLevel ?? raw.lowStockThreshold ?? 10,
        costPrice: Number(raw.costPrice ?? raw.unitCost ?? 0),
        supplier: raw.supplier || '',
    };
}

export function useInventory() {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchInventory = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await api.get<any[]>('/inventory');
            setItems((res.data || []).map(normalizeItem));
        } catch (err: unknown) {
            const msg = getErrorMessage(err, 'Failed to fetch inventory');
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
        } catch (err: unknown) {
            const msg = getErrorMessage(err, 'Failed to add item');
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
        } catch (err: unknown) {
            const msg = getErrorMessage(err, 'Failed to update stock');
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
        } catch (err: unknown) {
            const msg = getErrorMessage(err, 'Failed to delete item');
            toast.error(msg);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-fetch on mount
    useEffect(() => {
        fetchInventory();
    }, [fetchInventory]);

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
