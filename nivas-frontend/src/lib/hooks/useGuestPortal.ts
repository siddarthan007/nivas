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
    const [billSummary, setBillSummary] = useState<GuestBillSummary | null>(null);
    const [portalConfig, setPortalConfig] = useState<PortalConfig | null>(null);
    const [menuByCategory, setMenuByCategory] = useState<Record<string, MenuItem[]>>({});
    const [requests, setRequests] = useState<ActivityItem[]>([]);
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
            // No active booking / not checked in yet — keep bill empty.
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
        } catch {
            setRequests([]);
        }
    }, [isAuthenticated]);

    const fetchPortalConfig = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            const response = await api.get<PortalConfig>('/guest/actions/portal-config');
            if (response.data) setPortalConfig(response.data);
        } catch {
            setPortalConfig(null);
        }
    }, [isAuthenticated]);

    // Load data when authenticated
    useEffect(() => {
        if (isAuthenticated) {
            fetchBills();
            fetchMenu();
            fetchRequests();
            fetchPortalConfig();
        }
    }, [isAuthenticated, fetchBills, fetchMenu, fetchRequests, fetchPortalConfig]);

    // Live progress: guests have no websocket, so poll the activity feed + bill
    // while the portal is open and the tab is visible. This keeps order status
    // (Received -> Preparing -> Ready -> Served), service requests, and the
    // running bill up to date without a manual reload.
    useEffect(() => {
        if (!isAuthenticated) return;
        const POLL_MS = 15000;
        const tick = () => {
            if (typeof document !== 'undefined' && document.hidden) return;
            fetchRequests();
            fetchBills();
        };
        const interval = setInterval(tick, POLL_MS);
        // Refresh immediately when the guest returns to the tab.
        const onVisible = () => { if (!document.hidden) tick(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [isAuthenticated, fetchRequests, fetchBills]);

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
            await fetchRequests();
            return true;
        } catch (err: any) {
            setError(err.message || 'Failed to submit request');
            return false;
        }
    };

    const submitFeedback = async (rating: number, comment?: string): Promise<boolean> => {
        try {
            await api.post('/guest/actions/feedback', { rating, comment: comment || undefined });
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
        logout,
        fetchBills,
        fetchMenu,
        fetchRequests,
        fetchPortalConfig,
    };
}

export default useGuestPortal;
