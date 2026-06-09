import { useState, useCallback, useEffect } from 'react';
import api, { ApiError } from '../api';
import { toast } from 'sonner';
import type { InventoryItem, CreateInventoryPayload } from '../types/api.types';

function getErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof ApiError) return err.message;
    if (err instanceof Error) return err.message;
    return fallback;
}

function normalizeItem(raw: any): InventoryItem {
    return {
        ...raw,
        sku: raw.sku || '',
        barcode: raw.barcode,
        description: raw.description,
        currentStock: raw.currentStock ?? raw.quantity ?? 0,
        quantity: raw.quantity ?? raw.currentStock ?? 0,
        minStock: raw.minStock ?? raw.lowStockThreshold ?? 5,
        reorderLevel: raw.reorderLevel ?? raw.lowStockThreshold ?? 10,
        lowStockThreshold: raw.lowStockThreshold ?? raw.minStock ?? 5,
        costPrice: Number(raw.costPrice ?? raw.unitCost ?? 0),
        unitCost: Number(raw.unitCost ?? raw.costPrice ?? 0),
        supplier: raw.supplier?.name || raw.supplierObj?.name || '',
        warehouse: raw.warehouse,
        supplierObj: raw.supplier,
        status: raw.status || 'ACTIVE',
    };
}

export interface StockMovement {
    id: number;
    hotelId: number;
    itemId: number;
    type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'RETURN' | 'PURCHASE';
    quantity: number;
    previousStock: number;
    newStock: number;
    reason?: string;
    reference?: string;
    notes?: string;
    createdAt: string;
    item?: { id: number; name: string; sku: string; unit: string };
    user?: { fullName: string };
}

export interface Warehouse {
    id: number;
    hotelId: number;
    name: string;
    location?: string;
    isActive: boolean;
    createdAt: string;
}

export interface Vendor {
    id: number;
    hotelId: number;
    name: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
    taxNumber?: string;
    isActive: boolean;
    createdAt: string;
}

export function useInventory() {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [movements, setMovements] = useState<StockMovement[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);
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

    const fetchLowStock = useCallback(async () => {
        try {
            const res = await api.get<any[]>('/inventory/low-stock');
            setLowStockItems((res.data || []).map(normalizeItem));
        } catch {
            setLowStockItems([]);
        }
    }, []);

    const fetchMovements = useCallback(async (itemId?: number) => {
        try {
            const url = itemId ? `/inventory/movements/list?itemId=${itemId}` : '/inventory/movements/list';
            const res = await api.get<StockMovement[]>(url);
            setMovements(res.data || []);
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to load stock movements'));
        }
    }, []);

    const fetchWarehouses = useCallback(async () => {
        try {
            const res = await api.get<Warehouse[]>('/inventory/warehouses/list');
            setWarehouses(res.data || []);
        } catch { setWarehouses([]); }
    }, []);

    const fetchVendors = useCallback(async () => {
        try {
            const res = await api.get<Vendor[]>('/inventory/vendors/list');
            setVendors(res.data || []);
        } catch { setVendors([]); }
    }, []);

    const refreshAll = useCallback(async () => {
        setIsLoading(true);
        await Promise.all([
            fetchInventory(),
            fetchLowStock(),
            fetchWarehouses(),
            fetchVendors(),
        ]);
        setIsLoading(false);
    }, [fetchInventory, fetchLowStock, fetchWarehouses, fetchVendors]);

    const addItem = async (data: CreateInventoryPayload) => {
        setIsLoading(true);
        try {
            await api.post('/inventory', data);
            await refreshAll();
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

    const updateItem = async (id: number, data: Partial<InventoryItem>) => {
        setIsLoading(true);
        try {
            await api.patch(`/inventory/${id}`, data);
            await refreshAll();
            toast.success('Item updated successfully');
            return true;
        } catch (err: unknown) {
            const msg = getErrorMessage(err, 'Failed to update item');
            toast.error(msg);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const adjustStock = async (id: number, adjustment: number, reason: string, reference?: string) => {
        setIsLoading(true);
        try {
            await api.post(`/inventory/${id}/adjust-stock`, { adjustment, reason, reference });
            await refreshAll();
            await fetchMovements();
            toast.success('Stock adjusted successfully');
            return true;
        } catch (err: unknown) {
            const msg = getErrorMessage(err, 'Failed to adjust stock');
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
            await refreshAll();
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
            await refreshAll();
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

    // Warehouse CRUD
    const addWarehouse = async (data: { name: string; location?: string }) => {
        try {
            await api.post('/inventory/warehouses', data);
            await fetchWarehouses();
            toast.success('Warehouse created');
            return true;
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to create warehouse'));
            return false;
        }
    };
    const updateWarehouse = async (id: number, data: Partial<Warehouse>) => {
        try {
            await api.patch(`/inventory/warehouses/${id}`, data);
            await fetchWarehouses();
            toast.success('Warehouse updated');
            return true;
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to update warehouse'));
            return false;
        }
    };
    const deleteWarehouse = async (id: number) => {
        try {
            await api.delete(`/inventory/warehouses/${id}`);
            await fetchWarehouses();
            toast.success('Warehouse deleted');
            return true;
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to delete warehouse'));
            return false;
        }
    };
    const getWarehouseFinance = async (id: number) => {
        try {
            const res = await api.get(`/inventory/warehouses/${id}/finance`);
            return res.data;
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to load warehouse finance'));
            return null;
        }
    };

    // Vendor CRUD
    const addVendor = async (data: { name: string; contactPerson?: string; email?: string; phone?: string; address?: string; taxNumber?: string }) => {
        try {
            await api.post('/inventory/vendors', data);
            await fetchVendors();
            toast.success('Vendor created');
            return true;
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to create vendor'));
            return false;
        }
    };
    const updateVendor = async (id: number, data: Partial<Vendor>) => {
        try {
            await api.patch(`/inventory/vendors/${id}`, data);
            await fetchVendors();
            toast.success('Vendor updated');
            return true;
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to update vendor'));
            return false;
        }
    };
    const deleteVendor = async (id: number) => {
        try {
            await api.delete(`/inventory/vendors/${id}`);
            await fetchVendors();
            toast.success('Vendor deleted');
            return true;
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to delete vendor'));
            return false;
        }
    };
    const getVendorFinance = async (id: number) => {
        try {
            const res = await api.get(`/inventory/vendors/${id}/finance`);
            return res.data;
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to load vendor finance'));
            return null;
        }
    };

    useEffect(() => {
        refreshAll();
    }, [refreshAll]);

    return {
        items,
        movements,
        warehouses,
        vendors,
        lowStockItems,
        isLoading,
        error,
        fetchInventory,
        fetchLowStock,
        fetchMovements,
        refreshAll,
        addItem,
        updateItem,
        adjustStock,
        updateStock,
        deleteItem,
        addWarehouse,
        updateWarehouse,
        deleteWarehouse,
        getWarehouseFinance,
        addVendor,
        updateVendor,
        deleteVendor,
        getVendorFinance,
    };
}
