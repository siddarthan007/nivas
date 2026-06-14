import { useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGlobalSearchParams, useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { ChevronLeft, Plus, Minus, Receipt, User, Clock, CircleCheck } from 'lucide-react-native';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Heading, Subheading, Text, Caption } from '@/components/ui/Typography';
import { useHaptics } from '@/hooks/useHaptics';
import { formatAmount } from '@/utils/currency';
import { hasPermission } from '@/utils/permissions';
import { useSettingsStore } from '@/stores/settingsStore';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import Toast from 'react-native-toast-message';
import { orderMatchesTable } from '@/utils/orderTableId';
import { Swipeable } from 'react-native-gesture-handler';

export default function TableDashboardScreen() {
  const segments = useSegments();
  let tableId: string | undefined;
  try {
    const params = useGlobalSearchParams();
    tableId = params?.id as string;
  } catch (e) {
    // fallback
  }
  if (!tableId && segments.length > 0) {
    tableId = segments[segments.length - 1];
  }
  const router = useRouter();
  const { user } = useAuthStore();
  const { light, success: successHaptic, error: errorHaptic } = useHaptics();
  const queryClient = useQueryClient();
  const canManageOrders = hasPermission(user, 'orders:update_status');
  const canCreateOrders = hasPermission(user, 'orders:create');

  // Fetch Table Info
  const { data: tables, isLoading: tablesLoading } = useQuery({
    queryKey: ['tables'],
    queryFn: async () => {
      const res = await api.operations.tables.get();
      if (res.error) throw res.error;
      return res.data?.data || [];
    },
  });
  const table = tables?.find((t: any) => String(t.id) === String(tableId));

  // Fetch Active Order for Table
  const { data: activeOrders, isLoading: ordersLoading, refetch } = useQuery({
    queryKey: ['active_orders_table', tableId],
    queryFn: async () => {
      const res = await api.orders.get({ query: { status: 'PENDING,PREPARING,READY' } });
      if (res.error) throw res.error;
      return res.data?.data?.filter((o: any) => orderMatchesTable(o, tableId!)) || [];
    },
  });
  const activeOrder = activeOrders?.[0];

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!activeOrder) throw new Error("No active order to checkout.");
      const res = await api.orders({ id: activeOrder.id }).status.patch({ status: 'SERVED' });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      successHaptic();
      Toast.show({ type: 'success', text1: 'Table Cleared', text2: 'Order marked as completed.' });
      queryClient.invalidateQueries({ queryKey: ['active_orders_table', tableId] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      router.back();
    },
    onError: (error: any) => {
      errorHaptic();
      Toast.show({ type: 'error', text1: 'Checkout Failed', text2: error.message });
    }
  });

  const handleAddItems = () => {
    light();
    router.push(`/orders/pos/${tableId}` as any);
  };

  const handleCheckout = () => {
    light();
    checkoutMutation.mutate();
  };

  const updateItemMutation = useMutation({
    mutationFn: async ({ orderId, itemId, quantity }: { orderId: string, itemId: number, quantity: number }) => {
      const res = await (api as any).orders({ id: orderId }).items({ itemId }).patch({ quantity });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      light();
      queryClient.invalidateQueries({ queryKey: ['active_orders_table', tableId] });
    },
    onError: (err: any) => {
      errorHaptic();
      Toast.show({ type: 'error', text1: 'Update Failed', text2: err.message });
    }
  });

  const { requireAuth } = useBiometricAuth();

  const voidItemMutation = useMutation({
    mutationFn: async ({ orderId, itemId }: { orderId: string, itemId: number }) => {
      const res = await (api as any).orders({ id: orderId }).items({ itemId }).void.post({ reason: 'Removed by staff' });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      successHaptic();
      Toast.show({ type: 'success', text1: 'Item Removed' });
      queryClient.invalidateQueries({ queryKey: ['active_orders_table', tableId] });
    },
    onError: (err: any) => {
      errorHaptic();
      Toast.show({ type: 'error', text1: 'Remove Failed', text2: err.message });
    }
  });

  const handleUpdateQuantity = async (orderId: string, itemId: number, currentQty: number, delta: number) => {
    const newQty = currentQty + delta;
    if (newQty <= 0) {
      const authorized = await requireAuth('Authenticate to void item');
      if (authorized) {
        voidItemMutation.mutate({ orderId, itemId });
      }
    } else {
      updateItemMutation.mutate({ orderId, itemId, quantity: newQty });
    }
  };

  const renderRightActions = (orderId: string, itemId: number) => (
    <TouchableOpacity
      onPress={() => voidItemMutation.mutate({ orderId, itemId })}
      className="bg-red-500 w-20 justify-center items-center ml-2 rounded-lg"
    >
      <Text className="text-white font-bold">Remove</Text>
    </TouchableOpacity>
  );

  if (tablesLoading || ordersLoading) {
    return (
      <View className="flex-1 bg-notion-bg items-center justify-center">
        <ActivityIndicator size="large" color="white" />
      </View>
    );
  }

  if (!table) {
    return (
      <View className="flex-1 bg-notion-bg items-center justify-center p-6">
        <Heading className="text-notion-text">Table not found</Heading>
        <TouchableOpacity onPress={() => router.back()} className="mt-6 bg-notion-bg-secondary border border-notion-border p-3 rounded-lg">
          <Text className="text-notion-text">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-notion-bg-secondary dark:bg-notion-bg">
      <SafeAreaView className="bg-notion-bg dark:bg-notion-bg-secondary border-b border-notion-border">
        <View className="px-4 py-4 flex-row items-center justify-between">
          <TouchableOpacity onPress={() => { light(); router.back(); }} className="w-10 h-10 items-center justify-center bg-notion-bg-secondary dark:bg-white/5 rounded-full">
            <ChevronLeft size={24} color="#37352f" />
          </TouchableOpacity>
          <View className="items-center">
            <Heading className="text-notion-text">Table {table.tableNumber}</Heading>
            <Caption className="text-notion-text-secondary">{table.status}</Caption>
          </View>
          <View className="w-10 h-10" />
        </View>
      </SafeAreaView>

      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Active Order Overview */}
        {!activeOrder ? (
          <View className="flex-1 items-center justify-center py-20">
            <View className="w-24 h-24 bg-notion-bg rounded-full items-center justify-center mb-6 border border-notion-border">
              <CircleCheck size={40} color="#9ca3af" />
            </View>
            <Heading className="text-notion-text text-center mb-2">Table is empty</Heading>
            <Text className="text-notion-text-secondary text-center mb-8 px-8">
              There are no running orders for this table. Start a new order to begin.
            </Text>
            
            {canCreateOrders && (
              <TouchableOpacity 
                onPress={handleAddItems}
                className="bg-notion-blue px-8 py-4 rounded-xl flex-row items-center justify-center shadow-sm"
              >
                <Plus size={20} color="white" style={{ marginRight: 8 }} />
                <Text className="text-white font-bold text-lg">Start New Order</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View>
            {/* Order Meta */}
            <Card className="p-4 mb-4 flex-row justify-between items-center border-l-4 border-notion-blue">
              <View>
                <Subheading className="text-notion-text-secondary uppercase tracking-wider text-xs">Running Order</Subheading>
                <Heading className="text-notion-text">#{activeOrder.orderNumber}</Heading>
              </View>
              <View className="bg-notion-bg px-3 py-1 rounded-full flex-row items-center border border-notion-border">
                <Clock size={14} color="#37352f" style={{ marginRight: 6 }} />
                <Text className="text-notion-text font-medium">{activeOrder.status}</Text>
              </View>
            </Card>

            {/* Guest Info (Placeholder) */}
            <Card className="p-4 mb-4 flex-row items-center border border-notion-border">
              <View className="w-12 h-12 bg-notion-bg-secondary rounded-full items-center justify-center mr-4">
                <User size={24} color="#9ca3af" />
              </View>
              <View>
                <Text className="text-notion-text font-bold">Walk-in Guest</Text>
                <Text className="text-notion-text-secondary">No room linked</Text>
              </View>
            </Card>

            {/* KOT Items */}
            <Text className="text-notion-text font-bold text-lg mb-3 mt-4">Order Items</Text>
            {activeOrder.items?.length > 0 ? (
              <View className="gap-y-2">
                {activeOrder.items.map((item: any, i: number) => (
                  <Swipeable
                    key={item.id || i}
                    renderRightActions={() => (canManageOrders && activeOrder.status === 'PENDING') ? renderRightActions(activeOrder.id, item.id) : null}
                    friction={2}
                  >
                    <Card className="p-4 border border-notion-border flex-row justify-between items-center">
                      <View className="flex-row items-center flex-1">
                        {(canManageOrders && activeOrder.status === 'PENDING') ? (
                          <View className="flex-row items-center bg-notion-bg-secondary rounded-lg border border-notion-border mr-3">
                            <TouchableOpacity 
                              onPress={() => handleUpdateQuantity(activeOrder.id, item.id, item.quantity, -1)}
                              className="px-3 py-2"
                              disabled={updateItemMutation.isPending}
                            >
                              <Minus size={16} color="#37352f" />
                            </TouchableOpacity>
                            <Text className="text-notion-text font-bold w-6 text-center">{item.quantity}</Text>
                            <TouchableOpacity 
                              onPress={() => handleUpdateQuantity(activeOrder.id, item.id, item.quantity, 1)}
                              className="px-3 py-2"
                              disabled={updateItemMutation.isPending}
                            >
                              <Plus size={16} color="#37352f" />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <View className="w-8 h-8 bg-notion-bg items-center justify-center rounded mr-3">
                            <Text className="text-notion-text font-bold">{item.quantity}x</Text>
                          </View>
                        )}
                        <View className="flex-1">
                          <Text className="text-notion-text font-medium">{item.menuItem?.name || 'Unknown Item'}</Text>
                          {item.notes && <Text className="text-notion-text-secondary text-xs italic mt-1">Note: {item.notes}</Text>}
                        </View>
                      </View>
                      <Text className="text-notion-text font-semibold">{formatAmount(Number(item.price) * item.quantity)}</Text>
                    </Card>
                  </Swipeable>
                ))}
              </View>
            ) : (
              <Text className="text-notion-text-secondary py-2">No items yet.</Text>
            )}

            {/* Bill Summary */}
            <Card className="p-4 mt-4 bg-notion-bg dark:bg-white/5 border border-notion-border">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-notion-text-secondary">Subtotal</Text>
                <Text className="text-notion-text font-medium">{formatAmount(activeOrder.totalAmount)}</Text>
              </View>
              <View className="flex-row justify-between items-center mt-2 pt-2 border-t border-notion-border">
                <Text className="text-notion-text font-bold text-lg">Total Due</Text>
                <Text className="text-notion-text font-bold text-xl">{formatAmount(activeOrder.totalAmount)}</Text>
              </View>
            </Card>
          </View>
        )}
      </ScrollView>

      {/* Floating Action Buttons */}
      {activeOrder && (
        <View className="absolute bottom-6 left-4 right-4 flex-row gap-3">
          {canCreateOrders && (
            <TouchableOpacity
              onPress={handleAddItems}
              className="flex-1 bg-notion-bg dark:bg-white/10 border border-notion-border py-4 rounded-xl flex-row justify-center items-center"
            >
              <Plus size={20} color="#37352f" style={{ marginRight: 8 }} />
              <Text className="text-notion-text font-bold">Add Items</Text>
            </TouchableOpacity>
          )}

          {canManageOrders && (
            <TouchableOpacity
              onPress={handleCheckout}
              disabled={checkoutMutation.isPending}
              className={`flex-1 bg-notion-blue py-4 rounded-xl flex-row justify-center items-center ${checkoutMutation.isPending ? 'opacity-70' : ''}`}
            >
              {checkoutMutation.isPending ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Receipt size={20} color="white" style={{ marginRight: 8 }} />
                  <Text className="text-white font-bold">Checkout</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}
