/**
 * Procurement API Hook
 * Connects to /procurement endpoints using the backend's actual request/response shapes.
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

export type PurchaseOrderStatus = 'DRAFT' | 'APPROVED' | 'RECEIVED' | 'REJECTED' | 'CANCELLED';

export interface PurchaseOrder {
    id: number;
    poNumber: string;
    supplier: string;
    status: PurchaseOrderStatus;
    items: PurchaseOrderItem[];
    totalAmount: number;
    createdAt: string;
    notes?: string;
}

export interface ProcurementStats {
    total: number;
    drafts: number;
    approved: number;
    received: number;
    totalValue: number;
}

export interface Vendor {
    id: number;
    name: string;
    paymentTerms?: string | null;
    contact?: unknown;
}

export interface CreatePOPayload {
    supplierName: string;
    vendorId?: number;
    items: { itemId: number; quantity: number; unitCost: number }[];
    notes?: string;
    expectedDelivery?: string;
}

export interface UseProcurementReturn {
    purchaseOrders: PurchaseOrder[];
    vendors: Vendor[];
    stats: ProcurementStats;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    createPO: (payload: CreatePOPayload) => Promise<boolean>;
    createVendor: (name: string, paymentTerms?: string) => Promise<Vendor | null>;
    approvePO: (poId: number) => Promise<boolean>;
    rejectPO: (poId: number) => Promise<boolean>;
    receivePO: (poId: number) => Promise<boolean>;
    cancelPO: (poId: number) => Promise<boolean>;
}

interface BackendPurchaseOrderItem {
    id: number;
    itemId: number;
    quantityOrdered: number;
    quantityReceived?: number | null;
    unitCost: string | number;
    item?: {
        name?: string | null;
    } | null;
}

interface BackendPurchaseOrder {
    id: number;
    poNumber: string;
    supplierName?: string | null;
    vendorId?: number | null;
    vendor?: { id: number; name: string } | null;
    status?: string | null;
    totalCost?: string | number | null;
    notes?: string | null;
    createdAt: string;
    items?: BackendPurchaseOrderItem[];
}

const EMPTY_STATS: ProcurementStats = {
    total: 0,
    drafts: 0,
    approved: 0,
    received: 0,
    totalValue: 0,
};

function normalizeStatus(status?: string | null): PurchaseOrderStatus {
    switch (status) {
        case 'APPROVED':
        case 'RECEIVED':
        case 'REJECTED':
        case 'CANCELLED':
            return status;
        default:
            return 'DRAFT';
    }
}

function normalizePurchaseOrder(raw: BackendPurchaseOrder): PurchaseOrder {
    const items = (raw.items || []).map((item: any, idx: number) => ({
        id: item.id ?? idx,
        itemId: item.itemId,
        itemName: item.item?.name || item.itemName || `Item #${item.itemId}`,
        // Tolerate both the relation shape (quantityOrdered/unitCost) and the
        // stored JSON shape (quantity/unitCost) so quantities never read as 0.
        quantity: Number(item.quantityOrdered ?? item.quantity ?? 0),
        unitPrice: Number(item.unitCost ?? item.unitPrice ?? 0),
        receivedQuantity: item.quantityReceived !== null && item.quantityReceived !== undefined ? Number(item.quantityReceived) : undefined,
    }));

    return {
        id: raw.id,
        poNumber: raw.poNumber,
        supplier: raw.vendor?.name || raw.supplierName || 'Unknown supplier',
        status: normalizeStatus(raw.status),
        items,
        totalAmount: Number(raw.totalCost || 0),
        createdAt: raw.createdAt,
        notes: raw.notes || undefined,
    };
}

function buildStats(orders: PurchaseOrder[]): ProcurementStats {
    return {
        total: orders.length,
        drafts: orders.filter(order => order.status === 'DRAFT').length,
        approved: orders.filter(order => order.status === 'APPROVED').length,
        received: orders.filter(order => order.status === 'RECEIVED').length,
        totalValue: orders.reduce((sum, order) => sum + order.totalAmount, 0),
    };
}

export function useProcurement(): UseProcurementReturn {
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [stats, setStats] = useState<ProcurementStats>(EMPTY_STATS);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchVendors = useCallback(async () => {
        try {
            const response = await api.get<Vendor[]>('/procurement/vendors');
            setVendors(response.data || []);
        } catch (e) {
            // Vendor list is an optional convenience; don't block the page on it.
            console.error('[useProcurement] vendors', e);
        }
    }, []);

    const createVendor = useCallback(async (name: string, paymentTerms?: string): Promise<Vendor | null> => {
        try {
            const response = await api.post<Vendor>('/procurement/vendors', { name, paymentTerms });
            await fetchVendors();
            toast.success(`Vendor "${name}" added`);
            return response.data || null;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to add vendor';
            toast.error(message);
            return null;
        }
    }, [fetchVendors]);

    const fetchPurchaseOrders = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await api.get<BackendPurchaseOrder[]>('/procurement/purchase-orders');
            const normalized = (response.data || []).map(normalizePurchaseOrder);
            setPurchaseOrders(normalized);
            setStats(buildStats(normalized));
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
            await api.post('/procurement/purchase-orders', payload);
            await fetchPurchaseOrders();
            toast.success('Purchase order created');
            return true;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to create purchase order';
            toast.error(message);
            return false;
        }
    }, [fetchPurchaseOrders]);

    const approvePO = useCallback(async (poId: number): Promise<boolean> => {
        try {
            await api.post(`/procurement/purchase-orders/${poId}/approve`);
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
            await api.post(`/procurement/purchase-orders/${poId}/reject`, {});
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
        fetchVendors();
    }, [fetchPurchaseOrders, fetchVendors]);

    return {
        purchaseOrders,
        vendors,
        stats,
        isLoading,
        error,
        refresh: fetchPurchaseOrders,
        createPO,
        createVendor,
        approvePO,
        rejectPO,
        receivePO,
        cancelPO,
    };
}

export default useProcurement;
