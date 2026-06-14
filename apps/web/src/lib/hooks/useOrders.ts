import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api, { ApiError } from '../api';
import { toast } from 'sonner';
import type { Order, CreateOrderPayload, OrderStatus } from '../types/api.types';
import { queryKeys } from '@/lib/queries/keys';

function getErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof ApiError) return err.message;
    if (err instanceof Error) return err.message;
    return fallback;
}

export function useOrders() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState<string | undefined>();
    const [mutationLoading, setMutationLoading] = useState(false);

    const { data, isLoading, error } = useQuery({
        queryKey: queryKeys.orders.list({ search }),
        queryFn: async () => {
            const qs = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
            const res = await api.get<Order[]>(`/orders${qs}`);
            return res.data ?? [];
        },
    });

    const orders = data ?? [];

    const invalidateOrders = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
    }, [queryClient]);

    const fetchOrders = useCallback((nextSearch?: string) => {
        setSearch(nextSearch);
    }, []);

    const createOrder = async (payload: CreateOrderPayload) => {
        setMutationLoading(true);
        try {
            const res = await api.post<{ data: Order }>('/orders', payload);
            invalidateOrders();
            toast.success('Order created successfully');
            return res.data || null;
        } catch (err: unknown) {
            const msg = getErrorMessage(err, 'Failed to create order');
            toast.error(msg);
            return null;
        } finally {
            setMutationLoading(false);
        }
    };

    const updateOrderStatus = async (id: string, status: OrderStatus) => {
        setMutationLoading(true);
        try {
            await api.patch<{ data: Order }>(`/orders/${id}/status`, { status });
            invalidateOrders();
            toast.success(`Order marked as ${(status || '').toLowerCase()}`);
            return true;
        } catch (err: unknown) {
            const msg = getErrorMessage(err, 'Failed to update order status');
            toast.error(msg);
            return false;
        } finally {
            setMutationLoading(false);
        }
    };

    const cancelOrder = async (id: string, reason?: string) => {
        setMutationLoading(true);
        try {
            await api.post<{ data: Order }>(`/orders/${id}/cancel`, { reason });
            invalidateOrders();
            toast.success('Order cancelled');
            return true;
        } catch (err: unknown) {
            const msg = getErrorMessage(err, 'Failed to cancel order');
            toast.error(msg);
            return false;
        } finally {
            setMutationLoading(false);
        }
    };

    const updateOrder = async (id: string, payload: unknown) => {
        setMutationLoading(true);
        try {
            await api.patch<{ data: Order }>(`/orders/${id}`, payload);
            invalidateOrders();
            toast.success('Order updated');
            return true;
        } catch (err: unknown) {
            const msg = getErrorMessage(err, 'Failed to update order');
            toast.error(msg);
            return false;
        } finally {
            setMutationLoading(false);
        }
    };

    const addItemsToOrder = async (id: string, items: { menuItemId: number; quantity: number; price: number; notes?: string }[]) => {
        setMutationLoading(true);
        try {
            const res = await api.post<{ data: { order: Order; newItems: unknown[] } }>(`/orders/${id}/items`, { items });
            invalidateOrders();
            toast.success('Items added to order');
            return res.data || null;
        } catch (err: unknown) {
            const msg = getErrorMessage(err, 'Failed to add items');
            toast.error(msg);
            return null;
        } finally {
            setMutationLoading(false);
        }
    };

    const updateOrderItem = async (orderId: string, itemId: number, payload: { quantity?: number; notes?: string }) => {
        setMutationLoading(true);
        try {
            await api.patch(`/orders/${orderId}/items/${itemId}`, payload);
            invalidateOrders();
            toast.success('Item updated');
            return true;
        } catch (err: unknown) {
            const msg = getErrorMessage(err, 'Failed to update item');
            toast.error(msg);
            return false;
        } finally {
            setMutationLoading(false);
        }
    };

    const syncOrderItems = async (id: string, items: { menuItemId: number; quantity: number; price: number; notes?: string }[]) => {
        setMutationLoading(true);
        try {
            const res = await api.put<{ data: { order: Order; newItems: unknown[] } }>(`/orders/${id}/items`, { items });
            invalidateOrders();
            toast.success('Order items synced');
            return res.data || null;
        } catch (err: unknown) {
            const msg = getErrorMessage(err, 'Failed to sync items');
            toast.error(msg);
            return null;
        } finally {
            setMutationLoading(false);
        }
    };

    return {
        orders,
        isLoading: isLoading || mutationLoading,
        error: error instanceof Error ? error.message : null,
        fetchOrders,
        createOrder,
        updateOrderStatus,
        cancelOrder,
        updateOrder,
        addItemsToOrder,
        updateOrderItem,
        syncOrderItems,
    };
}
