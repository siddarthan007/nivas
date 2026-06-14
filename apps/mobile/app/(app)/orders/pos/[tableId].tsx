import { useEffect, useState, useMemo } from 'react';
import { View, ScrollView, Text, TouchableOpacity, TextInput, ActivityIndicator, Modal, Image, Switch as RNSwitch } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGlobalSearchParams, useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { 
  ChevronLeft, Plus, Minus, Search, X, Printer, GitMerge, 
  MoreHorizontal, UtensilsCrossed, Ticket, CreditCard, Receipt, Check, 
  BedDouble, User, ChevronRight, Users
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { FlashList } from '@shopify/flash-list';
import { MotiView } from 'moti';
import * as DropdownMenu from 'zeego/dropdown-menu';
import { hasPermission } from '@/utils/permissions';
import { api } from '@/api/client';
import { edenFetch } from '@/api/edenFetch';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { useHaptics } from '@/hooks/useHaptics';
import { formatAmount } from '@/utils/currency';
import { trackScreenView } from '@/utils/analytics';
import NetInfo from '@react-native-community/netinfo';
import { enqueueSyncAction } from '@/services/syncQueue';
import { printOrderKot } from '@/utils/printer';
import { getOrderTableId } from '@/utils/orderTableId';
import { useDeviceType } from '@/hooks/useDeviceType';
import { FonepayQrPanel } from '@/components/payments/FonepayQrPanel';
import { mobileTokenStorage } from '@/utils/auth';
import { resolveAssetUrl } from '@/utils/resolveAssetUrl';
import { getPaymentMethodLabel, isQrPaymentMethod, normalizeEnabledPaymentMethods } from '@nivas/shared-utils';

export default function MobilePOSScreen() {
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const params = useGlobalSearchParams();
  const tableId = params?.tableId as string || (segments.length > 0 ? segments[segments.length - 1] : undefined);
  const typeParam = params?.type as string;
  const roomIdParam = params?.roomId as string;
  const guestIdParam = params?.guestId as string;
  const guestNameParam = params?.guestName as string;

  const router = useRouter();
  const { user } = useAuthStore();
  const { light, success: successHaptic, error: errorHaptic } = useHaptics();
  const canCreateOrders = hasPermission(user, 'orders:create');
  const canRecordPayment = hasPermission(user, 'finance:record_payment') || hasPermission(user, 'orders:update_status');
  const { isTablet } = useDeviceType();

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [cart, setCart] = useState<{ menuItemId: number; name: string; price: number; quantity: number }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const queryClient = useQueryClient();

  // Order Flow Config states
  const [orderType, setOrderType] = useState<'DINE_IN' | 'ROOM_SERVICE' | 'TAKEAWAY'>('DINE_IN');
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [addToGuestBill, setAddToGuestBill] = useState(true);
  const [selectedGuest, setSelectedGuest] = useState<any | null>(null);
  const [guestSearchQuery, setGuestSearchQuery] = useState('');
  const [guestList, setGuestList] = useState<any[]>([]);
  const [isSearchingGuests, setIsSearchingGuests] = useState(false);
  const [customerName, setCustomerName] = useState('');

  // Checkout billing states
  const [applyVat, setApplyVat] = useState(false);
  const [applyServiceCharge, setApplyServiceCharge] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ couponId: number; code: string; discount: number } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('UNPAID');
  const [cashTendered, setCashTendered] = useState('');
  const [fonepayPaid, setFonepayPaid] = useState(false);
  const [fonepayPrn, setFonepayPrn] = useState('');

  useEffect(() => {
    trackScreenView('MobilePOSScreen');

    // Initialize based on query parameters
    if (typeParam === 'room') {
      setOrderType('ROOM_SERVICE');
      if (tableId && !isNaN(Number(tableId))) {
        setSelectedRoomId(Number(tableId));
      } else if (roomIdParam) {
        setSelectedRoomId(Number(roomIdParam));
      }
    } else if (typeParam === 'takeaway' || typeParam === 'take_away') {
      setOrderType('TAKEAWAY');
    } else if (typeParam === 'dine_in') {
      setOrderType('DINE_IN');
      if (tableId && !isNaN(Number(tableId))) {
        setSelectedTableId(Number(tableId));
      }
    } else {
      // Default fallback based on whether tableId is a number
      if (tableId && !isNaN(Number(tableId))) {
        setOrderType('DINE_IN');
        setSelectedTableId(Number(tableId));
      } else {
        setOrderType('TAKEAWAY');
      }
    }

    if (guestIdParam && guestNameParam) {
      setSelectedGuest({ id: Number(guestIdParam), fullName: guestNameParam });
      setGuestSearchQuery(guestNameParam);
    }
  }, [typeParam, roomIdParam, tableId, guestIdParam, guestNameParam]);

  // Fetch Table Info
  const { data: tables } = useQuery({
    queryKey: ['tables'],
    queryFn: async () => {
      const res = await api.operations.tables.get();
      if (res.error) throw res.error;
      return res.data?.data || [];
    },
  });
  const table = tables?.find((t: any) => String(t.id) === String(selectedTableId || tableId));

  // Fetch Rooms (for Room Service orders)
  const { data: rooms } = useQuery({
    queryKey: ['rooms_occupied'],
    queryFn: async () => {
      const res = await api.rooms.get();
      if (res.error) throw res.error;
      return res.data?.data || [];
    }
  });

  const occupiedRooms = useMemo(() => {
    if (!rooms) return [];
    return rooms.filter((r: any) => r.status === 'OCCUPIED' || r.currentBooking);
  }, [rooms]);

  const selectedRoom = useMemo(() => {
    if (!rooms || !selectedRoomId) return null;
    return rooms.find((r: any) => r.id === selectedRoomId);
  }, [rooms, selectedRoomId]);

  // Fetch payment methods from hotel settings
  const { data: paymentConfig } = useQuery({
    queryKey: ['payment_config'],
    queryFn: async () => {
      const token = await mobileTokenStorage.getToken();
      const API_URL = process.env.EXPO_PUBLIC_API_URL || '';
      const res = await fetch(`${API_URL}/api/v1/settings/payment`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Failed to load payment settings');
      return json.data as {
        enabledMethods?: string[];
        paymentQrs?: Record<string, { imageUrl?: string; label?: string }>;
        fonepay?: { qrString?: string };
      };
    },
  });

  const settlementMethods = useMemo(() => {
    const enabled = normalizeEnabledPaymentMethods(paymentConfig?.enabledMethods);
    const methods = enabled.length > 0 ? enabled : ['CASH', 'CARD', 'FONEPAY'];
    return ['UNPAID', ...methods];
  }, [paymentConfig?.enabledMethods]);

  useEffect(() => {
    if (!settlementMethods.includes(paymentMethod)) {
      setPaymentMethod(settlementMethods[0] || 'UNPAID');
    }
  }, [settlementMethods, paymentMethod]);

  // Fetch Menu
  const { data: menuItems, isLoading: menuLoading } = useQuery({
    queryKey: ['menu_items'],
    queryFn: async () => {
      const res = await api.menu.get();
      if (res.error) throw res.error;
      return res.data?.data || [];
    },
  });

  // Fetch All Active Orders
  const { data: allActiveOrders, refetch: refetchOrders } = useQuery({
    queryKey: ['active_orders'],
    queryFn: async () => {
      return edenFetch(api.orders.get({ query: { status: 'PENDING,PREPARING,READY' } }));
    },
  });

  // Detect active order based on Table or Room Service selection
  const activeOrder = useMemo(() => {
    if (!allActiveOrders?.data) return null;
    const activeTId = selectedTableId || (tableId && !isNaN(Number(tableId)) ? Number(tableId) : null);
    if (orderType === 'DINE_IN') {
      return allActiveOrders.data.find((o: any) => String(o.restaurantTableId || o.tableId) === String(activeTId));
    } else if (orderType === 'ROOM_SERVICE' && selectedRoomId) {
      return allActiveOrders.data.find((o: any) => String(o.roomId) === String(selectedRoomId));
    }
    return null;
  }, [allActiveOrders, orderType, tableId, selectedRoomId, selectedTableId]);

  const mergeableOrders = (allActiveOrders as any)?.data?.filter((o: any) => o.id !== activeOrder?.id) || [];

  // Sync active order billing options if loaded
  useEffect(() => {
    if (activeOrder) {
      setApplyVat(!!activeOrder.applyVat);
      setApplyServiceCharge(!!activeOrder.applyServiceCharge);
      if (activeOrder.paymentMethod) {
        setPaymentMethod(activeOrder.paymentMethod);
      }
    } else {
      setApplyVat(false);
      setApplyServiceCharge(false);
      setPaymentMethod('UNPAID');
    }
  }, [activeOrder]);

  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: number, quantity: number }) => {
      if (quantity <= 0) {
        return edenFetch((api as any).orders({ id: activeOrder.id }).items({ itemId }).void.post({ reason: 'Voided from Mobile POS' }));
      }
      return edenFetch((api as any).orders({ id: activeOrder.id }).items({ itemId }).patch({ quantity }));
    },
    onMutate: async ({ itemId, quantity }) => {
      await queryClient.cancelQueries({ queryKey: ['active_orders'] });
      const previousOrders = queryClient.getQueryData(['active_orders']);
      
      queryClient.setQueryData(['active_orders'], (old: any) => {
        if (!old?.data) return old;
        const newData = old.data.map((o: any) => {
          if (o.id === activeOrder?.id) {
            const items = o.items || [];
            const newItems = quantity <= 0 
              ? items.filter((i: any) => i.id !== itemId)
              : items.map((i: any) => i.id === itemId ? { ...i, quantity } : i);
            return { ...o, items: newItems };
          }
          return o;
        });
        return { ...old, data: newData };
      });
      return { previousOrders };
    },
    onSuccess: () => {
      successHaptic();
      refetchOrders();
    },
    onError: (err: any, variables, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(['active_orders'], context.previousOrders);
      }
      errorHaptic();
      Toast.show({ type: 'error', text1: 'Failed to update item', text2: err.message });
    }
  });

  const mergeTableMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      return edenFetch((api as any).orders({ id: activeOrder.id }).merge.post({ sourceOrderIds: [sourceId] }));
    },
    onSuccess: () => {
      successHaptic();
      setIsMergeModalOpen(false);
      refetchOrders();
      Toast.show({ type: 'success', text1: 'Table merged successfully' });
    },
    onError: (err: any) => {
      errorHaptic();
      Toast.show({ type: 'error', text1: 'Failed to merge table', text2: err.message });
    }
  });

  const handlePrintKOT = async () => {
    if (!activeOrder) return;
    try {
      await printOrderKot(activeOrder.id);
      successHaptic();
      Toast.show({ type: 'success', text1: 'KOT printed' });
    } catch (err: any) {
      errorHaptic();
      Toast.show({ type: 'error', text1: 'Print failed', text2: err.message });
    }
  };

  const addToCart = (item: any) => {
    light();
    setCart((prev) => {
      const existing = prev.find((p) => p.menuItemId === item.id);
      if (existing) {
        return prev.map((p) => (p.menuItemId === item.id ? { ...p, quantity: p.quantity + 1 } : p));
      }
      return [...prev, { menuItemId: item.id, name: item.name, price: Number(item.price || 0), quantity: 1 }];
    });
  };

  const updateQuantity = (id: number, delta: number) => {
    light();
    setCart((prev) => {
      return prev.map((p) => {
        if (p.menuItemId === id) {
          const newQ = p.quantity + delta;
          if (newQ <= 0) return null as any;
          return { ...p, quantity: newQ };
        }
        return p;
      }).filter(Boolean);
    });
  };

  // Categories Calculation
  const categories = useMemo(() => {
    if (!menuItems) return ['ALL'];
    const cats = new Set(menuItems.map((i: any) => i.category).filter(Boolean));
    return ['ALL', ...Array.from(cats)];
  }, [menuItems]);

  const filteredMenu = menuItems?.filter((mi: any) => 
    mi.isAvailable !== false && 
    (activeCategory === 'ALL' || mi.category === activeCategory) &&
    (!search || mi.name?.toLowerCase().includes(search.toLowerCase()))
  );

  // Billing Math
  const firedTotal = activeOrder?.items?.reduce((sum: number, item: any) => sum + Number(item.price) * item.quantity, 0) || 0;
  const newTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const subTotal = firedTotal + newTotal;
  
  const serviceChargeRate = 0.10;
  const vatRate = 0.13;
  const serviceCharge = applyServiceCharge ? subTotal * serviceChargeRate : 0;
  const vatAmount = applyVat ? (subTotal + serviceCharge) * vatRate : 0;
  const grossTotal = subTotal + serviceCharge + vatAmount;
  const discount = appliedCoupon ? Math.min(appliedCoupon.discount, grossTotal) : 0;
  const grandTotal = Math.max(0, grossTotal - discount);

  useEffect(() => {
    if (appliedCoupon) {
      setAppliedCoupon(null);
      setCouponCode('');
    }
  }, [subTotal, applyVat, applyServiceCharge]);

  const changeDue = (paymentMethod === 'CASH' && cashTendered.trim()) 
    ? Math.max(0, parseFloat(cashTendered) - grandTotal) 
    : 0;

  // Search Guests API
  const searchGuests = async (queryText: string) => {
    setGuestSearchQuery(queryText);
    if (queryText.trim().length < 2) {
      setGuestList([]);
      return;
    }
    setIsSearchingGuests(true);
    try {
      const res = await (api as any).guests.search.get({ query: { q: queryText } });
      if (!res.error && res.data?.data) {
        setGuestList(res.data.data || []);
      }
    } catch (e) {
      console.warn('Guest search error:', e);
    } finally {
      setIsSearchingGuests(false);
    }
  };

  const handleApplyCoupon = async () => {
    const code = couponCode.trim();
    if (!code) return;
    if (subTotal <= 0) {
      errorHaptic();
      Toast.show({ type: 'error', text1: 'Empty Cart', text2: 'Please add items before applying a coupon.' });
      return;
    }
    if (grossTotal <= 0) {
      errorHaptic();
      Toast.show({ type: 'error', text1: 'Invalid total', text2: 'Coupon requires a billable amount.' });
      return;
    }
    setCouponLoading(true);
    try {
      const res = await (api as any).coupons.validate.post({ 
        code, 
        amount: grossTotal, 
        scope: 'FNB' 
      });
      if (res.error) throw res.error;
      const data = res.data?.data;
      if (data) {
        setAppliedCoupon({
          couponId: data.couponId || data.id,
          code: data.code,
          discount: Number(data.discount || 0)
        });
        successHaptic();
        Toast.show({ type: 'success', text1: 'Coupon Applied', text2: `Discount of ${formatAmount(data.discount)} applied.` });
      }
    } catch (err: any) {
      errorHaptic();
      Toast.show({ type: 'error', text1: 'Invalid Coupon', text2: err.message || 'Could not validate coupon.' });
      setAppliedCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    light();
    setAppliedCoupon(null);
    setCouponCode('');
  };

  const placeOrder = async () => {
    if (cart.length === 0 && !activeOrder) return;
    
    // Validations based on type
    if (orderType === 'ROOM_SERVICE' && !selectedRoomId) {
      errorHaptic();
      Toast.show({ type: 'error', text1: 'Missing Room', text2: 'Please select an occupied room for Room Service.' });
      return;
    }

    if (orderType === 'DINE_IN') {
      const activeTId = selectedTableId || (tableId && !isNaN(Number(tableId)) ? Number(tableId) : null);
      if (!activeTId) {
        errorHaptic();
        Toast.show({ type: 'error', text1: 'Table Required', text2: 'Please select a restaurant table for Dine In.' });
        return;
      }
    }

    if (paymentMethod === 'FONEPAY' && grandTotal > 0 && !fonepayPaid) {
      errorHaptic();
      Toast.show({ type: 'error', text1: 'Fonepay pending', text2: 'Wait for payment confirmation or mark received manually.' });
      return;
    }

    if (paymentMethod === 'CASH' && cashTendered.trim() && parseFloat(cashTendered) < grandTotal) {
      errorHaptic();
      Toast.show({ type: 'error', text1: 'Insufficient Cash', text2: `Tendered amount must cover the total ${formatAmount(grandTotal)}` });
      return;
    }

    if (paymentMethod !== 'UNPAID' && !canRecordPayment) {
      errorHaptic();
      Toast.show({ type: 'error', text1: 'No permission', text2: 'You cannot record payments on this account.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const itemsPayload = cart.map((c) => ({ menuItemId: c.menuItemId, quantity: c.quantity, price: c.price }));
      
      const payload: any = {
        orderType,
        applyVat,
        applyServiceCharge,
        paymentMethod: paymentMethod !== 'UNPAID' ? paymentMethod : undefined,
        cashTendered: paymentMethod === 'CASH' && cashTendered ? parseFloat(cashTendered) : undefined,
        transactionId: paymentMethod === 'FONEPAY' && fonepayPrn ? fonepayPrn : undefined,
        couponId: appliedCoupon ? appliedCoupon.couponId : undefined,
      };

      if (orderType === 'ROOM_SERVICE') {
        payload.roomId = Number(selectedRoomId);
        payload.bookingId = selectedRoom?.currentBooking?.id ? String(selectedRoom.currentBooking.id) : undefined;
        payload.addToGuestBill = addToGuestBill;
      } else if (orderType === 'DINE_IN') {
        const activeTId = selectedTableId || (tableId && !isNaN(Number(tableId)) ? Number(tableId) : null);
        payload.restaurantTableId = Number(activeTId);
        payload.guestId = selectedGuest?.id ? String(selectedGuest.id) : undefined;
      } else {
        payload.customerName = customerName || 'Walk-in';
      }

      let orderId: string | number | null = null;
      
      if (activeOrder) {
        orderId = activeOrder.id;
        const checkoutPayload: Record<string, unknown> = {
          applyVat,
          applyServiceCharge,
          paymentMethod: paymentMethod !== 'UNPAID' ? paymentMethod : undefined,
          cashTendered: paymentMethod === 'CASH' && cashTendered ? parseFloat(cashTendered) : undefined,
          transactionId: paymentMethod === 'FONEPAY' && fonepayPrn ? fonepayPrn : undefined,
          couponId: appliedCoupon ? appliedCoupon.couponId : undefined,
          status: paymentMethod !== 'UNPAID' ? 'SERVED' : undefined,
          addToGuestBill: orderType === 'ROOM_SERVICE' ? addToGuestBill : undefined,
          roomId: orderType === 'ROOM_SERVICE' ? Number(selectedRoomId) : undefined,
          bookingId: orderType === 'ROOM_SERVICE' && selectedRoom?.currentBooking?.id ? String(selectedRoom.currentBooking.id) : undefined,
          guestId: orderType === 'DINE_IN' && selectedGuest?.id ? String(selectedGuest.id) : undefined,
        };
        if (cart.length > 0) {
          checkoutPayload.itemsToAdd = itemsPayload;
        }
        const checkoutRes = await (api as any).orders({ id: activeOrder.id })['pos-checkout'].post(checkoutPayload);
        if (checkoutRes.error) throw checkoutRes.error;
        
        Toast.show({ type: 'success', text1: paymentMethod !== 'UNPAID' ? 'Order Finalized' : 'Items Fired to Kitchen' });
      } else {
        // Create new order
        const res = await api.orders.post({ 
          ...payload,
          items: itemsPayload,
          status: paymentMethod !== 'UNPAID' ? 'SERVED' : undefined
        });
        if (res.error) throw res.error;
        orderId = res.data?.data?.id ?? null;
        Toast.show({ type: 'success', text1: paymentMethod !== 'UNPAID' ? 'Order Finalized' : 'Order placed successfully' });
      }
      
      // Trigger KOT print
      if (orderId) {
        await printOrderKot(orderId);
      }
      
      successHaptic();
      setCart([]);
      setIsCartOpen(false);
      refetchOrders();
      router.back();
    } catch (error: any) {
      const isNetworkError = !error?.status && (
        error?.message?.includes('Network') ||
        error?.message?.includes('fetch') ||
        error?.name === 'TypeError'
      );
      const netState = await NetInfo.fetch().catch(() => ({ isConnected: true }));
      if (isNetworkError || !netState.isConnected) {
        const itemsPayload = cart.map((c) => ({ menuItemId: c.menuItemId, quantity: c.quantity, price: c.price }));
        const offlinePayload: Record<string, unknown> = {
          orderType,
          applyVat,
          applyServiceCharge,
          paymentMethod: paymentMethod !== 'UNPAID' ? paymentMethod : undefined,
          cashTendered: paymentMethod === 'CASH' && cashTendered ? parseFloat(cashTendered) : undefined,
          transactionId: paymentMethod === 'FONEPAY' && fonepayPrn ? fonepayPrn : undefined,
          couponId: appliedCoupon ? appliedCoupon.couponId : undefined,
          items: itemsPayload,
          status: paymentMethod !== 'UNPAID' ? 'SERVED' : undefined,
        };
        if (orderType === 'ROOM_SERVICE') {
          offlinePayload.roomId = Number(selectedRoomId);
          offlinePayload.addToGuestBill = addToGuestBill;
        } else if (orderType === 'DINE_IN') {
          const activeTId = selectedTableId || (tableId && !isNaN(Number(tableId)) ? Number(tableId) : null);
          offlinePayload.restaurantTableId = Number(activeTId);
        }

        const queued = activeOrder
          ? await enqueueSyncAction({
              method: 'POST',
              endpoint: `/orders/${activeOrder.id}/pos-checkout`,
              payload: {
                itemsToAdd: cart.length > 0 ? itemsPayload : undefined,
                applyVat,
                applyServiceCharge,
                paymentMethod: paymentMethod !== 'UNPAID' ? paymentMethod : undefined,
                cashTendered: paymentMethod === 'CASH' && cashTendered ? parseFloat(cashTendered) : undefined,
                transactionId: paymentMethod === 'FONEPAY' && fonepayPrn ? fonepayPrn : undefined,
                couponId: appliedCoupon ? appliedCoupon.couponId : undefined,
                status: paymentMethod !== 'UNPAID' ? 'SERVED' : undefined,
              },
            })
          : await enqueueSyncAction({
              method: 'POST',
              endpoint: '/orders',
              payload: offlinePayload,
            });

        if (queued) {
          successHaptic();
          Toast.show({
            type: 'info',
            text1: 'Saved offline',
            text2: 'Order queued and will sync when you are back online.',
          });
          setCart([]);
          setIsCartOpen(false);
          return;
        }
      }
      errorHaptic();
      Toast.show({ type: 'error', text1: 'Failed to complete order', text2: error.message || 'An error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <View className="flex-1 bg-notion-bg dark:bg-notion-bg">
      {/* Header (Safe Area Aware) */}
      <View 
        style={{ paddingTop: insets.top + 10 }}
        className="flex-row items-center px-4 pb-4 border-b border-notion-border dark:border-white/5 bg-notion-bg-secondary dark:bg-notion-bg-secondary"
      >
        <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1 rounded-full bg-notion-bg dark:bg-notion-bg-tertiary">
          <ChevronLeft size={24} className="text-notion-text dark:text-white" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-lg font-bold text-notion-text dark:text-white">
            {orderType === 'DINE_IN' 
              ? `Table ${table?.tableNumber || (tableId && !isNaN(Number(tableId)) ? tableId : 'Select Table')}` 
              : orderType === 'ROOM_SERVICE' 
                ? (selectedRoom ? `Room ${selectedRoom.roomNumber}` : 'Room Order') 
                : 'Takeaway Order'}
          </Text>
          <Text className="text-xs text-notion-blue font-semibold">
            {activeOrder ? `Active Order #${activeOrder.id}` : 'New Order'}
          </Text>
        </View>
        {activeOrder && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <View className="flex-row items-center bg-notion-bg dark:bg-notion-bg-tertiary px-3 py-2 rounded-xl border border-notion-border dark:border-transparent">
                <MoreHorizontal size={20} className="text-notion-text dark:text-white" />
              </View>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Item key="merge" onSelect={() => setIsMergeModalOpen(true)}>
                <DropdownMenu.ItemTitle>Merge Table</DropdownMenu.ItemTitle>
                <DropdownMenu.ItemIcon ios={{ name: 'arrow.triangle.merge' }} />
              </DropdownMenu.Item>
              <DropdownMenu.Item key="kot" onSelect={handlePrintKOT}>
                <DropdownMenu.ItemTitle>Print KOT</DropdownMenu.ItemTitle>
                <DropdownMenu.ItemIcon ios={{ name: 'printer' }} />
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        )}
      </View>

      {/* Order Flow Switcher */}
      <View className="flex-row bg-notion-bg-secondary dark:bg-notion-bg-tertiary p-1 rounded-xl mx-3 mt-3 border border-notion-border dark:border-transparent">
        {[
          { key: 'DINE_IN', label: 'Dine In' },
          { key: 'ROOM_SERVICE', label: 'Room Service' },
          { key: 'TAKEAWAY', label: 'Takeaway' }
        ].map((item) => {
          const active = orderType === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => {
                light();
                setOrderType(item.key as any);
                setCart([]); // Clear cart to prevent cross-type item pollution
                setAppliedCoupon(null);
                setCouponCode('');
                setPaymentMethod('UNPAID');
                setSelectedRoomId(null);
                setSelectedGuest(null);
                setCustomerName('');
              }}
              className={`flex-1 py-2 rounded-lg items-center justify-center ${active ? 'bg-notion-bg dark:bg-notion-bg-secondary shadow-sm' : ''}`}
            >
              <Text className={`text-xs font-bold ${active ? 'text-notion-blue' : 'text-notion-text-secondary dark:text-white/60'}`}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Contextual Selector Cards (Rooms / Customer Names) */}
      {orderType === 'DINE_IN' && (tableId === 'new' || isNaN(Number(tableId))) && (
        <View className="px-3 mt-3">
          <TouchableOpacity
            onPress={() => { light(); setIsTableModalOpen(true); }}
            className="flex-row justify-between items-center bg-notion-bg-secondary dark:bg-notion-bg-tertiary border border-notion-border dark:border-transparent px-4 py-3.5 rounded-xl"
          >
            <View className="flex-row items-center">
              <Users size={18} className="text-notion-blue mr-2" />
              <Text className="text-notion-text dark:text-white font-bold text-sm">
                {table ? `Table ${table.tableNumber} (${table.status})` : 'Select Restaurant Table'}
              </Text>
            </View>
            <ChevronRight size={16} className="text-notion-text-secondary" />
          </TouchableOpacity>
        </View>
      )}

      {orderType === 'ROOM_SERVICE' && (
        <View className="px-3 mt-3">
          <TouchableOpacity
            onPress={() => { light(); setIsRoomModalOpen(true); }}
            className="flex-row justify-between items-center bg-notion-bg-secondary dark:bg-notion-bg-tertiary border border-notion-border dark:border-transparent px-4 py-3.5 rounded-xl"
          >
            <View className="flex-row items-center">
              <BedDouble size={18} className="text-notion-green mr-2" />
              <Text className="text-notion-text dark:text-white font-bold text-sm">
                {selectedRoom ? `Room ${selectedRoom.roomNumber} (${selectedRoom.currentBooking?.guestName || 'Stay Guest'})` : 'Select Occupied Room'}
              </Text>
            </View>
            <ChevronRight size={16} className="text-notion-text-secondary" />
          </TouchableOpacity>
        </View>
      )}

      {orderType === 'TAKEAWAY' && (
        <View className="px-3 mt-3">
          <View className="flex-row items-center bg-notion-bg-secondary dark:bg-notion-bg-tertiary border border-notion-border dark:border-transparent px-4 py-1.5 rounded-xl">
            <User size={18} className="text-notion-blue mr-2" />
            <TextInput
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Enter customer / walk-in name..."
              placeholderTextColor="#9ca3af"
              className="flex-1 text-notion-text dark:text-white py-2 text-sm font-semibold"
            />
          </View>
        </View>
      )}

      {/* Categories Horizontal Pills Bar */}
      <View className="bg-notion-bg dark:bg-notion-bg-secondary border-b border-notion-border dark:border-white/5 py-3 mt-2">
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12 }}
        >
          {categories.map((cat: string) => {
            const active = activeCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => { light(); setActiveCategory(cat); }}
                className={`px-4 py-1.5 rounded-full mr-2 border ${
                  active 
                    ? 'bg-notion-blue border-notion-blue' 
                    : 'bg-notion-bg-secondary dark:bg-notion-bg-tertiary border-notion-border dark:border-transparent'
                }`}
              >
                <Text className={`text-xs font-bold ${active ? 'text-white' : 'text-notion-text dark:text-white'}`}>
                  {cat === 'ALL' ? 'All Items' : cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Search Bar */}
      <View className="p-3 border-b border-notion-border dark:border-white/5">
        <View className="flex-row items-center bg-notion-bg-secondary dark:bg-notion-bg-tertiary px-3 py-2.5 rounded-xl border border-notion-border dark:border-transparent">
          <Search size={16} className="text-notion-text-secondary mr-2" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search menu items..."
            placeholderTextColor="#9ca3af"
            className="flex-1 text-notion-text dark:text-white py-0 text-sm font-medium"
          />
        </View>
      </View>

      {/* Menu Grid */}
      {menuLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#2eaadc" />
          <Text className="mt-4 text-notion-text-secondary text-sm">Loading menu items...</Text>
        </View>
      ) : (
        <View className="flex-1 px-2 pt-2">
          <FlashList
            data={filteredMenu || []}
            numColumns={isTablet ? 4 : 2}
            estimatedItemSize={180}
            contentContainerStyle={{ paddingBottom: 110 }}
            renderItem={({ item }: { item: any }) => {
              const inCartQty = cart.find(c => c.menuItemId === item.id)?.quantity || 0;
              return (
                <View style={{ flex: 1, padding: 4 }}>
                  <TouchableOpacity
                    className="w-full"
                    activeOpacity={0.7}
                    onPress={() => addToCart(item)}
                  >
                    <Card 
                      padding="none" 
                      className={`overflow-hidden bg-notion-bg dark:bg-notion-bg-secondary border ${inCartQty > 0 ? 'border-notion-blue bg-notion-blue/5' : 'border-notion-border dark:border-white/5'} rounded-2xl`}
                      style={{ height: 180 }}
                    >
                      {/* Item Image or Fallback */}
                      {item.imageUrl ? (
                        <Image 
                          source={{ uri: resolveAssetUrl(item.imageUrl) }} 
                          style={{ width: '100%', height: 90 }} 
                          resizeMode="cover" 
                        />
                      ) : (
                        <View className="w-full h-[90px] bg-notion-bg-secondary dark:bg-notion-bg-tertiary items-center justify-center">
                          <UtensilsCrossed size={22} className="text-notion-text-secondary" />
                        </View>
                      )}
                      
                      {/* Item Info */}
                      <View className="p-2.5 flex-1 justify-between">
                        <View>
                          <Text className="font-bold text-notion-text dark:text-white text-xs" numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text className="text-[10px] text-notion-text-secondary dark:text-white/50 mt-0.5" numberOfLines={1}>
                            {item.description || item.category || 'Food'}
                          </Text>
                        </View>
                        
                        <View className="flex-row justify-between items-center mt-1">
                          <Text className="text-notion-blue dark:text-[#5e87c9] font-extrabold text-xs">
                            {formatAmount(item.price)}
                          </Text>
                          
                          {inCartQty > 0 ? (
                            <MotiView
                              from={{ scale: 0.5, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ type: 'spring' }}
                              className="bg-notion-blue px-2 py-0.5 rounded-full"
                            >
                              <Text className="text-white text-[10px] font-bold">{inCartQty}</Text>
                            </MotiView>
                          ) : (
                            <View className="bg-notion-bg-secondary dark:bg-notion-bg-tertiary w-6 h-6 rounded-full items-center justify-center">
                              <Plus size={12} className="text-notion-text dark:text-white" />
                            </View>
                          )}
                        </View>
                      </View>
                    </Card>
                  </TouchableOpacity>
                </View>
              );
            }}
            ListEmptyComponent={() => (
              <Text className="text-center text-notion-text-secondary mt-10">No items found.</Text>
            )}
          />
        </View>
      )}

      {/* Floating View Order Button */}
      {(cartCount > 0 || activeOrder?.items?.length > 0) && (
        <MotiView 
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 15 }}
          className="absolute bottom-6 left-4 right-4 shadow-lg"
        >
          <TouchableOpacity 
            activeOpacity={0.9} 
            onPress={() => setIsCartOpen(true)}
            className="bg-notion-text dark:bg-notion-bg-secondary border border-notion-border dark:border-white/10 rounded-2xl flex-row items-center justify-between p-4"
          >
            <View className="flex-row items-center">
              <View className="bg-notion-blue px-3 py-1 rounded-lg mr-3 shadow-inner">
                <Text className="text-white font-extrabold text-sm">{cartCount}</Text>
              </View>
              <Text className="text-white font-bold text-base">View Order Details</Text>
            </View>
            <Text className="text-notion-blue font-extrabold text-base">{formatAmount(subTotal)}</Text>
          </TouchableOpacity>
        </MotiView>
      )}

      {/* Room Selector Modal */}
      <Modal visible={isRoomModalOpen} transparent animationType="fade" onRequestClose={() => setIsRoomModalOpen(false)}>
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="bg-notion-bg dark:bg-notion-bg-secondary w-full rounded-2xl p-5 border border-notion-border dark:border-white/5 shadow-lg">
            <View className="flex-row justify-between items-center mb-4 pb-2 border-b border-notion-border dark:border-white/5">
              <Text className="text-lg font-bold text-notion-text dark:text-white">Select Occupied Room</Text>
              <TouchableOpacity onPress={() => setIsRoomModalOpen(false)} className="bg-notion-bg-secondary dark:bg-notion-bg-tertiary p-2 rounded-full">
                <X size={18} className="text-notion-text dark:text-white" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {occupiedRooms.length === 0 ? (
                <Text className="text-center text-notion-text-secondary py-4">No occupied rooms available right now.</Text>
              ) : (
                occupiedRooms.map((r: any) => (
                  <TouchableOpacity
                    key={r.id}
                    onPress={() => {
                      light();
                      setSelectedRoomId(r.id);
                      setIsRoomModalOpen(false);
                      setCart([]); // Reset cart to fetch this room's active items
                    }}
                    className={`p-4 border border-notion-border dark:border-white/5 rounded-xl mb-2 flex-row justify-between items-center ${
                      selectedRoomId === r.id ? 'bg-notion-blue/10 border-notion-blue' : 'bg-notion-bg-secondary dark:bg-notion-bg-tertiary'
                    }`}
                  >
                    <View>
                      <Text className="font-bold text-notion-text dark:text-white text-base">Room {r.roomNumber}</Text>
                      <Text className="text-notion-text-secondary dark:text-white/40 text-xs mt-0.5">{r.currentBooking?.guestName || 'In-House Stay'}</Text>
                    </View>
                    <ChevronRight size={16} className="text-notion-text-secondary" />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Table Selector Modal */}
      <Modal visible={isTableModalOpen} transparent animationType="fade" onRequestClose={() => setIsTableModalOpen(false)}>
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="bg-notion-bg dark:bg-notion-bg-secondary w-full rounded-2xl p-5 border border-notion-border dark:border-white/5 shadow-lg">
            <View className="flex-row justify-between items-center mb-4 pb-2 border-b border-notion-border dark:border-white/5">
              <Text className="text-lg font-bold text-notion-text dark:text-white">Select Table</Text>
              <TouchableOpacity onPress={() => setIsTableModalOpen(false)} className="bg-notion-bg-secondary dark:bg-notion-bg-tertiary p-2 rounded-full">
                <X size={18} className="text-notion-text dark:text-white" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {!tables || tables.length === 0 ? (
                <Text className="text-center text-notion-text-secondary py-4">No tables available.</Text>
              ) : (
                tables.map((t: any) => (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => {
                      light();
                      setSelectedTableId(t.id);
                      setIsTableModalOpen(false);
                      setCart([]); // Reset cart to prevent cross-table item pollution or loading stale orders
                    }}
                    className={`p-4 border border-notion-border dark:border-white/5 rounded-xl mb-2 flex-row justify-between items-center ${
                      (selectedTableId || Number(tableId)) === t.id ? 'bg-notion-blue/10 border-notion-blue' : 'bg-notion-bg-secondary dark:bg-notion-bg-tertiary'
                    }`}
                  >
                    <View>
                      <Text className="font-bold text-notion-text dark:text-white text-base">Table {t.tableNumber}</Text>
                      <Text className="text-notion-text-secondary dark:text-white/40 text-xs mt-0.5">Status: {t.status}</Text>
                    </View>
                    <ChevronRight size={16} className="text-notion-text-secondary" />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Cart Modal */}
      <Modal visible={isCartOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsCartOpen(false)}>
        <SafeAreaView className="flex-1 bg-notion-bg dark:bg-notion-bg">
          {/* Modal Header */}
          <View className="flex-row justify-between items-center p-4 border-b border-notion-border dark:border-white/5">
            <View>
              <Text className="text-xl font-bold text-notion-text dark:text-white">Current Order</Text>
              <Text className="text-xs text-notion-text-secondary mt-0.5">
                {orderType === 'DINE_IN' ? `Table ${table?.tableNumber || tableId}` : orderType === 'ROOM_SERVICE' ? (selectedRoom ? `Room ${selectedRoom.roomNumber}` : 'Room Service') : 'Takeaway / Walk-in'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setIsCartOpen(false)} className="bg-notion-bg-secondary dark:bg-notion-bg-tertiary p-2 rounded-full border border-notion-border dark:border-transparent">
              <X size={20} className="text-notion-text dark:text-white" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            className="flex-1"
            showsVerticalScrollIndicator={false}
          >
            <View className="p-4 flex-col gap-6">
              {/* 1. Fired items list */}
              {activeOrder && activeOrder.items?.length > 0 && (
                <View className="bg-notion-bg dark:bg-notion-bg-secondary p-4 rounded-2xl border border-notion-border dark:border-white/5 shadow-sm">
                  <View className="flex-row justify-between items-center mb-4 pb-2 border-b border-notion-border dark:border-white/5">
                    <Text className="text-notion-text-secondary text-xs uppercase tracking-widest font-extrabold">Fired Items (In Kitchen)</Text>
                    <TouchableOpacity onPress={handlePrintKOT} className="flex-row items-center bg-notion-blue-bg px-2.5 py-1 rounded-lg">
                      <Printer size={12} className="text-notion-blue mr-1.5" />
                      <Text className="text-notion-blue text-xs font-bold">Re-print KOT</Text>
                    </TouchableOpacity>
                  </View>
                  {activeOrder.items.map((item: any, idx: number) => (
                    <View key={`active-${idx}`} className="flex-row items-center justify-between mb-4">
                      <View className="flex-1 mr-4">
                        <Text className="font-bold text-notion-text dark:text-white text-base opacity-90">{item.menuItem?.name || 'Item'}</Text>
                        <Text className="text-notion-text-secondary dark:text-white/40 text-xs mt-0.5 uppercase tracking-wider font-semibold">Status: {item.status}</Text>
                      </View>
                      <View className="flex-row items-center bg-notion-bg-secondary dark:bg-notion-bg-tertiary rounded-xl border border-notion-border dark:border-transparent p-0.5">
                        <TouchableOpacity 
                          onPress={() => updateItemMutation.mutate({ itemId: item.id, quantity: item.quantity - 1 })} 
                          disabled={updateItemMutation.isPending}
                          className="p-2"
                        >
                          <Minus size={14} className="text-notion-text dark:text-white" />
                        </TouchableOpacity>
                        <Text className="mx-2 font-extrabold text-base text-notion-text dark:text-white w-5 text-center">{item.quantity}</Text>
                        <TouchableOpacity 
                          onPress={() => updateItemMutation.mutate({ itemId: item.id, quantity: item.quantity + 1 })} 
                          disabled={updateItemMutation.isPending}
                          className="p-2"
                        >
                          <Plus size={14} className="text-notion-text dark:text-white" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* 2. Cart items (new items to add) */}
              {cart.length > 0 && (
                <View className="bg-notion-bg dark:bg-notion-bg-secondary p-4 rounded-2xl border border-notion-border dark:border-white/5 shadow-sm">
                  <Text className="text-notion-text-secondary text-xs uppercase tracking-widest font-extrabold mb-4 pb-2 border-b border-notion-border dark:border-white/5">New Items (Draft)</Text>
                  {cart.map((item) => (
                    <MotiView 
                      key={item.menuItemId} 
                      from={{ opacity: 0, translateX: -10 }}
                      animate={{ opacity: 1, translateX: 0 }}
                      transition={{ type: 'spring' }}
                      className="flex-row items-center justify-between mb-4"
                    >
                      <View className="flex-1 mr-4">
                        <Text className="font-bold text-notion-text dark:text-white text-base">{item.name}</Text>
                        <Text className="text-notion-blue font-bold text-sm mt-0.5">{formatAmount(item.price * item.quantity)}</Text>
                      </View>
                      <View className="flex-row items-center bg-notion-bg-secondary dark:bg-notion-bg-tertiary rounded-xl border border-notion-border dark:border-transparent p-0.5">
                        <TouchableOpacity onPress={() => updateQuantity(item.menuItemId, -1)} className="p-2">
                          <Minus size={14} className="text-notion-text dark:text-white" />
                        </TouchableOpacity>
                        <Text className="mx-2 font-extrabold text-base text-notion-text dark:text-white w-5 text-center">{item.quantity}</Text>
                        <TouchableOpacity onPress={() => updateQuantity(item.menuItemId, 1)} className="p-2">
                          <Plus size={14} className="text-notion-text dark:text-white" />
                        </TouchableOpacity>
                      </View>
                    </MotiView>
                  ))}
                </View>
              )}

              {cart.length === 0 && !activeOrder && (
                <View className="py-20 items-center justify-center">
                  <UtensilsCrossed size={48} className="text-notion-text-secondary opacity-30 mb-4" />
                  <Text className="text-center text-notion-text-secondary text-sm">Your order is empty.</Text>
                </View>
              )}

              {/* 3. Checkout Billing & Payments Form */}
              {(cart.length > 0 || activeOrder) && (
                <View className="bg-notion-bg dark:bg-notion-bg-secondary p-4 rounded-2xl border border-notion-border dark:border-white/5 shadow-sm">
                  <Text className="text-notion-text-secondary text-xs uppercase tracking-widest font-extrabold mb-4 pb-2 border-b border-notion-border dark:border-white/5">Billing & Payments</Text>
                  
                  {/* Context Sensitive Customers linking */}
                  {orderType === 'DINE_IN' && (
                    <View className="mb-4">
                      <Text className="text-notion-text dark:text-white font-bold text-xs uppercase tracking-widest mb-2">Link Guest (Optional)</Text>
                      <View className="flex-row gap-2">
                        <View className="flex-1 flex-row items-center bg-notion-bg-secondary dark:bg-notion-bg-tertiary px-3 rounded-xl border border-notion-border dark:border-transparent">
                          <User size={16} className="text-notion-text-secondary mr-2" />
                          <TextInput
                            value={guestSearchQuery}
                            onChangeText={searchGuests}
                            placeholder={selectedGuest ? selectedGuest.fullName : "Search guest name/phone..."}
                            placeholderTextColor={selectedGuest ? "#37352f" : "#9ca3af"}
                            className="flex-1 text-notion-text dark:text-white py-2 text-sm font-medium"
                          />
                        </View>
                        {selectedGuest && (
                          <TouchableOpacity 
                            onPress={() => { light(); setSelectedGuest(null); setGuestSearchQuery(''); }}
                            className="px-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-xl items-center justify-center"
                          >
                            <Text className="text-notion-red text-xs font-bold uppercase tracking-wider">Unlink</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      
                      {/* Guest Search Results list dropdown */}
                      {isSearchingGuests && (
                        <ActivityIndicator className="mt-2" color="#2eaadc" />
                      )}
                      {!selectedGuest && guestList.length > 0 && (
                        <View className="bg-notion-bg-secondary dark:bg-notion-bg-tertiary border border-notion-border dark:border-transparent rounded-xl mt-2 overflow-hidden shadow">
                          {guestList.map((g) => (
                            <TouchableOpacity
                              key={g.id}
                              onPress={() => {
                                light();
                                setSelectedGuest(g);
                                setGuestSearchQuery(g.fullName);
                                setGuestList([]);
                              }}
                              className="p-3 border-b border-notion-border dark:border-white/5"
                            >
                              <Text className="text-notion-text dark:text-white text-sm font-semibold">{g.fullName}</Text>
                              <Text className="text-notion-text-secondary text-xs mt-0.5">{g.phone || g.email || 'No Contact'}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  )}

                  {orderType === 'ROOM_SERVICE' && (
                    <View className="mb-4 pb-4 border-b border-notion-border dark:border-white/5">
                      <View className="flex-row justify-between items-center">
                        <View>
                          <Text className="text-notion-text dark:text-white font-bold text-sm">Post to Guest Folio</Text>
                          <Text className="text-notion-text-secondary text-[11px] mt-0.5">Charge order directly to stay bill</Text>
                        </View>
                        <RNSwitch 
                          value={addToGuestBill} 
                          onValueChange={setAddToGuestBill}
                          trackColor={{ false: '#e9e9e7', true: '#2eaadc' }}
                          thumbColor="#ffffff"
                        />
                      </View>
                    </View>
                  )}

                  {/* Tax Toggles */}
                  <View className="flex-row justify-between items-center mb-4">
                    <View>
                      <Text className="text-notion-text dark:text-white font-bold text-sm">Service Charge (10%)</Text>
                      <Text className="text-notion-text-secondary text-[11px] mt-0.5">Optional hospitality service fee</Text>
                    </View>
                    <RNSwitch 
                      value={applyServiceCharge} 
                      onValueChange={setApplyServiceCharge}
                      trackColor={{ false: '#e9e9e7', true: '#2eaadc' }}
                      thumbColor="#ffffff"
                    />
                  </View>

                  <View className="flex-row justify-between items-center mb-4 pb-4 border-b border-notion-border dark:border-white/5">
                    <View>
                      <Text className="text-notion-text dark:text-white font-bold text-sm">VAT (13%)</Text>
                      <Text className="text-notion-text-secondary text-[11px] mt-0.5">Government value added tax</Text>
                    </View>
                    <RNSwitch 
                      value={applyVat} 
                      onValueChange={setApplyVat}
                      trackColor={{ false: '#e9e9e7', true: '#2eaadc' }}
                      thumbColor="#ffffff"
                    />
                  </View>

                  {/* Promo Coupon Validation */}
                  <View className="mb-4">
                    <Text className="text-notion-text dark:text-white font-bold text-xs uppercase tracking-widest mb-2">Apply Promo Code</Text>
                    <View className="flex-row gap-2">
                      <View className="flex-1 flex-row items-center bg-notion-bg-secondary dark:bg-notion-bg-tertiary px-3 rounded-xl border border-notion-border dark:border-transparent">
                        <Ticket size={16} className="text-notion-text-secondary mr-2" />
                        <TextInput
                          value={couponCode}
                          onChangeText={setCouponCode}
                          placeholder="Promo code"
                          placeholderTextColor="#9ca3af"
                          autoCapitalize="characters"
                          disabled={!!appliedCoupon}
                          className="flex-1 text-notion-text dark:text-white py-2 text-sm font-medium"
                        />
                      </View>
                      {appliedCoupon ? (
                        <TouchableOpacity 
                          onPress={handleRemoveCoupon}
                          className="px-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-xl items-center justify-center"
                        >
                          <Text className="text-notion-red text-xs font-bold uppercase tracking-wider">Remove</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity 
                          onPress={handleApplyCoupon}
                          disabled={couponLoading || !couponCode.trim()}
                          className="px-5 bg-notion-blue rounded-xl items-center justify-center flex-row shadow-sm"
                        >
                          {couponLoading ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                          ) : (
                            <Text className="text-white text-xs font-bold uppercase tracking-wider">Apply</Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Payment Method Selector */}
                  <View className="mb-4 pt-2 border-t border-notion-border dark:border-white/5">
                    <Text className="text-notion-text dark:text-white font-bold text-xs uppercase tracking-widest mb-3">Settlement Status / Method</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {settlementMethods.map((method) => {
                        const active = paymentMethod === method;
                        return (
                          <TouchableOpacity
                            key={method}
                            onPress={() => { light(); setPaymentMethod(method); setFonepayPaid(false); setFonepayPrn(''); }}
                            className={`px-3 py-2.5 rounded-xl border min-w-[30%] items-center justify-center ${
                              active 
                                ? 'bg-notion-text border-notion-text' 
                                : 'bg-notion-bg-secondary dark:bg-notion-bg-tertiary border-notion-border dark:border-transparent'
                            }`}
                          >
                            <Text className={`text-xs font-bold tracking-wider uppercase ${active ? 'text-white' : 'text-notion-text dark:text-white'}`}>
                              {method === 'UNPAID' ? 'Keep Open' : getPaymentMethodLabel(method)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {paymentMethod === 'FONEPAY' && grandTotal > 0 && (
                    <FonepayQrPanel
                      amount={grandTotal}
                      remarks={`POS ${orderType}`}
                      onPaid={(prn) => { setFonepayPrn(prn); setFonepayPaid(true); }}
                    />
                  )}

                  {isQrPaymentMethod(paymentMethod) && paymentMethod !== 'FONEPAY' && grandTotal > 0 && paymentConfig?.paymentQrs?.[paymentMethod]?.imageUrl && (
                    <View className="mb-4 items-center p-4 bg-notion-bg-secondary dark:bg-notion-bg-tertiary rounded-xl">
                      <Image
                        source={{ uri: resolveAssetUrl(paymentConfig.paymentQrs[paymentMethod]!.imageUrl) }}
                        style={{ width: 180, height: 180, borderRadius: 8 }}
                        resizeMode="contain"
                      />
                      <Text className="text-notion-text-secondary text-xs mt-2 text-center">
                        {paymentConfig.paymentQrs[paymentMethod]?.label || `Scan ${getPaymentMethodLabel(paymentMethod)} to pay`}
                      </Text>
                    </View>
                  )}

                  {/* Cash Tendered Input for CASH */}
                  {paymentMethod === 'CASH' && (
                    <MotiView 
                      from={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 75 }}
                      className="mb-4 overflow-hidden"
                    >
                      <Text className="text-notion-text dark:text-white font-bold text-xs uppercase tracking-widest mb-2">Cash Tendered (NPR)</Text>
                      <View className="flex-row items-center bg-notion-bg-secondary dark:bg-notion-bg-tertiary px-3 py-2.5 rounded-xl border border-notion-border dark:border-transparent">
                        <TextInput
                          value={cashTendered}
                          onChangeText={setCashTendered}
                          placeholder="Enter cash amount paid..."
                          keyboardType="numeric"
                          placeholderTextColor="#9ca3af"
                          className="flex-1 text-notion-text dark:text-white py-0 text-sm font-semibold"
                        />
                      </View>
                    </MotiView>
                  )}
                </View>
              )}

              {/* 4. Complete Totals summary card */}
              {(cart.length > 0 || activeOrder) && (
                <View className="bg-notion-bg dark:bg-notion-bg-secondary p-4 rounded-2xl border border-notion-border dark:border-white/5 shadow-sm">
                  <Text className="text-notion-text-secondary text-xs uppercase tracking-widest font-extrabold mb-3 pb-2 border-b border-notion-border dark:border-white/5">Summary</Text>
                  
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-notion-text-secondary text-sm">Subtotal</Text>
                    <Text className="text-notion-text dark:text-white font-bold text-sm">{formatAmount(subTotal)}</Text>
                  </View>

                  {applyServiceCharge ? (
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-notion-text-secondary text-sm">Service Charge (10%)</Text>
                      <Text className="text-notion-text dark:text-white font-bold text-sm">{formatAmount(serviceCharge)}</Text>
                    </View>
                  ) : null}

                  {applyVat ? (
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-notion-text-secondary text-sm">VAT (13%)</Text>
                      <Text className="text-notion-text dark:text-white font-bold text-sm">{formatAmount(vatAmount)}</Text>
                    </View>
                  ) : null}

                  {discount > 0 ? (
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-green-600 text-sm font-semibold">Discount ({appliedCoupon?.code})</Text>
                      <Text className="text-green-600 font-bold text-sm">-{formatAmount(discount)}</Text>
                    </View>
                  ) : null}

                  <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-notion-border dark:border-white/5">
                    <Text className="text-notion-text dark:text-white font-extrabold text-base">Grand Total</Text>
                    <Text className="text-notion-blue dark:text-white font-black text-xl">{formatAmount(grandTotal)}</Text>
                  </View>

                  {paymentMethod === 'CASH' && cashTendered.trim() ? (
                    <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-dashed border-notion-border dark:border-white/5">
                      <Text className="text-notion-text-secondary text-sm font-bold">Change Return</Text>
                      <Text className="text-green-600 font-black text-base">{formatAmount(changeDue)}</Text>
                    </View>
                  ) : null}

                  {/* Receipt Preview Option */}
                  <TouchableOpacity 
                    onPress={() => { light(); setIsReceiptOpen(true); }}
                    className="mt-5 flex-row items-center justify-center py-3 rounded-xl border border-notion-blue border-dashed"
                  >
                    <Receipt size={16} className="text-notion-blue mr-2" />
                    <Text className="text-notion-blue font-bold text-xs uppercase tracking-widest">Show Receipt Bill Preview</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Cart Footer */}
          {(cart.length > 0 || activeOrder) && (
            <View className="p-4 border-t border-notion-border dark:border-white/5 bg-notion-bg dark:bg-notion-bg-secondary flex-row gap-3">
              {/* Back out button */}
              <TouchableOpacity
                onPress={() => setIsCartOpen(false)}
                className="px-5 border border-notion-border dark:border-white/10 py-4 rounded-xl items-center justify-center"
              >
                <Text className="text-notion-text dark:text-white font-bold text-sm">Close</Text>
              </TouchableOpacity>
              
              {/* Final Submit action */}
              {canCreateOrders ? (
                paymentMethod !== 'UNPAID' && !canRecordPayment ? (
                  <View className="flex-1 justify-center items-center bg-notion-bg-secondary dark:bg-notion-bg-tertiary rounded-xl px-3">
                    <Text className="text-notion-text-secondary text-xs font-bold uppercase tracking-wider text-center">No Permission to Record Payments</Text>
                  </View>
                ) : (
                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={(cart.length === 0 && !activeOrder) || isSubmitting}
                  onPress={placeOrder}
                  className="flex-1 py-4 bg-notion-blue rounded-xl items-center justify-center flex-row shadow-sm"
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      <CreditCard size={18} color="white" className="mr-2" />
                      <Text className="font-bold text-white text-base">
                        {paymentMethod !== 'UNPAID' ? 'Confirm Payment & Complete' : (activeOrder ? 'Fire Items to Kitchen' : 'Place Order')}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                )
              ) : (
                <View className="flex-1 justify-center items-center bg-notion-bg-secondary dark:bg-notion-bg-tertiary rounded-xl">
                  <Text className="text-notion-text-secondary text-xs font-bold uppercase tracking-wider">No Permission to Place Orders</Text>
                </View>
              )}
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* Merge Modal */}
      <Modal visible={isMergeModalOpen} transparent animationType="fade" onRequestClose={() => setIsMergeModalOpen(false)}>
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="bg-notion-bg dark:bg-notion-bg-secondary w-full rounded-2xl p-5 border border-notion-border dark:border-white/5 shadow-lg">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-bold text-notion-text dark:text-white">Merge Table</Text>
              <TouchableOpacity onPress={() => setIsMergeModalOpen(false)} className="bg-notion-bg-secondary dark:bg-notion-bg-tertiary p-2 rounded-full border border-notion-border dark:border-transparent">
                <X size={20} className="text-notion-text dark:text-white" />
              </TouchableOpacity>
            </View>
            <Text className="text-notion-text-secondary dark:text-white/60 mb-4">Select an active table to merge into Table {table?.tableNumber || tableId}:</Text>
            {mergeableOrders.length === 0 ? (
               <Text className="text-center text-notion-text-secondary py-4">No other active orders available to merge.</Text>
            ) : (
               <ScrollView style={{ maxHeight: 300 }}>
                 {mergeableOrders.map((o: any) => {
                   const t = tables?.find((tb: any) => String(tb.id) === String(getOrderTableId(o)));
                   return (
                     <TouchableOpacity 
                       key={o.id} 
                       onPress={() => mergeTableMutation.mutate(String(o.id))}
                       disabled={mergeTableMutation.isPending}
                       className="p-4 border border-notion-border dark:border-white/5 rounded-xl mb-2 flex-row justify-between items-center bg-notion-bg-secondary dark:bg-notion-bg-tertiary"
                     >
                       <View>
                         <Text className="font-bold text-notion-text dark:text-white text-base">Table {t?.tableNumber || getOrderTableId(o)}</Text>
                         <Text className="text-notion-text-secondary dark:text-white/40 text-xs mt-0.5">Order #{o.id}</Text>
                       </View>
                       <Text className="text-notion-text dark:text-white font-bold text-sm">{formatAmount(o.totalAmount)}</Text>
                     </TouchableOpacity>
                   );
                 })}
               </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Visual Paper Receipt Modal */}
      <Modal visible={isReceiptOpen} animationType="slide" transparent={true} onRequestClose={() => setIsReceiptOpen(false)}>
        <View className="flex-1 bg-black/60 justify-center p-6">
          {/* Paper receipt container */}
          <MotiView 
            from={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-t-3xl p-6 border-b-8 border-dashed border-gray-300 relative shadow-2xl"
          >
            {/* Close button */}
            <TouchableOpacity 
              onPress={() => setIsReceiptOpen(false)}
              className="absolute right-4 top-4 bg-gray-100 p-2 rounded-full"
            >
              <X size={18} color="#37352f" />
            </TouchableOpacity>

            <View className="items-center mt-2 mb-4">
              <Text className="font-extrabold text-gray-800 text-lg uppercase tracking-widest">{user?.hotel?.name || 'NIVAS HOTEL'}</Text>
              <Text className="text-[11px] text-gray-500 mt-0.5 tracking-wider uppercase">Receipt Bill Preview</Text>
              <Text className="text-[10px] text-gray-400 mt-1">{new Date().toLocaleString()}</Text>
              <Text className="text-[11px] text-gray-600 font-bold mt-1 uppercase">
                {orderType === 'DINE_IN' ? `Table: ${table?.tableNumber || (tableId !== 'new' ? tableId : 'N/A')}` : orderType === 'ROOM_SERVICE' ? `Room: ${selectedRoom?.roomNumber || 'N/A'}` : 'Takeaway / Walk-in'}
                {activeOrder ? ` | Order #${activeOrder.id}` : ' | New Order'}
              </Text>
            </View>

            {/* Dotted Divider */}
            <View className="border-t border-dashed border-gray-400 my-3" />

            {/* Fired Items */}
            {activeOrder?.items?.map((item: any, idx: number) => (
              <View key={`r-active-${idx}`} className="flex-row justify-between mb-2">
                <Text className="text-gray-700 text-xs flex-1 pr-4 font-semibold">{item.quantity}x {item.menuItem?.name || 'Item'}</Text>
                <Text className="text-gray-800 text-xs font-bold">{formatAmount(Number(item.price) * item.quantity)}</Text>
              </View>
            ))}

            {/* Draft Items */}
            {cart.map((item, idx) => (
              <View key={`r-cart-${idx}`} className="flex-row justify-between mb-2">
                <Text className="text-gray-600 text-xs flex-1 pr-4 italic">{item.quantity}x {item.name} (Draft)</Text>
                <Text className="text-gray-800 text-xs font-bold italic">{formatAmount(item.price * item.quantity)}</Text>
              </View>
            ))}

            {/* Dotted Divider */}
            <View className="border-t border-dashed border-gray-400 my-3" />

            {/* Calculations */}
            <View className="flex-row justify-between mb-1.5">
              <Text className="text-gray-600 text-[11px]">Subtotal</Text>
              <Text className="text-gray-800 text-[11px] font-bold">{formatAmount(subTotal)}</Text>
            </View>

            {applyServiceCharge ? (
              <View className="flex-row justify-between mb-1.5">
                <Text className="text-gray-600 text-[11px]">Service Charge (10%)</Text>
                <Text className="text-gray-800 text-[11px] font-bold">{formatAmount(serviceCharge)}</Text>
              </View>
            ) : null}

            {applyVat ? (
              <View className="flex-row justify-between mb-1.5">
                <Text className="text-gray-600 text-[11px]">VAT (13%)</Text>
                <Text className="text-gray-800 text-[11px] font-bold">{formatAmount(vatAmount)}</Text>
              </View>
            ) : null}

            {discount > 0 ? (
              <View className="flex-row justify-between mb-1.5">
                <Text className="text-green-700 text-[11px] font-bold">Discount ({appliedCoupon?.code})</Text>
                <Text className="text-green-700 text-[11px] font-bold">-{formatAmount(discount)}</Text>
              </View>
            ) : null}

            <View className="flex-row justify-between mt-2 pt-2 border-t border-gray-300">
              <Text className="text-gray-900 font-extrabold text-sm uppercase tracking-wider">Grand Total</Text>
              <Text className="text-gray-900 font-black text-base">{formatAmount(grandTotal)}</Text>
            </View>

            {/* Dotted Divider */}
            <View className="border-t border-dashed border-gray-400 my-3" />

            <View className="flex-row justify-between mb-1">
              <Text className="text-gray-600 text-[11px] uppercase font-semibold">Payment Method</Text>
              <Text className="text-gray-800 text-[11px] font-bold uppercase">{paymentMethod}</Text>
            </View>

            {paymentMethod === 'CASH' && cashTendered.trim() ? (
              <>
                <View className="flex-row justify-between mb-1">
                  <Text className="text-gray-600 text-[11px]">Cash Tendered</Text>
                  <Text className="text-gray-800 text-[11px] font-bold">{formatAmount(parseFloat(cashTendered))}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-gray-600 text-[11px] font-bold">Change Due</Text>
                  <Text className="text-green-700 text-[11px] font-extrabold">{formatAmount(changeDue)}</Text>
                </View>
              </>
            ) : null}

            <View className="items-center mt-5 mb-2">
              <Text className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Thank you for dining with us!</Text>
            </View>
          </MotiView>
          
          {/* Close bar action */}
          <TouchableOpacity 
            onPress={() => setIsReceiptOpen(false)}
            className="bg-notion-text py-4 rounded-b-3xl items-center justify-center flex-row shadow"
          >
            <Check size={16} color="white" className="mr-2" />
            <Text className="text-white font-bold text-sm uppercase tracking-widest">Done Reading Preview</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}
