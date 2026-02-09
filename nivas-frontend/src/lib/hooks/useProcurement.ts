/**
 * Procurement API Hook
 * Connects to /procurement endpoints
 */
import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import { toast } from 'sonner';

export interface PurchaseOrderItem {
    id: number;
    itemId: number;
    itemName: string;
    quantity: number;
    unitPrice: number;
    receivedQuantity?: number;
}

export interface PurchaseOrder {
    id: number;
    poNumber: string;
    supplier: string;
    status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'ORDERED' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';
    items: PurchaseOrderItem[];
    totalAmount: number;
    expectedDate?: string;
    createdAt: string;
    notes?: string;
}

export interface ProcurementStats {
    total: number;
    pending: number;
    inTransit: number;
    received: number;
    totalValue: number;
}

export interface CreatePOPayload {
    supplier: string;
    items: { itemId: number; quantity: number; unitPrice: number }[];
    expectedDate?: string;
    notes?: string;
}

export interface UseProcurementReturn {
    purchaseOrders: PurchaseOrder[];
    stats: ProcurementStats;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    createPO: (payload: CreatePOPayload) => Promise<boolean>;
    approvePO: (poId: number) => Promise<boolean>;
    rejectPO: (poId: number) => Promise<boolean>;
    receivePO: (poId: number) => Promise<boolean>;
    cancelPO: (poId: number) => Promise<boolean>;
}

export function useProcurement(): UseProcurementReturn {
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [stats, setStats] = useState<ProcurementStats>({ total: 0, pending: 0, inTransit: 0, received: 0, totalValue: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPurchaseOrders = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await api.get<{ orders: PurchaseOrder[]; stats: ProcurementStats }>('/procurement/purchase-orders');
            if (response.data) {
                setPurchaseOrders(response.data.orders || []);
                setStats(response.data.stats || { total: 0, pending: 0, inTransit: 0, received: 0, totalValue: 0 });
            }
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to fetch purchase orders';
            setError(message);
            console.error('[useProcurement]', e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createPO = useCallback(async (payload: CreatePOPayload): Promise<boolean> => {
        try {
            const response = await api.post<PurchaseOrder>('/procurement/purchase-orders', payload);
            if (response.data) {
                setPurchaseOrders(prev => [response.data!, ...prev]);
                toast.success('Purchase order created');
                return true;
            }
            return false;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to create purchase order';
            toast.error(message);
            return false;
        }
    }, []);

    const approvePO = useCallback(async (poId: number): Promise<boolean> => {
        try {
            await api.post(`/procurement/purchase-orders/${poId}/approve`);
            setPurchaseOrders(prev => prev.map(po =>
                po.id === poId ? { ...po, status: 'APPROVED' as const } : po
            ));
            toast.success('Purchase order approved');
            await fetchPurchaseOrders();
            return true;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to approve purchase order';
            toast.error(message);
            return false;
        }
    }, [fetchPurchaseOrders]);

    const rejectPO = useCallback(async (poId: number): Promise<boolean> => {
        try {
            await api.post(`/procurement/purchase-orders/${poId}/reject`);
            setPurchaseOrders(prev => prev.map(po =>
                po.id === poId ? { ...po, status: 'CANCELLED' as const } : po
            ));
            toast.success('Purchase order rejected');
            await fetchPurchaseOrders();
            return true;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to reject purchase order';
            toast.error(message);
            return false;
        }
    }, [fetchPurchaseOrders]);

    const receivePO = useCallback(async (poId: number): Promise<boolean> => {
        try {
            await api.patch(`/procurement/purchase-orders/${poId}/receive`);
            setPurchaseOrders(prev => prev.map(po =>
                po.id === poId ? { ...po, status: 'RECEIVED' as const } : po
            ));
            toast.success('Purchase order received');
            await fetchPurchaseOrders();
            return true;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to receive purchase order';
            toast.error(message);
            return false;
        }
    }, [fetchPurchaseOrders]);

    const cancelPO = useCallback(async (poId: number): Promise<boolean> => {
        try {
            await api.delete(`/procurement/purchase-orders/${poId}`);
            setPurchaseOrders(prev => prev.map(po =>
                po.id === poId ? { ...po, status: 'CANCELLED' as const } : po
            ));
            toast.success('Purchase order cancelled');
            await fetchPurchaseOrders();
            return true;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to cancel purchase order';
            toast.error(message);
            return false;
        }
    }, [fetchPurchaseOrders]);

    useEffect(() => {
        fetchPurchaseOrders();
    }, [fetchPurchaseOrders]);

    return {
        purchaseOrders,
        stats,
        isLoading,
        error,
        refresh: fetchPurchaseOrders,
        createPO,
        approvePO,
        rejectPO,
        receivePO,
        cancelPO
    };
}

export default useProcurement;
