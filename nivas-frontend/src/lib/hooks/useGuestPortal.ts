'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

interface GuestSession {
    id: string;
    guestName: string;
    roomNumber: string;
    checkInDate: string;
    checkOutDate: string;
    bookingId: string;
}

interface GuestBill {
    id: string;
    category: string;
    description: string;
    amount: number;
    date: string;
    status: 'PENDING' | 'PAID';
}

interface MenuItem {
    id: string;
    name: string;
    description?: string;
    price: number;
    category: string;
    available: boolean;
    image?: string;
}

interface ServiceRequest {
    id: string;
    type: 'HOUSEKEEPING' | 'ROOM_SERVICE' | 'MAINTENANCE';
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
    notes?: string;
    createdAt: string;
}

/**
 * Hook for guest portal functionality
 */
export function useGuestPortal() {
    const [session, setSession] = useState<GuestSession | null>(null);
    const [bills, setBills] = useState<GuestBill[]>([]);
    const [menu, setMenu] = useState<MenuItem[]>([]);
    const [requests, setRequests] = useState<ServiceRequest[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Login with PIN (last 4 digits of phone)
    const loginWithPin = async (roomNumber: string, pin: string): Promise<boolean> => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await api.post<{ session: GuestSession; token: string }>('/guest/login', {
                roomNumber,
                pin,
            });

            if (response.data) {
                const serverData = response.data as any;
                const sessionData: GuestSession = {
                    id: serverData.room?.id || serverData.id || '',
                    guestName: serverData.guestName || serverData.room?.guestName || 'Guest',
                    roomNumber: serverData.room?.number || serverData.roomNumber || roomNumber,
                    checkInDate: serverData.checkInDate || serverData.room?.checkInDate || '',
                    checkOutDate: serverData.checkOutDate || serverData.room?.checkOutDate || '',
                    bookingId: serverData.bookingId || serverData.room?.bookingId || '',
                };

                setSession(sessionData);
                setIsAuthenticated(true);
                // Store guest token
                localStorage.setItem('guest_token', response.data.token);
                // Set token in API client
                // Note: api.ts reads from localStorage 'nivas_auth_token', but we use 'guest_token'.
                // We might need to handle this. For now let's assume api.ts checks both or we use one key.
                // Actually best to set it as the main token for this session context.
                if (typeof window !== 'undefined') {
                    localStorage.setItem('nivas_auth_token', response.data.token);
                }
                return true;
            }
            return false;
        } catch (err: any) {
            setError(err.message || 'Invalid PIN or room number');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch guest bills
    const fetchBills = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            // Using billing controller endpoint
            const response = await api.get<any>('/billing/guest/my-bill');
            if (response.data) {
                // Transform backend response to GuestBill[]
                // Backend returns { financials: { total, paid, due }, orders: [], payments: [] }
                // We need to flatten this for the UI list
                const billItems: GuestBill[] = [];

                // Add orders
                response.data.orders.forEach((o: any) => {
                    billItems.push({
                        id: o.orderNumber,
                        category: 'FOOD',
                        description: `Order #${o.orderNumber} (${o.items} items)`,
                        amount: o.amount,
                        date: new Date().toISOString(), // Date not in summary
                        status: 'PENDING'
                    });
                });

                setBills(billItems);
            }
        } catch (err) {
            console.error('Failed to fetch bills:', err);
        }
    }, [isAuthenticated]);

    // Fetch menu
    const fetchMenu = useCallback(async () => {
        try {
            const response = await api.get<MenuItem[]>('/guest/actions/menu');
            setMenu(response.data || []);
        } catch (err) {
            console.error('Failed to fetch menu:', err);
        }
    }, []);

    // Fetch service requests (using orders endpoint as proxy)
    const fetchRequests = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            const response = await api.get<any[]>('/guest/actions/orders');
            if (response.data && Array.isArray(response.data)) {
                const serviceRequests: ServiceRequest[] = response.data.map((order: any) => ({
                    id: order.id || order.orderNumber,
                    type: order.type || 'ROOM_SERVICE',
                    status: order.status === 'SERVED' || order.status === 'COMPLETED' ? 'COMPLETED'
                        : order.status === 'PREPARING' || order.status === 'IN_PROGRESS' ? 'IN_PROGRESS'
                        : 'PENDING',
                    notes: order.notes,
                    createdAt: order.createdAt || new Date().toISOString(),
                }));
                setRequests(serviceRequests);
            }
        } catch {
            setRequests([]);
        }
    }, [isAuthenticated]);

    // Load data when authenticated
    useEffect(() => {
        if (isAuthenticated) {
            fetchBills();
            fetchMenu();
            fetchRequests();
        }
    }, [isAuthenticated, fetchBills, fetchMenu, fetchRequests]);

    // Place food order
    const placeOrder = async (items: { menuItemId: string; quantity: number }[], deliveryTo: 'ROOM' | 'RESTAURANT', notes?: string): Promise<boolean> => {
        try {
            await api.post('/guest/actions/order', {
                items: items.map(i => ({
                    menuItemId: parseInt(i.menuItemId),
                    quantity: i.quantity,
                    notes: notes
                }))
            });
            await fetchBills();
            return true;
        } catch (err: any) {
            setError(err.message || 'Failed to place order');
            return false;
        }
    };

    // Request housekeeping
    const requestHousekeeping = async (notes?: string): Promise<boolean> => {
        try {
            await api.post('/guest/actions/request-housekeeping', {
                taskType: 'CLEANING', // Default to cleaning
                notes,
            });
            return true;
        } catch (err: any) {
            setError(err.message || 'Failed to submit request');
            return false;
        }
    };

    // Request room service - Reuse housekeeping or order endpoint? 
    // Backend has request-housekeeping. For general "Room Service" (non-food), better use that or a new endpoint.
    // We'll map to request-housekeeping with maintenance type for now or cleaning
    const requestRoomService = async (notes?: string): Promise<boolean> => {
        try {
            await api.post('/guest/actions/request-housekeeping', {
                taskType: 'AMENITIES',
                notes,
            });
            return true;
        } catch (err: any) {
            setError(err.message || 'Failed to submit request');
            return false;
        }
    };

    // Request checkout
    const requestCheckout = async (): Promise<boolean> => {
        try {
            await api.post('/guest/actions/request-checkout');
            return true;
        } catch (err: any) {
            setError(err.message || 'Failed to request checkout');
            return false;
        }
    };

    // Logout
    const logout = () => {
        setSession(null);
        setIsAuthenticated(false);
        setBills([]);
        setRequests([]);
        localStorage.removeItem('guest_token');
    };

    // Calculate totals
    const totalSpent = bills.reduce((sum, bill) => sum + bill.amount, 0);
    const pendingAmount = bills.filter(b => b.status === 'PENDING').reduce((sum, b) => sum + b.amount, 0);

    // Group menu by category
    const menuByCategory = menu.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category]!.push(item);
        return acc;
    }, {} as Record<string, MenuItem[]>);

    return {
        session,
        isAuthenticated,
        isLoading,
        error,
        bills,
        menu,
        menuByCategory,
        requests,
        totalSpent,
        pendingAmount,
        loginWithPin,
        placeOrder,
        requestHousekeeping,
        requestRoomService,
        requestCheckout,
        logout,
        fetchBills,
        fetchMenu,
        fetchRequests,
    };
}

export default useGuestPortal;
