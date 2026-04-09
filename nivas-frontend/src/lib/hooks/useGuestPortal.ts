'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, tokenStorage } from '@/lib/api';

const GUEST_SESSION_KEY = 'nivas_guest_session';

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

function saveGuestSession(session: GuestSession, token: string) {
    try {
        localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session));
        localStorage.setItem('guest_token', token);
        tokenStorage.setToken(token);
    } catch { /* SSR / storage full */ }
}

function loadGuestSession(): { session: GuestSession; token: string } | null {
    try {
        const raw = localStorage.getItem(GUEST_SESSION_KEY);
        const token = localStorage.getItem('guest_token');
        if (!raw || !token) return null;
        return { session: JSON.parse(raw), token };
    } catch {
        return null;
    }
}

function clearGuestSession() {
    try {
        localStorage.removeItem(GUEST_SESSION_KEY);
        localStorage.removeItem('guest_token');
        tokenStorage.removeToken();
    } catch { /* safe */ }
}

/** Backend GET /guest/actions/menu returns { [category]: items[] }, not a flat array */
function normalizeMenuByCategory(raw: unknown): Record<string, MenuItem[]> {
    if (!raw || typeof raw !== 'object') return {};
    if (Array.isArray(raw)) {
        return raw.reduce((acc: Record<string, MenuItem[]>, item: any) => {
            const cat = String(item.category || 'Other');
            const menuItem: MenuItem = {
                id: String(item.id),
                name: String(item.name ?? ''),
                description: item.description,
                price: Number(item.price) || 0,
                category: cat,
                available: item.available !== false,
                image: item.imageUrl ?? item.image,
            };
            if (!acc[cat]) acc[cat] = [];
            acc[cat]!.push(menuItem);
            return acc;
        }, {});
    }
    const out: Record<string, MenuItem[]> = {};
    for (const [category, items] of Object.entries(raw as Record<string, unknown>)) {
        if (!Array.isArray(items)) continue;
        out[category] = items.map((item: any) => ({
            id: String(item.id),
            name: String(item.name ?? ''),
            description: item.description,
            price: Number(item.price) || 0,
            category,
            available: true,
            image: item.imageUrl ?? item.image,
        }));
    }
    return out;
}

/**
 * Hook for guest portal functionality
 */
export function useGuestPortal() {
    const [session, setSession] = useState<GuestSession | null>(null);
    const [bills, setBills] = useState<GuestBill[]>([]);
    const [menuByCategory, setMenuByCategory] = useState<Record<string, MenuItem[]>>({});
    const [requests, setRequests] = useState<ServiceRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Restore session on mount
    useEffect(() => {
        const saved = loadGuestSession();
        if (saved) {
            tokenStorage.setToken(saved.token);
            setSession(saved.session);
            setIsAuthenticated(true);
        }
        setIsLoading(false);
    }, []);

    const loginWithPin = async (roomNumber: string, pin: string): Promise<boolean> => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await api.post<any>('/guest/login', { roomNumber, pin });

            if (response.data) {
                const d = response.data;
                const token = d.token as string;
                if (!token) {
                    setError('Login succeeded but no token received');
                    return false;
                }

                const sessionData: GuestSession = {
                    id: String(d.room?.id ?? ''),
                    guestName: d.booking?.guestName ?? 'Guest',
                    roomNumber: String(d.room?.number ?? roomNumber),
                    checkInDate: d.booking?.checkInDate ?? '',
                    checkOutDate: d.booking?.checkOutDate ?? '',
                    bookingId: d.booking?.id ?? '',
                };

                saveGuestSession(sessionData, token);
                setSession(sessionData);
                setIsAuthenticated(true);
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

    const fetchMenu = useCallback(async () => {
        try {
            const response = await api.get<Record<string, unknown>>('/guest/actions/menu');
            setMenuByCategory(normalizeMenuByCategory(response.data));
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

    const logout = () => {
        setSession(null);
        setIsAuthenticated(false);
        setBills([]);
        setMenuByCategory({});
        setRequests([]);
        clearGuestSession();
    };

    // Calculate totals
    const totalSpent = bills.reduce((sum, bill) => sum + bill.amount, 0);
    const pendingAmount = bills.filter(b => b.status === 'PENDING').reduce((sum, b) => sum + b.amount, 0);

    return {
        session,
        isAuthenticated,
        isLoading,
        error,
        bills,
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
