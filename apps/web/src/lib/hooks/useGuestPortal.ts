'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import { toast } from 'sonner';
import { useGuestSocket } from '@/lib/hooks/useGuestSocket';

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
    status: 'PENDING' | 'PAID' | 'BILLED';
}

export interface GuestBillSummary {
    roomCharge: number;
    ordersTotal: number;
    subTotal: number;
    serviceCharge: number;
    serviceChargeRate: number;
    vat: number;
    taxRate: number;
    grandTotal: number;
    paidAmount: number;
    dueAmount: number;
    pendingOrdersTotal: number;
}

export interface PortalConfig {
    hotelName: string;
    hotelPhone?: string;
    hotelEmail?: string;
    hotelAddress?: string;
    welcomeMessage: string;
    wifiNetworks: { floor: string; ssid: string; password: string }[];
    contactNumbers: Record<string, string>;
    socialLinks: Record<string, string>;
    customSections: { title: string; content: string }[];
    showBillBreakdown: boolean;
    showOrderProgress: boolean;
    dndEnabled?: boolean;
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

/** Unified activity item: a food order OR a service (housekeeping/amenity) request. */
export interface ActivityItem {
    id: string;
    kind: 'ORDER' | 'SERVICE';
    type: string;
    status: string;
    orderNumber?: string;
    totalAmount?: number;
    notes?: string;
    createdAt: string;
    items: { name: string; quantity: number; price: number }[];
}

function saveGuestSession(session: GuestSession, token: string) {
    try {
        localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session));
        localStorage.setItem('guest_token', token);
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
    const [billSummary, setBillSummary] = useState<GuestBillSummary | null>(null);
    const [portalConfig, setPortalConfig] = useState<PortalConfig | null>(null);
    const [menuByCategory, setMenuByCategory] = useState<Record<string, MenuItem[]>>({});
    const [requests, setRequests] = useState<ActivityItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGuestAuthFailure = useCallback((message = 'Your stay has ended. Please contact the front desk if you need help.') => {
        clearGuestSession();
        setSession(null);
        setIsAuthenticated(false);
        setBills([]);
        setBillSummary(null);
        setPortalConfig(null);
        setMenuByCategory({});
        setRequests([]);
        setError(message);
    }, []);

    const guestSocket = useGuestSocket({ enabled: isAuthenticated });

    // Restore session on mount — then verify the stay is still active server-side.
    useEffect(() => {
        const saved = loadGuestSession();
        if (!saved) {
            setIsLoading(false);
            return;
        }

        setSession(saved.session);
        setIsAuthenticated(true);

        api.get<{
            guestName?: string;
            roomNumber?: number;
            checkInDate?: string | null;
            checkOutDate?: string | null;
            bookingId?: string | null;
        }>('/guest/actions/session')
            .then(res => {
                const d = res.data;
                if (!d) return;
                setSession(prev => prev ? {
                    ...prev,
                    guestName: d.guestName || prev.guestName,
                    roomNumber: d.roomNumber != null ? String(d.roomNumber) : prev.roomNumber,
                    checkInDate: d.checkInDate || prev.checkInDate,
                    checkOutDate: d.checkOutDate || prev.checkOutDate,
                    bookingId: d.bookingId || prev.bookingId,
                } : prev);
            })
            .catch(() => {
                handleGuestAuthFailure();
            })
            .finally(() => setIsLoading(false));
    }, [handleGuestAuthFailure]);

    const loginWithPin = async (roomNumber: string, pin: string, hotelSlug?: string): Promise<boolean> => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await api.post<any>('/guest/login', { roomNumber, pin, hotelSlug });

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

    // Fetch guest bill (itemized line items + authoritative summary totals)
    const fetchBills = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            const response = await api.get<any>('/billing/guest/my-bill');
            const d = response.data;
            if (d) {
                const items: GuestBill[] = (d.lineItems || []).map((li: any) => ({
                    id: String(li.id),
                    category: String(li.category || 'OTHER'),
                    description: String(li.description || ''),
                    amount: Number(li.amount) || 0,
                    date: li.date || new Date().toISOString(),
                    status: li.status === 'BILLED' ? 'BILLED' : 'PENDING',
                }));
                setBills(items);
                setBillSummary({
                    roomCharge: Number(d.roomCharge) || 0,
                    ordersTotal: Number(d.ordersTotal) || 0,
                    subTotal: Number(d.subTotal) || 0,
                    serviceCharge: Number(d.serviceCharge) || 0,
                    serviceChargeRate: Number(d.serviceChargeRate) || 0,
                    vat: Number(d.vat) || 0,
                    taxRate: Number(d.taxRate) || 0,
                    grandTotal: Number(d.grandTotal) || 0,
                    paidAmount: Number(d.paidAmount) || 0,
                    dueAmount: Number(d.dueAmount) || 0,
                    pendingOrdersTotal: Number(d.pendingOrdersTotal) || 0,
                });
            }
        } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
                handleGuestAuthFailure();
                return;
            }
            console.error('Failed to fetch bills:', err);
        }
    }, [isAuthenticated, handleGuestAuthFailure]);

    const fetchMenu = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            const response = await api.get<Record<string, unknown>>('/guest/actions/menu');
            setMenuByCategory(normalizeMenuByCategory(response.data));
        } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
                handleGuestAuthFailure();
                return;
            }
            console.error('Failed to fetch menu:', err);
        }
    }, [isAuthenticated, handleGuestAuthFailure]);

    // Fetch unified activity feed (food orders + service requests) for live tracking
    const fetchRequests = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            const response = await api.get<any[]>('/guest/actions/activity');
            if (Array.isArray(response.data)) {
                setRequests(response.data.map((a: any): ActivityItem => ({
                    id: String(a.id),
                    kind: a.kind === 'SERVICE' ? 'SERVICE' : 'ORDER',
                    type: String(a.type || (a.kind === 'SERVICE' ? 'CLEANING' : 'ROOM_SERVICE')),
                    status: String(a.status || 'PENDING'),
                    orderNumber: a.orderNumber ? String(a.orderNumber) : undefined,
                    totalAmount: a.totalAmount != null ? Number(a.totalAmount) : undefined,
                    notes: a.notes || undefined,
                    createdAt: a.createdAt || new Date().toISOString(),
                    items: Array.isArray(a.items)
                        ? a.items.map((i: any) => ({ name: String(i.name || 'Item'), quantity: Number(i.quantity) || 1, price: Number(i.price) || 0 }))
                        : [],
                })));
            }
        } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
                handleGuestAuthFailure();
                return;
            }
            setRequests([]);
        }
    }, [isAuthenticated, handleGuestAuthFailure]);

    const fetchPortalConfig = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            const response = await api.get<PortalConfig>('/guest/actions/portal-config');
            if (response.data) setPortalConfig(response.data);
        } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
                handleGuestAuthFailure();
                return;
            }
            setPortalConfig(null);
        }
    }, [isAuthenticated, handleGuestAuthFailure]);

    // Load data when authenticated
    useEffect(() => {
        if (isAuthenticated) {
            fetchBills();
            fetchMenu();
            fetchRequests();
            fetchPortalConfig();
        }
    }, [isAuthenticated, fetchBills, fetchMenu, fetchRequests, fetchPortalConfig]);

    // Real-time updates via WebSocket (orders, services, bill) — no polling.
    useEffect(() => {
        if (!isAuthenticated || guestSocket.status !== 'connected') return;

        const unsubs = [
            guestSocket.on('GUEST_ORDER_UPDATE', (data) => {
                fetchRequests();
                fetchBills();
                const status = String(data.status || '').toUpperCase();
                const orderNum = data.orderNumber ? ` #${data.orderNumber}` : '';
                if (status === 'READY') {
                    toast.success(`Your order${orderNum} is ready!`);
                } else if (status === 'SERVED') {
                    toast.success(`Order${orderNum} has been served`);
                }
            }),
            guestSocket.on('GUEST_SERVICE_UPDATE', (data) => {
                fetchRequests();
                const status = String(data.status || '').toUpperCase();
                const taskType = String(data.taskType || 'service').toLowerCase().replace(/_/g, ' ');
                if (status === 'COMPLETED' || status === 'DONE') {
                    toast.success(`Your ${taskType} request is complete`);
                }
            }),
            guestSocket.on('GUEST_BILL_UPDATE', () => {
                fetchBills();
            }),
            guestSocket.on('GUEST_STAY_ENDED', () => {
                handleGuestAuthFailure();
                toast.info('You have been checked out. Thank you for staying with us!');
            }),
            guestSocket.on('ERROR', () => {
                handleGuestAuthFailure();
            }),
        ];

        return () => unsubs.forEach(unsub => unsub());
    }, [
        isAuthenticated,
        guestSocket.status,
        guestSocket.on,
        fetchRequests,
        fetchBills,
        handleGuestAuthFailure,
    ]);

    // Re-sync when the guest returns to the tab (covers brief disconnects).
    useEffect(() => {
        if (!isAuthenticated) return;
        const onVisible = () => {
            if (document.hidden) return;
            fetchRequests();
            fetchBills();
            fetchPortalConfig();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [isAuthenticated, fetchRequests, fetchBills, fetchPortalConfig]);

    // Place food order
    const placeOrder = async (items: { menuItemId: string; quantity: number; notes?: string }[], deliveryTo: 'ROOM' | 'RESTAURANT', orderNotes?: string): Promise<boolean> => {
        try {
            await api.post('/guest/actions/order', {
                items: items.map(i => ({
                    menuItemId: Number(i.menuItemId),
                    quantity: i.quantity,
                    notes: i.notes || undefined
                })),
                deliveryTo,
                notes: orderNotes || undefined,   // guest's order-level instructions (was dropped)
            });
            await fetchBills();
            await fetchRequests();
            toast.success('Order placed successfully');
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
                taskType: 'CLEANING',
                notes,
            });
            await fetchRequests();
            toast.success('Housekeeping request submitted');
            return true;
        } catch (err: any) {
            setError(err.message || 'Failed to submit request');
            return false;
        }
    };

    const submitFeedback = async (rating: number, comment?: string): Promise<boolean> => {
        try {
            await api.post('/guest/actions/feedback', { rating, comment: comment || undefined });
            toast.success('Thank you for your feedback');
            return true;
        } catch (err: any) {
            setError(err.message || 'Failed to submit feedback');
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
            await fetchRequests();
            toast.success('Amenity request submitted');
            return true;
        } catch (err: any) {
            setError(err.message || 'Failed to submit request');
            return false;
        }
    };

    const requestCheckout = async (): Promise<boolean> => {
        try {
            await api.post('/guest/actions/request-checkout');
            toast.success('Checkout request sent to front desk');
            return true;
        } catch (err: any) {
            setError(err.message || 'Failed to request checkout');
            return false;
        }
    };

    const toggleDnd = async (enabled: boolean): Promise<boolean> => {
        try {
            await api.patch('/guest/actions/dnd', { enabled });
            setPortalConfig(prev => prev ? { ...prev, dndEnabled: enabled } : prev);
            toast.success(enabled ? 'Do Not Disturb is on' : 'Do Not Disturb is off');
            return true;
        } catch (err: any) {
            setError(err.message || 'Failed to update DND');
            return false;
        }
    };

    const logout = () => {
        setSession(null);
        setIsAuthenticated(false);
        setBills([]);
        setBillSummary(null);
        setPortalConfig(null);
        setMenuByCategory({});
        setRequests([]);
        clearGuestSession();
    };

    // Calculate totals from the authoritative summary
    const totalSpent = billSummary?.grandTotal ?? 0;
    const pendingAmount = billSummary?.dueAmount ?? 0;

    return {
        session,
        isAuthenticated,
        isLoading,
        error,
        bills,
        billSummary,
        portalConfig,
        menuByCategory,
        requests,
        totalSpent,
        pendingAmount,
        loginWithPin,
        placeOrder,
        requestHousekeeping,
        submitFeedback,
        requestRoomService,
        requestCheckout,
        toggleDnd,
        logout,
        fetchBills,
        fetchMenu,
        fetchRequests,
        fetchPortalConfig,
        wsStatus: guestSocket.status,
    };
}

export default useGuestPortal;
