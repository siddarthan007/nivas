'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { MenuItem, Room, CreateOrderPayload, OrderType } from '@/lib/types/api.types';
import type { GuestSearchResult } from '@/lib/services/guest.service';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { GuestSearchInput } from '@/components/features/guests/GuestSearchInput';
import FonepayQrPanel from '@/components/features/payments/FonepayQrPanel';
import { useLiveRefresh } from '@/lib/contexts/WebSocketContext';
import { normalizeEnabledPaymentMethods } from '@nivas/shared-utils';
import {
    Search,
    X,
    Plus,
    Minus,
    ShoppingCart,
    Trash2,
    CreditCard,
    User,
    Bed,
    UtensilsCrossed,
    Package,
    CheckCircle,
    ArrowLeft,
    LogOut,
    RefreshCw,
    ChefHat,
    QrCode,
    Printer,
    Banknote,
    Coins,
    List,
    GitMerge,
    Pencil,
} from 'lucide-react';

interface CartItem {
    menuItemId: number;
    name: string;
    price: number;
    quantity: number;
    notes: string;
}

interface TableOption {
    id: number;
    tableNumber: string;
    capacity: number;
    status: string;
    layoutProps?: { guestName?: string };
}

export default function POSPage() {
    const { user, logout } = useAuth();

    // Data states
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [tables, setTables] = useState<TableOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // UI states
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('ALL');
    const [orderType, setOrderType] = useState<OrderType>('DINE_IN');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [isPlacing, setIsPlacing] = useState(false);

    // Checkout fields
    const [customerName, setCustomerName] = useState('');
    const [selectedGuestId, setSelectedGuestId] = useState<string>('');
    const [selectedRoomId, setSelectedRoomId] = useState<string>('');
    const [selectedTableId, setSelectedTableId] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState('CASH');
    const [orderNotes, setOrderNotes] = useState('');
    const [addToGuestBill, setAddToGuestBill] = useState(true);
    // Amenity / extra-charge catalog → "charge to room" for room-service stays.
    const [amenities, setAmenities] = useState<{ id: number; name: string; price: number }[]>([]);
    const [amenityChargeId, setAmenityChargeId] = useState('');
    const [amenityChargeQty, setAmenityChargeQty] = useState('1');
    const [addingAmenityCharge, setAddingAmenityCharge] = useState(false);
    const [applyVat, setApplyVat] = useState(false);
    const [applyServiceCharge, setApplyServiceCharge] = useState(false);
    const [cashTendered, setCashTendered] = useState('');
    const [showReceipt, setShowReceipt] = useState(false);
    const [lastOrder, setLastOrder] = useState<any>(null);
    const [hotelName, setHotelName] = useState('Hotel');

    // Payment config (hotel-defined methods + Fonepay) and promo code.
    const [paymentMethods, setPaymentMethods] = useState<string[]>(['CASH', 'CARD', 'FONEPAY']);
    const [paymentQrs, setPaymentQrs] = useState<Record<string, { imageUrl?: string; label?: string }>>({});
    const [fonepayQr, setFonepayQr] = useState('');
    const [fonepayPrn, setFonepayPrn] = useState('');
    const [fonepayPaid, setFonepayPaid] = useState(false);
    const [couponCode, setCouponCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState<{ couponId: number; code: string; discount: number } | null>(null);
    const [couponLoading, setCouponLoading] = useState(false);

    const [editOrderId, setEditOrderId] = useState<string | null>(null);
    const [activeOrders, setActiveOrders] = useState<any[]>([]);
    const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
    const [selectedMergeSourceIds, setSelectedMergeSourceIds] = useState<string[]>([]);
    const [isActiveKotsModalOpen, setIsActiveKotsModalOpen] = useState(false);
    const [isCompModalOpen, setIsCompModalOpen] = useState(false);
    const [compReason, setCompReason] = useState('');
    const [compPassword, setCompPassword] = useState('');
    const [expandedNoteItemId, setExpandedNoteItemId] = useState<number | null>(null);

    // Moved editOrderId useEffect below loadOrderIntoCart

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [menuRes, roomsRes, tablesRes, payRes, amenRes] = await Promise.all([
                api.get<MenuItem[]>('/menu'),
                api.get<Room[]>('/rooms'),
                api.get<TableOption[]>('/operations/tables').catch(() => ({ data: [] })),
                api.get<{ enabledMethods: string[]; fonepay?: { qrString?: string }; paymentQrs?: Record<string, { imageUrl?: string; label?: string }> }>('/settings/payment').catch(() => ({ data: null })),
                api.get<{ id: number; name: string; price: number }[]>('/amenities?active=true').catch(() => ({ data: [] })),
            ]);
            setMenuItems(menuRes.data || []);
            setRooms(roomsRes.data || []);
            setTables(tablesRes.data || []);
            setAmenities((amenRes.data || []).map(a => ({ id: a.id, name: a.name, price: Number(a.price) })));
            const methods = normalizeEnabledPaymentMethods(payRes.data?.enabledMethods);
            const resolved = methods.length > 0 ? methods : ['CASH', 'CARD', 'FONEPAY'];
            setPaymentMethods(resolved);
            setPaymentQrs((payRes.data as any)?.paymentQrs || {});
            setFonepayQr(payRes.data?.fonepay?.qrString || '');
            setPaymentMethod(prev => (resolved.includes(prev) ? prev : resolved[0] || 'CASH'));

            // Fetch active orders to intelligently link them
            api.get<any[]>('/orders?status=PENDING,PREPARING,READY')
                .then(res => {
                    console.log('Active KOTs loaded:', res.data);
                    // res.data is the array returned from the backend
                    setActiveOrders(Array.isArray(res.data) ? res.data : []);
                })
                .catch((err) => {
                    console.error('Failed to load Active KOTs:', err);
                });
        } catch (err: any) {
            console.error('fetchData Promise.all error:', err);
            toast.error(`Failed to load POS data: ${err?.message || 'Unknown error'}`);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const refreshActiveOrders = useCallback(() => {
        api.get<any[]>('/orders?status=PENDING,PREPARING,READY')
            .then(res => setActiveOrders(Array.isArray(res.data) ? res.data : []))
            .catch(() => { /* silent */ });
    }, []);

    useLiveRefresh(useCallback((detail) => {
        const t = detail?.eventType;
        if (!t) return;
        if (['KITCHEN_NEW_ORDER', 'KITCHEN_ORDER_STATUS', 'NEW_ORDER', 'ORDER_CREATED', 'ORDER_READY'].includes(t)) {
            refreshActiveOrders();
        }
        if (t === 'PAYMENT_RECEIVED' || t.startsWith('LICENSE_')) {
            void fetchData();
        }
    }, [refreshActiveOrders, fetchData]));

    const handleMergeOrders = async () => {
        if (!selectedTableId || !selectedMergeSourceIds.length) return;
        const targetOrder = activeOrders.find(o => String(o.restaurantTableId) === String(selectedTableId));
        if (!targetOrder) { toast.error('Selected table has no active order to merge into'); return; }
        
        try {
            await api.post(`/orders/${targetOrder.id}/merge`, { sourceOrderIds: selectedMergeSourceIds });
            toast.success('Orders merged successfully');
            setIsMergeModalOpen(false);
            setSelectedMergeSourceIds([]);
            fetchData();
            clearCart();
        } catch (err: any) {
            toast.error(err?.message || 'Failed to merge orders');
        }
    };
    
    const handleCompOrder = async () => {
        if (!editOrderId) return;
        if (!compPassword) { toast.error('Password is required'); return; }
        try {
            await api.post(`/orders/${editOrderId}/comp`, { reason: compReason || 'Management comp', confirmPassword: compPassword });
            toast.success('Order made complimentary');
            setIsCompModalOpen(false);
            setCompPassword('');
            setCompReason('');
            setIsCheckoutOpen(false);
            clearCart();
            fetchData();
        } catch (err: any) {
            toast.error(err?.message || 'Failed to comp order');
        }
    };

    const loadOrderIntoCart = (order: any) => {
        setEditOrderId(order.id);
        if (order.restaurantTableId) {
            setOrderType('DINE_IN');
            setSelectedTableId(String(order.restaurantTableId));
            if (order.guestId) setSelectedGuestId(order.guestId);
        } else if (order.roomId) {
            setOrderType('ROOM_SERVICE');
            setSelectedRoomId(String(order.roomId));
            if (order.guestId) setSelectedGuestId(order.guestId);
        } else {
            setOrderType('TAKEAWAY');
            setCustomerName(order.customerName || '');
        }

        const newCart: CartItem[] = (order.items || []).map((i: any) => ({
            menuItemId: i.menuItemId,
            name: i.menuItem?.name || i.name || 'Unknown Item',
            price: parseFloat(i.price),
            quantity: i.quantity,
            notes: i.notes || ''
        }));
        setCart(newCart);
        
        // Load tax settings from the order
        setApplyVat(order.applyVat || false);
        setApplyServiceCharge(order.applyServiceCharge || false);
        
        setIsCheckoutOpen(false);
        setIsActiveKotsModalOpen(false);
        toast.success(`Loaded KOT #${order.orderNumber}`);
    };

    // Read editOrderId from URL if present and load it
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const orderId = searchParams.get('editOrderId');
        if (orderId) {
            console.log('Fetching orderId:', orderId);
            api.get<any>(`/orders/${orderId}`)
                .then(res => {
                    console.log('Order loaded:', res.data);
                    // res.data is the order object
                    if (res.data) {
                        loadOrderIntoCart(res.data);
                    }
                })
                .catch((err) => {
                    console.error('Failed to load editOrderId:', err);
                    toast.error('Failed to load order for editing');
                });
        }
    }, []);

    // Intelligently load active KOTs if selected table or room changes
    useEffect(() => {
        if (!activeOrders.length) return;
        
        let foundOrder = null;
        if (orderType === 'DINE_IN' && selectedTableId) {
            foundOrder = activeOrders.find(o => String(o.restaurantTableId) === selectedTableId);
        } else if (orderType === 'ROOM_SERVICE' && selectedRoomId) {
            foundOrder = activeOrders.find(o => String(o.roomId) === selectedRoomId);
        }

        if (foundOrder && foundOrder.id !== editOrderId) {
            setEditOrderId(foundOrder.id);
            setCustomerName(foundOrder.customerName || '');
            // Load items into cart
            if (foundOrder.items && Array.isArray(foundOrder.items)) {
                setCart(foundOrder.items.map((i: any) => ({
                    menuItemId: i.menuItemId,
                    name: i.menuItem?.name || `Item #${i.menuItemId}`,
                    price: parseFloat(i.price),
                    quantity: i.quantity,
                    notes: i.notes || ''
                })));
            }
            toast.success(`Loaded active KOT #${foundOrder.orderNumber}`);
        }
    }, [selectedTableId, selectedRoomId, orderType, activeOrders]);

    // Post an amenity (parking/damage/etc.) to the selected room's folio.
    const chargeAmenityToRoom = async (bookingId: string) => {
        if (!amenityChargeId || !bookingId) return;
        setAddingAmenityCharge(true);
        try {
            await api.post('/amenities/charge', { bookingId, amenityId: Number(amenityChargeId), quantity: Number(amenityChargeQty) || 1 });
            const a = amenities.find(x => x.id === Number(amenityChargeId));
            toast.success(`${a?.name || 'Charge'} added to room folio`);
            setAmenityChargeId('');
            setAmenityChargeQty('1');
        } catch (e: any) {
            toast.error(e?.message || 'Failed to add charge');
        } finally {
            setAddingAmenityCharge(false);
        }
    };

    // Derived data
    const categories = useMemo(() => {
        const cats = new Set(menuItems.map(i => i.category).filter(Boolean));
        return ['ALL', ...Array.from(cats)];
    }, [menuItems]);

    const filteredItems = useMemo(() => {
        return menuItems.filter(item => {
            const matchesSearch = (item.name || '').toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = activeCategory === 'ALL' || item.category === activeCategory;
            return matchesSearch && matchesCategory && item.isAvailable !== false;
        });
    }, [menuItems, searchQuery, activeCategory]);

    const occupiedRooms = useMemo(() =>
        rooms.filter(r => r.status === 'OCCUPIED' || r.currentBooking),
    [rooms]);

    const availableTables = useMemo(() =>
        tables.filter(t => t.status === 'AVAILABLE' || t.status === 'OCCUPIED'),
    [tables]);

    const subTotal = useMemo(() =>
        cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]);
    const serviceChargeRate = 0.10;
    const vatRate = 0.13;
    const serviceCharge = applyServiceCharge ? subTotal * serviceChargeRate : 0;
    const vatAmount = applyVat ? (subTotal + serviceCharge) * vatRate : 0;
    const grossTotal = subTotal + serviceCharge + vatAmount;
    const discount = appliedCoupon ? Math.min(appliedCoupon.discount, grossTotal) : 0;
    const cartTotal = Math.max(0, grossTotal - discount);

    // A coupon is validated against a specific total; drop it if the cart changes.
    useEffect(() => {
        if (appliedCoupon) { setAppliedCoupon(null); setCouponCode(''); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subTotal, applyVat, applyServiceCharge]);

    const applyCoupon = async () => {
        const code = couponCode.trim();
        if (!code) return;
        if (grossTotal <= 0) { toast.error('Add items first'); return; }
        setCouponLoading(true);
        try {
            const res = await api.post<{ couponId: number; code: string; discount: number }>(
                '/coupons/validate', { code, amount: grossTotal, scope: 'FNB' }
            );
            if (res.data?.discount != null) {
                setAppliedCoupon({ couponId: res.data.couponId, code: res.data.code, discount: res.data.discount });
                toast.success(`Coupon ${res.data.code} applied — NPR ${res.data.discount.toFixed(2)} off`);
            }
        } catch (e: any) {
            toast.error(e?.message || 'Invalid coupon');
            setAppliedCoupon(null);
        } finally {
            setCouponLoading(false);
        }
    };
    const removeCoupon = () => { setAppliedCoupon(null); setCouponCode(''); };

    const cartItemCount = useMemo(() =>
        cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]);

    // Cart actions
    const addToCart = (item: MenuItem) => {
        setCart(prev => {
            const existing = prev.find(c => c.menuItemId === item.id);
            if (existing) {
                return prev.map(c =>
                    c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c
                );
            }
            return [...prev, {
                menuItemId: item.id!,
                name: item.name,
                price: Number(item.price),
                quantity: 1,
                notes: ''
            }];
        });
    };

    const updateQty = (menuItemId: number, delta: number) => {
        setCart(prev => prev.map(c => {
            if (c.menuItemId !== menuItemId) return c;
            const newQty = c.quantity + delta;
            return newQty <= 0 ? null : { ...c, quantity: newQty };
        }).filter(Boolean) as CartItem[]);
    };

    const removeFromCart = (menuItemId: number) => {
        setCart(prev => prev.filter(c => c.menuItemId !== menuItemId));
    };

    const clearCart = () => {
        setCart([]);
        setCustomerName('');
        setSelectedGuestId('');
        setSelectedRoomId('');
        setSelectedTableId('');
        setOrderNotes('');
        setApplyVat(false);
        setApplyServiceCharge(false);
        setAppliedCoupon(null);
        setCouponCode('');
        setEditOrderId(null);
    };

    const placeOrder = async () => {
        if (cart.length === 0) {
            toast.error('Cart is empty');
            return;
        }
        // Block finalizing a cash sale with insufficient tender (if entered).
        if (paymentMethod === 'CASH' && cashTendered.trim() && parseFloat(cashTendered) < cartTotal) {
            toast.error(`Cash tendered (NPR ${parseFloat(cashTendered || '0').toFixed(2)}) is less than the total NPR ${cartTotal.toFixed(2)}`);
            return;
        }
        if (paymentMethod === 'FONEPAY' && cartTotal > 0 && !fonepayPaid) {
            toast.error('Please wait for Fonepay payment confirmation before completing the order');
            return;
        }
        setIsPlacing(true);

        const selectedRoom = orderType === 'ROOM_SERVICE' ? rooms.find(r => String(r.id) === selectedRoomId) : undefined;

        const payload: CreateOrderPayload = {
            orderType,
            customerName: customerName || undefined,
            roomId: orderType === 'ROOM_SERVICE' && selectedRoomId ? Number(selectedRoomId) : undefined,
            bookingId: selectedRoom?.currentBooking?.id,
            guestId: orderType === 'DINE_IN' && selectedGuestId ? selectedGuestId : undefined,
            restaurantTableId: orderType === 'DINE_IN' && selectedTableId ? Number(selectedTableId) : undefined,
            items: cart.map(c => ({
                menuItemId: c.menuItemId,
                quantity: c.quantity,
                price: c.price,
                notes: c.notes || undefined,
            })),
            notes: orderNotes || undefined,
            addToGuestBill: orderType === 'ROOM_SERVICE' ? addToGuestBill : undefined,
            applyVat,
            applyServiceCharge,
            paymentMethod: paymentMethod !== 'UNPAID' ? paymentMethod : undefined,
            cashTendered: paymentMethod === 'CASH' ? parseFloat(cashTendered || '0') : undefined,
            ...(paymentMethod === 'FONEPAY' && fonepayPrn ? { transactionId: fonepayPrn } : {}),
            ...(appliedCoupon ? { discountAmount: discount, couponId: appliedCoupon.couponId } : {}),
        } as CreateOrderPayload & { discountAmount?: number; couponId?: number; notes?: string };

        try {
            if (editOrderId) {
                // Update existing order items and payment
                await api.patch(`/orders/${editOrderId}`, {
                    ...payload,
                    notes: orderNotes || undefined,
                });
                toast.success('Order items synced successfully');
                // Auto-print KOT for updates? We can do that if we want.
                try {
                    await api.post(`/orders/kot/print/${editOrderId}`);
                } catch {}
                
                // Keep the activeOrders state updated
                api.get<any[]>('/orders?status=PENDING,PREPARING,READY')
                    .then(res => setActiveOrders(Array.isArray(res.data) ? res.data : []));

                clearCart();
                setIsCheckoutOpen(false);
            } else {
                // Place new order
                const res = await api.post<{ id: string; orderNumber: string }>('/orders', payload);
                const orderData = res.data;
                toast.success('Order placed successfully');
                // Auto-print KOT
                try {
                    if (orderData?.id) await api.post(`/orders/kot/print/${orderData.id}`);
                } catch {}
                
                // Save receipt snapshot (capture table/room info before clearCart resets them)
                const snapshotTableName = orderType === 'DINE_IN' && selectedTableId
                    ? (tables.find(t => String(t.id) === String(selectedTableId))?.tableNumber || selectedTableId)
                    : undefined;
                const snapshotRoomName = orderType === 'ROOM_SERVICE' && selectedRoomId
                    ? (rooms.find(r => String(r.id) === String(selectedRoomId))?.number || selectedRoomId)
                    : undefined;
                setLastOrder({
                    orderNumber: orderData?.orderNumber || 'N/A',
                    items: [...cart],
                    subTotal,
                    serviceCharge,
                    vatAmount,
                    cartTotal,
                    paymentMethod,
                    cashTendered: paymentMethod === 'CASH' ? parseFloat(cashTendered || '0') : undefined,
                    customerName: customerName || 'Walk-in',
                    orderType,
                    createdAt: new Date().toISOString(),
                    tableName: snapshotTableName,
                    roomName: snapshotRoomName,
                });
                setShowReceipt(true);
                clearCart();
                setIsCheckoutOpen(false);
            }
        } catch (err: any) {
            toast.error(err?.message || 'Failed to place order');
        } finally {
            setIsPlacing(false);
        }
    };

    const printReceipt = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow || !lastOrder) return;
        const change = lastOrder.cashTendered ? lastOrder.cashTendered - lastOrder.cartTotal : 0;
        printWindow.document.write(`
            <html><head><title>Receipt ${lastOrder.orderNumber}</title>
            <style>
                body { font-family: monospace; max-width: 320px; margin: 0 auto; padding: 16px; }
                h2 { text-align: center; margin: 4px 0; font-size: 16px; }
                .center { text-align: center; font-size: 12px; color: #666; }
                .line { display: flex; justify-content: space-between; font-size: 13px; margin: 4px 0; }
                .total { border-top: 1px dashed #000; margin-top: 8px; padding-top: 8px; font-weight: bold; font-size: 14px; }
                .footer { text-align: center; margin-top: 16px; font-size: 11px; color: #666; }
            </style></head><body>
            <h2>${hotelName}</h2>
            <div class="center">Receipt #${lastOrder.orderNumber}</div>
            <div class="center">${new Date(lastOrder.createdAt).toLocaleString()}</div>
            <div class="center">${lastOrder.orderType.replace('_', ' ')} ${lastOrder.customerName ? `| ${lastOrder.customerName}` : ''}</div>
            ${lastOrder.tableName ? `<div class="center">Table: ${lastOrder.tableName}</div>` : ''}
            ${lastOrder.roomName ? `<div class="center">Room: ${lastOrder.roomName}</div>` : ''}
            <hr style="border: none; border-top: 1px dashed #000; margin: 8px 0;"/>
            ${lastOrder.items.map((i: any) => `<div class="line"><span>${i.quantity}x ${i.name}</span><span>NPR ${(i.price * i.quantity).toFixed(2)}</span></div>`).join('')}
            <div class="line total"><span>Subtotal</span><span>NPR ${lastOrder.subTotal.toFixed(2)}</span></div>
            ${lastOrder.serviceCharge > 0 ? `<div class="line"><span>Service Charge</span><span>NPR ${lastOrder.serviceCharge.toFixed(2)}</span></div>` : ''}
            ${lastOrder.vatAmount > 0 ? `<div class="line"><span>VAT</span><span>NPR ${lastOrder.vatAmount.toFixed(2)}</span></div>` : ''}
            <div class="line total"><span>GRAND TOTAL</span><span>NPR ${lastOrder.cartTotal.toFixed(2)}</span></div>
            <div class="line"><span>Payment</span><span>${lastOrder.paymentMethod}</span></div>
            ${lastOrder.cashTendered ? `<div class="line"><span>Tendered</span><span>NPR ${lastOrder.cashTendered.toFixed(2)}</span></div><div class="line"><span>Change</span><span>NPR ${Math.max(0, change).toFixed(2)}</span></div>` : ''}
            <div class="footer">${lastOrder.orderType === 'ROOM_SERVICE' ? 'Thank you! Enjoy your meal in your room!' : lastOrder.orderType === 'TAKEAWAY' ? 'Thank you! Enjoy your meal!' : 'Thank you for dining with us!'}</div>
            </body></html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    const handleBack = () => {
        window.location.href = '/hotel/orders';
    };

    // Styles
    const headerStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        backgroundColor: 'var(--notion-bg)',
        borderBottom: '1px solid var(--notion-border)',
        gap: '16px',
    };

    const categoryPill = (cat: string, active: boolean) => ({
        padding: '6px 14px',
        borderRadius: 'var(--radius-full)',
        fontSize: '13px',
        fontWeight: 500,
        cursor: 'pointer',
        border: '1px solid var(--notion-border)',
        backgroundColor: active ? 'var(--notion-blue)' : 'var(--notion-bg)',
        color: active ? 'var(--foreground-inverse)' : 'var(--notion-text)',
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap' as const,
    });

    if (isLoading) {
        return (
            <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--notion-bg)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    <div className="animate-spin" style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid var(--notion-border)', borderTopColor: 'var(--notion-blue)' }} />
                    <span style={{ fontSize: '14px', color: 'var(--notion-text-secondary)' }}>Loading POS...</span>
                </div>
            </div>
        );
    }

    return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--notion-bg-secondary)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={headerStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button onClick={handleBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--notion-text-secondary)', display: 'flex', alignItems: 'center' }}>
                        <ArrowLeft size={20} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-md)', background: 'var(--notion-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ChefHat size={18} color="var(--foreground-inverse)" />
                        </div>
                        <div>
                            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--notion-text)' }}>Nivas POS</div>
                            <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)' }}>{user?.name || 'Staff'}</div>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, justifyContent: 'center' }}>
                    <Button variant="secondary" onClick={() => setIsActiveKotsModalOpen(true)}>
                        <List size={16} style={{ marginRight: '6px' }} /> Active KOTs ({activeOrders.length})
                    </Button>
                    <Button variant="secondary" onClick={() => setIsMergeModalOpen(true)}>
                        <GitMerge size={16} style={{ marginRight: '6px' }} /> Merge Tables
                    </Button>
                    {/* Order Type Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-md)', padding: '3px', border: '1px solid var(--notion-border)' }}>
                        {(['DINE_IN', 'ROOM_SERVICE', 'TAKEAWAY'] as OrderType[]).map(type => (
                            <button
                                key={type}
                                onClick={() => { setOrderType(type); clearCart(); }}
                                style={{
                                    padding: '6px 14px',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    border: 'none',
                                    cursor: 'pointer',
                                    backgroundColor: orderType === type ? 'var(--notion-bg)' : 'transparent',
                                    color: orderType === type ? 'var(--notion-blue)' : 'var(--notion-text-secondary)',
                                    boxShadow: orderType === type ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                }}
                            >
                                {type === 'DINE_IN' ? 'Dine In' : type === 'ROOM_SERVICE' ? 'Room Service' : 'Takeaway'}
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div style={{ position: 'relative', width: '280px' }}>
                        <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--notion-text-secondary)' }} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search menu items..."
                            style={{
                                width: '100%',
                                padding: '8px 12px 8px 34px',
                                fontSize: '14px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--notion-border)',
                                backgroundColor: 'var(--notion-bg)',
                                color: 'var(--notion-text)',
                                outline: 'none',
                            }}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button onClick={fetchData} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--notion-text-secondary)', padding: '6px', borderRadius: '4px' }} className="hover-bg" title="Refresh">
                        <RefreshCw size={18} />
                    </button>
                    <button onClick={logout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--notion-text-secondary)', padding: '6px', borderRadius: '4px' }} className="hover-bg" title="Logout">
                        <LogOut size={18} />
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Menu Area */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* Category Tabs */}
                    <div style={{ display: 'flex', gap: '8px', padding: '12px 20px', overflowX: 'auto', borderBottom: '1px solid var(--notion-border)', background: 'var(--notion-bg)' }}>
                        {categories.map(cat => (
                            <button key={cat} onClick={() => setActiveCategory(cat)} style={categoryPill(cat, activeCategory === cat)}>
                                {cat === 'ALL' ? 'All Items' : cat}
                            </button>
                        ))}
                    </div>

                    {/* Items Grid */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                        {filteredItems.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--notion-text-secondary)' }}>
                                <Package size={40} style={{ marginBottom: '12px', opacity: 0.5 }} />
                                <div style={{ fontSize: '15px', fontWeight: 500 }}>No items found</div>
                                <div style={{ fontSize: '13px', marginTop: '4px' }}>Try adjusting your search or category filter</div>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                                {filteredItems.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => addToCart(item)}
                                        style={{
                                            background: 'var(--notion-bg)',
                                            border: '1px solid var(--notion-border)',
                                            borderRadius: 'var(--radius-lg)',
                                            padding: '14px',
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '6px',
                                            transition: 'transform 0.1s ease, box-shadow 0.1s ease',
                                            position: 'relative',
                                        }}
                                        className="hover-border-focus"
                                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                                    >
                                        {item.imageUrl ? (
                                            <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: 'var(--radius-md)', marginBottom: '4px' }} />
                                        ) : (
                                            <div style={{ width: '100%', height: '120px', background: 'var(--notion-bg-tertiary)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
                                                <UtensilsCrossed size={28} color="var(--notion-text-secondary)" />
                                            </div>
                                        )}
                                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--notion-text)', lineHeight: 1.3 }}>{item.name}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>
                                            {item.description || item.category}
                                        </div>
                                        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--notion-blue)' }}>NPR {Number(item.price).toFixed(0)}</span>
                                            <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--notion-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Plus size={14} color="var(--foreground-inverse)" />
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Cart Sidebar */}
                <div style={{
                    width: '360px',
                    background: 'var(--notion-bg)',
                    borderLeft: '1px solid var(--notion-border)',
                    display: 'flex',
                    flexDirection: 'column',
                }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--notion-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ShoppingCart size={18} color="var(--notion-blue)" />
                            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--notion-text)' }}>Cart</span>
                            {cartItemCount > 0 && (
                                <span style={{ fontSize: '11px', fontWeight: 600, background: 'var(--notion-blue)', color: 'var(--foreground-inverse)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                                    {cartItemCount}
                                </span>
                            )}
                        </div>
                        {cart.length > 0 && (
                            <button onClick={() => { if (confirm('Clear all items from cart?')) clearCart(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--notion-red)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Trash2 size={14} /> Clear
                            </button>
                        )}
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                        {cart.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--notion-text-secondary)' }}>
                                <ShoppingCart size={32} style={{ marginBottom: '8px', opacity: 0.4 }} />
                                <div style={{ fontSize: '13px' }}>Tap items to add to cart</div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {cart.map(item => (
                                    <div key={item.menuItemId} style={{ padding: '10px 12px', background: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--notion-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>NPR {item.price} each</div>
                                            </div>
                                            <button
                                                onClick={() => setExpandedNoteItemId(expandedNoteItemId === item.menuItemId ? null : item.menuItemId)}
                                                title="Item notes"
                                                style={{ width: '24px', height: '24px', borderRadius: '4px', border: 'none', background: item.notes ? 'var(--notion-blue-bg)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.notes ? 'var(--notion-blue)' : 'var(--notion-text-muted)', flexShrink: 0 }}
                                            >
                                                <Pencil size={12} />
                                            </button>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                                <button onClick={() => updateQty(item.menuItemId, -1)} style={{ width: '24px', height: '24px', borderRadius: '4px', border: '1px solid var(--notion-border)', background: 'var(--notion-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Minus size={12} />
                                                </button>
                                                <span style={{ fontSize: '14px', fontWeight: 600, minWidth: '24px', textAlign: 'center' }}>{item.quantity}</span>
                                                <button onClick={() => updateQty(item.menuItemId, 1)} style={{ width: '24px', height: '24px', borderRadius: '4px', border: '1px solid var(--notion-border)', background: 'var(--notion-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Plus size={12} />
                                                </button>
                                            </div>
                                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--notion-text)', minWidth: '56px', textAlign: 'right' }}>
                                                NPR {(item.price * item.quantity).toFixed(0)}
                                            </div>
                                            <button onClick={() => removeFromCart(item.menuItemId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--notion-text-muted)', padding: '2px' }}>
                                                <X size={14} />
                                            </button>
                                        </div>
                                        {expandedNoteItemId === item.menuItemId && (
                                            <input
                                                type="text"
                                                value={item.notes}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setCart(prev => prev.map(c => c.menuItemId === item.menuItemId ? { ...c, notes: val } : c));
                                                }}
                                                placeholder="Special instructions…"
                                                autoFocus
                                                style={{
                                                    width: '100%',
                                                    marginTop: '8px',
                                                    padding: '6px 10px',
                                                    fontSize: '12px',
                                                    border: '1px solid var(--notion-border)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    background: 'var(--notion-bg)',
                                                    color: 'var(--notion-text)',
                                                    outline: 'none',
                                                }}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Cart Footer */}
                    {cart.length > 0 && (
                        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--notion-border)', background: 'var(--notion-bg)' }}>
                            {/* Promo code */}
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                                <input
                                    value={couponCode}
                                    onChange={e => setCouponCode(e.target.value.toUpperCase())}
                                    onKeyDown={e => { if (e.key === 'Enter') applyCoupon(); }}
                                    placeholder="Promo code"
                                    disabled={!!appliedCoupon}
                                    style={{ flex: 1, padding: '8px 10px', fontSize: '13px', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', background: 'var(--notion-bg-secondary)', color: 'var(--notion-text)', textTransform: 'uppercase' }}
                                />
                                {appliedCoupon ? (
                                    <button onClick={removeCoupon} style={{ padding: '8px 12px', fontSize: '13px', border: '1px solid var(--notion-red)', color: 'var(--notion-red)', background: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>Remove</button>
                                ) : (
                                    <button onClick={applyCoupon} disabled={couponLoading || !couponCode.trim()} style={{ padding: '8px 12px', fontSize: '13px', border: '1px solid var(--notion-blue)', color: 'var(--notion-blue)', background: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>{couponLoading ? '…' : 'Apply'}</button>
                                )}
                            </div>
                            {discount > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px', color: 'var(--notion-green)' }}>
                                    <span>Discount ({appliedCoupon?.code})</span>
                                    <span>− NPR {discount.toFixed(2)}</span>
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <span style={{ fontSize: '14px', color: 'var(--notion-text-secondary)' }}>Total</span>
                                <span style={{ fontSize: '14px', fontWeight: 600 }}>NPR {cartTotal.toFixed(2)}</span>
                            </div>
                            <Button
                                onClick={() => setIsCheckoutOpen(true)}
                                fullWidth
                                style={{ padding: '12px', fontSize: '15px', fontWeight: 600 }}
                            >
                                <CreditCard size={16} style={{ marginRight: '6px' }} />
                                Checkout — NPR {cartTotal.toFixed(2)}
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Checkout Modal */}
            <Modal isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} title="Checkout" size="lg">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: '400px' }}>
                    {/* Order Type Indicator */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--notion-blue-bg)', borderRadius: 'var(--radius-md)', fontSize: '13px', color: 'var(--notion-blue)' }}>
                        {orderType === 'DINE_IN' && <UtensilsCrossed size={14} />}
                        {orderType === 'ROOM_SERVICE' && <Bed size={14} />}
                        {orderType === 'TAKEAWAY' && <Package size={14} />}
                        <span style={{ fontWeight: 600 }}>{orderType === 'DINE_IN' ? 'Dine In' : orderType === 'ROOM_SERVICE' ? 'Room Service' : 'Takeaway'}</span>
                    </div>

                    {/* Customer / Room / Table linking */}
                    {orderType === 'TAKEAWAY' && (
                        <div>
                            <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>Customer Name</label>
                            <Input
                                type="text"
                                value={customerName}
                                onChange={e => setCustomerName(e.target.value)}
                                placeholder="Walk-in customer"
                                fullWidth
                            />
                        </div>
                    )}

                    {orderType === 'ROOM_SERVICE' && (
                        <>
                            <SearchableSelect
                                label="Room *"
                                value={selectedRoomId || null}
                                onChange={val => {
                                    setSelectedRoomId(String(val));
                                    const room = rooms.find(r => String(r.id) === String(val));
                                    if (room?.currentBooking?.guestName) {
                                        setCustomerName(room.currentBooking.guestName);
                                    }
                                }}
                                placeholder="Select occupied room..."
                                searchPlaceholder="Search rooms..."
                                options={occupiedRooms.map(r => ({
                                    value: r.id,
                                    label: `Room ${r.number}`,
                                    subtitle: r.currentBooking?.guestName ? `Guest: ${r.currentBooking.guestName}` : (r.type || ''),
                                }))}
                            />
                            {customerName && (
                                <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                                    Guest: <strong style={{ color: 'var(--notion-text)' }}>{customerName}</strong>
                                </div>
                            )}
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--notion-text)', cursor: 'pointer' }}>
                                <input type="checkbox" checked={addToGuestBill} onChange={e => setAddToGuestBill(e.target.checked)} style={{ accentColor: 'var(--notion-blue)' }} />
                                Add to guest bill
                            </label>

                            {/* Charge an extra (parking/damage/etc.) to this room's folio */}
                            {(() => {
                                const room = rooms.find(r => String(r.id) === selectedRoomId);
                                const bookingId = room?.currentBooking?.id;
                                if (!bookingId || amenities.length === 0) return null;
                                return (
                                    <div style={{ borderTop: '1px solid var(--notion-border)', paddingTop: '10px' }}>
                                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>Charge Extra to Room</label>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <select value={amenityChargeId} onChange={e => setAmenityChargeId(e.target.value)} style={{ flex: 2, padding: '8px 10px', fontSize: '13px', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', background: 'var(--notion-bg)', color: 'var(--notion-text)' }}>
                                                <option value="">Select charge…</option>
                                                {amenities.map(a => <option key={a.id} value={a.id}>{a.name} — NPR {a.price.toFixed(2)}</option>)}
                                            </select>
                                            <Input type="number" min={1} value={amenityChargeQty} onChange={e => setAmenityChargeQty(e.target.value)} style={{ width: '64px' }} />
                                            <Button variant="secondary" onClick={() => chargeAmenityToRoom(bookingId)} disabled={addingAmenityCharge || !amenityChargeId}>{addingAmenityCharge ? '…' : 'Add'}</Button>
                                        </div>
                                    </div>
                                );
                            })()}
                        </>
                    )}

                    {orderType === 'DINE_IN' && (
                        <>
                            <SearchableSelect
                                label="Table *"
                                value={selectedTableId || null}
                                onChange={val => {
                                    setSelectedTableId(String(val));
                                    const table = tables.find(t => String(t.id) === String(val));
                                    if (table?.layoutProps?.guestName) {
                                        setCustomerName(table.layoutProps.guestName);
                                    }
                                }}
                                placeholder="Select table..."
                                searchPlaceholder="Search tables..."
                                options={availableTables.map(t => ({
                                    value: t.id,
                                    label: `Table ${t.tableNumber}`,
                                    subtitle: `${t.capacity} seats${t.status === 'OCCUPIED' ? ' — Occupied' : ''}${t.layoutProps?.guestName ? ` — ${t.layoutProps.guestName}` : ''}`,
                                }))}
                            />
                            <div>
                                <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>Attach Guest (optional)</label>
                                <GuestSearchInput
                                    onSelect={(guest: GuestSearchResult) => {
                                        setSelectedGuestId(guest.id);
                                        setCustomerName(guest.fullName);
                                    }}
                                    onAddNew={(name: string) => {
                                        setSelectedGuestId('');
                                        setCustomerName(name);
                                    }}
                                    placeholder="Search guest profile..."
                                    value={customerName}
                                />
                                {selectedGuestId && (
                                    <div style={{ fontSize: '12px', color: 'var(--notion-green)', marginTop: '4px' }}>
                                        Linked to guest profile
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Payment */}
                    <div>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>Payment Method</label>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {paymentMethods.map(method => {
                                const isQr = method === 'FONEPAY' || method === 'ESEWA' || method === 'KHALTI' || method === 'CONNECT_IPS';
                                const Icon = method === 'CASH' ? Banknote : isQr ? QrCode : CreditCard;
                                const label = method === 'FONEPAY' ? 'Fonepay' : method === 'BANK_TRANSFER' ? 'Bank' : method === 'CONNECT_IPS' ? 'ConnectIPS' : method.charAt(0) + method.slice(1).toLowerCase();
                                return (
                                    <button
                                        key={method}
                                        onClick={() => { setPaymentMethod(method); setFonepayPaid(false); setFonepayPrn(''); }}
                                        style={{
                                            flex: '1 0 30%',
                                            padding: '10px',
                                            borderRadius: 'var(--radius-md)',
                                            border: paymentMethod === method ? '2px solid var(--notion-blue)' : '1px solid var(--notion-border)',
                                            background: paymentMethod === method ? 'var(--notion-blue-bg)' : 'var(--notion-bg)',
                                            color: paymentMethod === method ? 'var(--notion-blue)' : 'var(--notion-text)',
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <Icon size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Fonepay / wallet QR */}
                    {paymentMethod === 'FONEPAY' && cartTotal > 0 ? (
                        <>
                            <FonepayQrPanel
                                amount={cartTotal}
                                remarks={`POS ${orderType}`}
                                onPaid={(prn) => { setFonepayPrn(prn); setFonepayPaid(true); }}
                            />
                        </>
                    ) : (paymentMethod === 'ESEWA' || paymentMethod === 'KHALTI' || paymentMethod === 'CONNECT_IPS') && (
                        <div style={{ padding: '16px', background: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                            {paymentQrs[paymentMethod]?.imageUrl ? (
                                <img src={paymentQrs[paymentMethod]!.imageUrl} alt={`${paymentMethod} QR`} style={{ height: 160, maxWidth: '100%', objectFit: 'contain', marginBottom: 8 }} />
                            ) : (
                                <QrCode size={80} style={{ color: 'var(--notion-text)', marginBottom: '8px' }} />
                            )}
                            <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>{paymentQrs[paymentMethod]?.label || `Scan ${paymentMethod} to pay NPR ${cartTotal.toFixed(2)}`}</div>
                        </div>
                    )}

                    {/* Cash Tendered */}
                    {paymentMethod === 'CASH' && (
                        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>Cash Tendered</label>
                                <Input type="number" min={0} step="0.01" value={cashTendered} onChange={e => setCashTendered(e.target.value)} placeholder="0.00" />
                            </div>
                            {parseFloat(cashTendered || '0') >= cartTotal && (
                                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--notion-green)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Coins size={14} /> Change: NPR {(parseFloat(cashTendered || '0') - cartTotal).toFixed(2)}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Notes */}
                    <div>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>Order Notes</label>
                        <textarea
                            value={orderNotes}
                            onChange={e => setOrderNotes(e.target.value)}
                            placeholder="Any special instructions..."
                            rows={2}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                fontSize: '14px',
                                border: '1px solid var(--notion-border)',
                                borderRadius: 'var(--radius-md)',
                                background: 'var(--notion-bg)',
                                color: 'var(--notion-text)',
                                resize: 'vertical',
                            }}
                        />
                    </div>

                    {/* Tax / Charge Toggles */}
                    <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--notion-text)', cursor: 'pointer' }}>
                            <input type="checkbox" checked={applyServiceCharge} onChange={e => setApplyServiceCharge(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--notion-blue)', cursor: 'pointer' }} />
                            Add Service Charge (10%)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--notion-text)', cursor: 'pointer' }}>
                            <input type="checkbox" checked={applyVat} onChange={e => setApplyVat(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--notion-blue)', cursor: 'pointer' }} />
                            Add VAT (13%)
                        </label>
                    </div>

                    {/* Order Summary */}
                    <div style={{ padding: '12px', background: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--notion-text)', marginBottom: '8px' }}>Order Summary</div>
                        {cart.map(item => (
                            <div key={item.menuItemId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                                <span style={{ color: 'var(--notion-text-secondary)' }}>{item.quantity}× {item.name}</span>
                                <span style={{ color: 'var(--notion-text)', fontWeight: 500 }}>NPR {(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginTop: '8px', color: 'var(--notion-text-secondary)' }}>
                            <span>Subtotal</span>
                            <span>NPR {subTotal.toFixed(2)}</span>
                        </div>
                        {applyServiceCharge && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                                <span>Service Charge (10%)</span>
                                <span>NPR {serviceCharge.toFixed(2)}</span>
                            </div>
                        )}
                        {applyVat && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                                <span>VAT (13%)</span>
                                <span>NPR {vatAmount.toFixed(2)}</span>
                            </div>
                        )}
                        <div style={{ borderTop: '1px solid var(--notion-border)', marginTop: '8px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 700 }}>
                            <span>Grand Total</span>
                            <span>NPR {cartTotal.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                        {editOrderId && (
                            <Button type="button" variant="secondary" onClick={() => { setCompPassword(''); setCompReason(''); setIsCompModalOpen(true); }} style={{ color: 'var(--notion-red)', borderColor: 'var(--notion-red)' }}>
                                Comp Order
                            </Button>
                        )}
                        <Button type="button" variant="secondary" onClick={() => setIsCheckoutOpen(false)} style={{ flex: 1 }}>
                            Cancel
                        </Button>
                        <Button
                            onClick={placeOrder}
                            disabled={isPlacing || (orderType === 'ROOM_SERVICE' && !selectedRoomId) || (orderType === 'DINE_IN' && !selectedTableId)}
                            style={{ flex: 1 }}
                        >
                            {isPlacing ? 'Placing...' : (
                                <>
                                    <CheckCircle size={16} style={{ marginRight: '6px' }} />
                                    {editOrderId ? 'Update KOT' : 'Place Order'}
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Receipt Preview Modal */}
            <Modal isOpen={showReceipt} onClose={() => setShowReceipt(false)} title="Receipt" size="sm">
                {lastOrder && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', minWidth: '280px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '16px', fontWeight: 700 }}>{hotelName}</div>
                            <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>Receipt #{lastOrder.orderNumber}</div>
                            <div style={{ fontSize: '11px', color: 'var(--notion-text-muted)' }}>{new Date(lastOrder.createdAt).toLocaleString()}</div>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', textAlign: 'center' }}>
                            {lastOrder.orderType.replace('_', ' ')} {lastOrder.customerName ? `| ${lastOrder.customerName}` : ''}
                        </div>
                        {lastOrder.orderType === 'DINE_IN' && lastOrder.tableName && (
                            <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', textAlign: 'center' }}>
                                Table: {lastOrder.tableName}
                            </div>
                        )}
                        {lastOrder.orderType === 'ROOM_SERVICE' && lastOrder.roomName && (
                            <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', textAlign: 'center' }}>
                                Room: {lastOrder.roomName}
                            </div>
                        )}
                        <div style={{ borderTop: '1px dashed var(--notion-border)', borderBottom: '1px dashed var(--notion-border)', padding: 'var(--space-2) 0' }}>
                            {lastOrder.items.map((item: any) => (
                                <div key={item.menuItemId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                                    <span>{item.quantity}x {item.name}</span>
                                    <span>NPR {(item.price * item.quantity).toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                            <span>Subtotal</span><span>NPR {lastOrder.subTotal.toFixed(2)}</span>
                        </div>
                        {lastOrder.serviceCharge > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                <span>Service Charge</span><span>NPR {lastOrder.serviceCharge.toFixed(2)}</span>
                            </div>
                        )}
                        {lastOrder.vatAmount > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                <span>VAT</span><span>NPR {lastOrder.vatAmount.toFixed(2)}</span>
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 700, borderTop: '1px solid var(--notion-border)', paddingTop: '8px' }}>
                            <span>Total</span><span>NPR {lastOrder.cartTotal.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                            <span>Payment</span><span>{lastOrder.paymentMethod}</span>
                        </div>
                        {lastOrder.cashTendered ? (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                                    <span>Tendered</span><span>NPR {lastOrder.cashTendered.toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--notion-green)', fontWeight: 600 }}>
                                    <span>Change</span><span>NPR {Math.max(0, lastOrder.cashTendered - lastOrder.cartTotal).toFixed(2)}</span>
                                </div>
                            </>
                        ) : null}
                        <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--notion-text-muted)', marginTop: '4px' }}>
                            {lastOrder.orderType === 'ROOM_SERVICE' ? 'Thank you! Enjoy your meal in your room!' : lastOrder.orderType === 'TAKEAWAY' ? 'Thank you! Enjoy your meal!' : 'Thank you for dining with us!'}
                        </div>
                        <Button onClick={printReceipt} variant="secondary" style={{ marginTop: 'var(--space-2)' }}>
                            <Printer size={14} style={{ marginRight: '6px' }} /> Print Receipt
                        </Button>
                    </div>
                )}
            </Modal>

            {/* Active KOTs Modal */}
            <Modal isOpen={isActiveKotsModalOpen} onClose={() => setIsActiveKotsModalOpen(false)} title="Active KOTs">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '400px', maxHeight: '60vh', overflowY: 'auto' }}>
                    {activeOrders.length === 0 ? (
                        <div style={{ color: 'var(--notion-text-secondary)', textAlign: 'center', padding: '20px 0' }}>No active KOTs found</div>
                    ) : (
                        activeOrders.map(order => (
                            <div key={order.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)' }}>
                                <div>
                                    <div style={{ fontWeight: 600 }}>#{order.orderNumber} - {order.orderType.replace('_', ' ')}</div>
                                    <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                                        {order.restaurantTableId ? `Table ${tables.find(t => t.id === order.restaurantTableId)?.tableNumber || order.restaurantTableId}` : order.customerName || 'Guest'}
                                    </div>
                                    <div style={{ fontSize: '12px', marginTop: '4px' }}>Items: {order.items?.length || 0} | NPR {order.totalAmount}</div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {orderType === 'DINE_IN' && order.restaurantTableId && (
                                        <Button 
                                            onClick={() => { 
                                                setSelectedTableId(String(order.restaurantTableId)); 
                                                setIsMergeModalOpen(true); 
                                            }} 
                                            size="sm" 
                                            variant="secondary"
                                        >
                                            Merge
                                        </Button>
                                    )}
                                    <Button onClick={() => loadOrderIntoCart(order)} size="sm">
                                        Load / Edit
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Modal>

            {/* Merge Tables Modal */}
            <Modal isOpen={isMergeModalOpen} onClose={() => { setIsMergeModalOpen(false); setSelectedMergeSourceIds([]); }} title="Merge Orders">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '400px' }}>
                    <div style={{ fontSize: '14px', color: 'var(--notion-text-secondary)' }}>
                        Merge other active orders into the currently selected table's order.
                    </div>
                    {orderType !== 'DINE_IN' || !selectedTableId ? (
                        <div style={{ color: 'var(--notion-red)', fontSize: '14px' }}>Please select a target table in the POS first.</div>
                    ) : (
                        <>
                            <div style={{ fontWeight: 600 }}>Target: Table {tables.find(t => String(t.id) === selectedTableId)?.tableNumber || selectedTableId}</div>
                            <div>
                                <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Select Source Orders to Merge:</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '40vh', overflowY: 'auto' }}>
                                    {activeOrders.filter(o => String(o.restaurantTableId) !== selectedTableId).map(order => (
                                        <label key={order.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)', cursor: 'pointer' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={selectedMergeSourceIds.includes(order.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedMergeSourceIds(prev => [...prev, order.id]);
                                                    else setSelectedMergeSourceIds(prev => prev.filter(id => id !== order.id));
                                                }}
                                            />
                                            <div>
                                                <div style={{ fontWeight: 600 }}>#{order.orderNumber} - {order.orderType.replace('_', ' ')}</div>
                                                <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                                                    {order.restaurantTableId ? `Table ${tables.find(t => t.id === order.restaurantTableId)?.tableNumber || order.restaurantTableId}` : order.customerName || 'Guest'}
                                                </div>
                                            </div>
                                        </label>
                                    ))}
                                    {activeOrders.filter(o => String(o.restaurantTableId) !== selectedTableId).length === 0 && (
                                        <div style={{ fontSize: '13px', color: 'var(--notion-text-muted)' }}>No other orders available to merge.</div>
                                    )}
                                </div>
                            </div>
                            <Button onClick={handleMergeOrders} disabled={selectedMergeSourceIds.length === 0} fullWidth>
                                Merge Selected
                            </Button>
                        </>
                    )}
                </div>
            </Modal>

            {/* Comp Order Modal */}
            <Modal isOpen={isCompModalOpen} onClose={() => setIsCompModalOpen(false)} title="Comp Order" size="sm">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: '320px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                        This will mark the order as complimentary. Admin password required.
                    </div>
                    <div>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>Admin Password *</label>
                        <Input
                            type="password"
                            value={compPassword}
                            onChange={e => setCompPassword(e.target.value)}
                            placeholder="Enter admin password"
                            fullWidth
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>Reason</label>
                        <textarea
                            value={compReason}
                            onChange={e => setCompReason(e.target.value)}
                            placeholder="Reason for comping (optional)…"
                            rows={2}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                fontSize: '14px',
                                border: '1px solid var(--notion-border)',
                                borderRadius: 'var(--radius-md)',
                                background: 'var(--notion-bg)',
                                color: 'var(--notion-text)',
                                resize: 'vertical',
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                        <Button type="button" variant="secondary" onClick={() => setIsCompModalOpen(false)} style={{ flex: 1 }}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCompOrder}
                            disabled={!compPassword}
                            style={{ flex: 1, backgroundColor: 'var(--notion-red)', borderColor: 'var(--notion-red)' }}
                        >
                            Confirm Comp
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
