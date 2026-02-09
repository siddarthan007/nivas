import { useState, useCallback } from 'react';
import api from '../api';
import { toast } from 'sonner';
import type { Order, CreateOrderPayload, OrderStatus } from '../types/api.types';

export function useOrders() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchOrders = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await api.get<Order[]>('/orders');
            setOrders(res.data || []);
        } catch (err: any) {
            const msg = err?.response?.data?.message || err.message || 'Failed to fetch orders';
            setError(msg);
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createOrder = async (data: CreateOrderPayload) => {
        setIsLoading(true);
        try {
            await api.post('/orders', data);
            await fetchOrders();
            toast.success('Order created successfully');
            return true;
        } catch (err: any) {
            const msg = err?.response?.data?.message || err.message || 'Failed to create order';
            toast.error(msg);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const updateOrderStatus = async (id: string, status: OrderStatus) => {
        setIsLoading(true);
        try {
            await api.patch(`/orders/${id}/status`, { status });
            await fetchOrders();
            toast.success(`Order marked as ${(status || '').toLowerCase()}`);
            return true;
        } catch (err: any) {
            const msg = err?.response?.data?.message || err.message || 'Failed to update order status';
            toast.error(msg);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const cancelOrder = async (id: string, reason?: string) => {
        setIsLoading(true);
        try {
            await api.post(`/orders/${id}/cancel`, { reason });
            await fetchOrders();
            toast.success('Order cancelled');
            return true;
        } catch (err: any) {
            const msg = err?.response?.data?.message || err.message || 'Failed to cancel order';
            toast.error(msg);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const updateOrder = async (id: string, data: any) => {
        setIsLoading(true);
        try {
            await api.patch(`/orders/${id}`, data);
            await fetchOrders();
            toast.success('Order updated');
            return true;
        } catch (err: any) {
            const msg = err?.response?.data?.message || err.message || 'Failed to update order';
            toast.error(msg);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        orders,
        isLoading,
        error,
        fetchOrders,
        createOrder,
        updateOrderStatus,
        cancelOrder,
        updateOrder
    };
}
