/**
 * Kitchen Display System API Hook
 * Connects to /orders/kot endpoints + WebSocket real-time events
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { api, ApiError } from '@/lib/api';
import { toast } from 'sonner';
import { useSocket } from './useSocket';

export interface KitchenOrder {
    id: number;
    orderNumber: string;
    tableNumber?: string;
    roomNumber?: string;
    orderType: 'DINE_IN' | 'ROOM_SERVICE' | 'TAKEAWAY';
    status: 'PENDING' | 'PREPARING' | 'READY' | 'SERVED';
    priority: 'NORMAL' | 'RUSH' | 'VIP';
    items: KitchenOrderItem[];
    createdAt: string;
    estimatedTime?: number;
    notes?: string;
}

export interface KitchenOrderItem {
    id: number;
    name: string;
    quantity: number;
    modifiers?: string[];
    status: 'PENDING' | 'PREPARING' | 'READY';
}

export interface UseKitchenReturn {
    orders: KitchenOrder[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    updateOrderStatus: (orderId: number, status: KitchenOrder['status']) => Promise<boolean>;
    updateItemStatus: (orderId: number, itemId: number, status: KitchenOrderItem['status']) => Promise<boolean>;
    socketStatus: string;
}

export function useKitchen(): UseKitchenReturn {
    const [orders, setOrders] = useState<KitchenOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { status: socketStatus, on } = useSocket();
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const fetchOrders = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await api.get<KitchenOrder[]>('/orders?status=PENDING,PREPARING,READY&type=kitchen');
            if (response.data) {
                setOrders(response.data);
            }
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to fetch kitchen orders';
            setError(message);
            console.error('[useKitchen]', e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const updateOrderStatus = useCallback(async (orderId: number, status: KitchenOrder['status']): Promise<boolean> => {
        try {
            await api.patch(`/orders/${orderId}/status`, { status });
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
            toast.success(`Order status updated to ${status}`);
            return true;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to update order status';
            toast.error(message);
            return false;
        }
    }, []);

    const updateItemStatus = useCallback(async (orderId: number, itemId: number, status: KitchenOrderItem['status']): Promise<boolean> => {
        try {
            await api.patch(`/orders/${orderId}/items/${itemId}`, { status });
            setOrders(prev => prev.map(o => {
                if (o.id !== orderId) return o;
                return {
                    ...o,
                    items: o.items.map(i => i.id === itemId ? { ...i, status } : i)
                };
            }));
            return true;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to update item status';
            toast.error(message);
            return false;
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    // WebSocket real-time events
    useEffect(() => {
        const unsubNew = on('KITCHEN_NEW_ORDER', (data: any) => {
            toast.info(`New order: #${data.orderNumber}`);
            // Play notification sound
            try {
                if (!audioRef.current) {
                    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ==');
                }
                audioRef.current.play().catch(() => { });
            } catch { }
            fetchOrders();
        });

        const unsubStatus = on('KITCHEN_ORDER_STATUS', (data: any) => {
            if (data.status === 'SERVED' || data.status === 'CANCELLED') {
                setOrders(prev => prev.filter(o => o.id !== data.orderId));
            } else {
                setOrders(prev => prev.map(o =>
                    o.id === data.orderId ? { ...o, status: data.status } : o
                ));
            }
        });

        return () => {
            unsubNew();
            unsubStatus();
        };
    }, [on, fetchOrders]);

    return {
        orders,
        isLoading,
        error,
        refresh: fetchOrders,
        updateOrderStatus,
        updateItemStatus,
        socketStatus
    };
}

export default useKitchen;

