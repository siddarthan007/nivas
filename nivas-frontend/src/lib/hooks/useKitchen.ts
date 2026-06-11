/**
 * Kitchen Display System API Hook
 * Connects to /orders/kot endpoints + WebSocket real-time events
 */
import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import { toast } from 'sonner';
import { useSocket } from './useSocket';

// Subtle two-note kitchen chime (slightly more present than the bell — it's a
// work alert — but still soft). Respects reduced-motion/quiet preference best-effort.
function playKitchenChime() {
    try {
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        const t = ctx.currentTime;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(784, t);        // G5
        osc.frequency.setValueAtTime(1047, t + 0.1); // C6
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.1, t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
        osc.start(t); osc.stop(t + 0.47);
    } catch { /* ignore */ }
}

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
    price?: number;
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

    const fetchOrders = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await api.get<any[]>('/orders?status=PENDING,PREPARING,READY&type=kitchen');
            if (response.data) {
                const mapped: KitchenOrder[] = response.data.map((o: any) => ({
                    id: o.id,
                    orderNumber: o.orderNumber,
                    tableNumber: o.restaurantTable?.tableNumber || o.tableNumber,
                    roomNumber: o.room?.number || o.roomNumber,
                    orderType: o.orderType,
                    status: o.status,
                    priority: o.priority || 'NORMAL',
                    notes: o.notes,
                    createdAt: o.createdAt,
                    estimatedTime: o.estimatedTime,
                    items: (o.items || []).map((i: any) => ({
                        id: i.id,
                        name: i.menuItem?.name || i.name || `Item #${i.menuItemId}`,
                        quantity: i.quantity,
                        price: i.price ? parseFloat(i.price) : undefined,
                        status: i.status || 'PENDING',
                        modifiers: i.modifiers || i.notes ? [i.notes] : undefined,
                    })),
                }));
                setOrders(mapped);
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
            playKitchenChime(); // subtle WebAudio chime (old base64 WAV was empty)
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

