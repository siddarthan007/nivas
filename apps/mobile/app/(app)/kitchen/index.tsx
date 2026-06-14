import { useEffect } from 'react';
import { View, ScrollView, RefreshControl, Text, TouchableOpacity } from 'react-native';
import { ClipboardList, CircleCheck, Clock, CircleAlert } from 'lucide-react-native';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { trackScreenView } from '@/utils/analytics';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Heading, Subheading, Caption } from '@/components/ui/Typography';
import { useAuthStore } from '@/stores/authStore';
import { hasPermission } from '@/utils/permissions';
import Toast from 'react-native-toast-message';
import { PersonaGate } from '@/components/auth/PersonaGate';
import { ScreenBody } from '@/components/layout/ScreenBody';
import { useDeviceType } from '@/hooks/useDeviceType';

const getTimeElapsed = (createdAt: string) => {
  const diffMins = Math.floor((new Date().getTime() - new Date(createdAt).getTime()) / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return `${hours}h ${mins}m`;
};

export default function KitchenScreen() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { isTablet } = useDeviceType();
  const canUpdateOrders = hasPermission(user, 'orders:update_status');

  useEffect(() => {
    trackScreenView('KitchenScreen');
  }, []);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['kitchen_orders'],
    queryFn: async () => {
      const res = await api.orders.get({ query: { status: 'PENDING,PREPARING' } });
      if (res.error) throw res.error;
      return res.data?.data || [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'PREPARING' | 'READY' }) => {
      const res = await api.orders({ id }).status.patch({ status });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Order status updated' });
      queryClient.invalidateQueries({ queryKey: ['kitchen_orders'] });
    },
    onError: () => {
      Toast.show({ type: 'error', text1: 'Failed to update status' });
    }
  });

  const updateItemStatus = useMutation({
    mutationFn: async ({ orderId, itemId, status }: { orderId: string; itemId: string; status: 'PREPARING' | 'READY' }) => {
      const res = await api.orders({ id: orderId }).items({ itemId }).patch({ status });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen_orders'] });
    },
    onError: () => {
      Toast.show({ type: 'error', text1: 'Failed to update item status' });
    }
  });

  const orders = data || [];

  return (
    <PersonaGate tab="kitchen">
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1 bg-notion-bg-secondary"
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#37352f" />}
      contentContainerStyle={orders.length === 0 ? { flex: 1 } : undefined}
    >
      <View className="bg-notion-bg px-6 pt-16 pb-6 border-b border-notion-border mb-4">
        <Heading className="text-3xl">Kitchen KOTs</Heading>
        <Text className="text-notion-text-secondary mt-1">Manage active orders</Text>
      </View>

      {isError && <ErrorState onRetry={refetch} />}
      {!isError && orders.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={48} color="#9ca3af" />}
          title="No Active Orders"
          description="There are currently no orders to prepare."
        />
      ) : !isError && (
        <ScreenBody maxWidth={960}>
        <View className="px-6 pb-8 flex-row flex-wrap" style={{ gap: 16 }}>
          {orders.map((order: any) => {
            const itemsDone = (order.items || []).filter((i: any) => i.status === 'READY').length;
            const totalItems = (order.items || []).length;
            
            return (
            <View key={order.id} style={{ width: isTablet ? '48%' : '100%' }}>
            <Card padding="md" variant="elevated" className={`border-l-4 ${order.status === 'PREPARING' ? 'border-notion-purple' : 'border-notion-orange'}`}>
              <View className="flex-row justify-between items-center mb-3">
                <View className="flex-row items-center gap-2">
                  <Subheading className="font-bold">Order #{order.orderNumber}</Subheading>
                  <View className="flex-row items-center gap-1 opacity-70">
                    <Clock size={12} color="#37352f" />
                    <Caption>{getTimeElapsed(order.createdAt)}</Caption>
                  </View>
                </View>
                <View className={`px-2 py-1 rounded ${order.status === 'PREPARING' ? 'bg-notion-purple-bg' : 'bg-notion-orange-bg'}`}>
                  <Caption className={order.status === 'PREPARING' ? 'text-notion-purple font-semibold' : 'text-notion-orange font-semibold'}>
                    {order.status}
                  </Caption>
                </View>
              </View>

              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-sm text-notion-text-secondary">
                  {order.orderType?.replace('_', ' ')} • {order.room ? `Room ${order.room.number}` : order.table ? `Table ${order.table.tableNumber}` : 'Walk-in'}
                </Text>
                <Text className={`text-sm font-semibold ${itemsDone === totalItems ? 'text-notion-green' : 'text-notion-text-secondary'}`}>
                  {itemsDone}/{totalItems} items
                </Text>
              </View>

              <View className="bg-notion-bg-secondary p-2 rounded-md mb-4 gap-1">
                {order.items?.map((item: any, idx: number) => (
                  <View key={item.id || idx} className="flex-row items-center py-2 border-b border-notion-border last:border-b-0" style={{ opacity: item.status === 'READY' ? 0.5 : 1 }}>
                    {canUpdateOrders && (
                      <TouchableOpacity
                        className={`w-6 h-6 mr-3 rounded border-2 items-center justify-center ${item.status === 'READY' ? 'border-notion-green bg-notion-green' : 'border-notion-border'}`}
                        onPress={() => updateItemStatus.mutate({ 
                          orderId: order.id, 
                          itemId: item.id, 
                          status: item.status === 'READY' ? 'PREPARING' : 'READY' 
                        })}
                      >
                        {item.status === 'READY' && <CircleCheck size={14} color="white" />}
                      </TouchableOpacity>
                    )}
                    <View className="flex-1">
                      <Text className={`text-sm font-medium ${item.status === 'READY' ? 'line-through' : ''}`}>{item.menuItem?.name || 'Item'}</Text>
                      {item.notes && <Caption className="text-notion-orange">Note: {item.notes}</Caption>}
                    </View>
                    <Text className={`text-lg font-bold ml-2 ${item.status === 'READY' ? 'line-through text-notion-text-secondary' : 'text-notion-text'}`}>
                      x{item.quantity}
                    </Text>
                  </View>
                ))}
              </View>

              <View className="flex-row justify-end gap-2">
                {canUpdateOrders && order.status === 'PENDING' && (
                  <TouchableOpacity
                    className="bg-notion-purple px-4 py-2 rounded-md"
                    onPress={() => updateStatus.mutate({ id: order.id, status: 'PREPARING' })}
                  >
                    <Text className="text-white font-semibold">Start Preparing</Text>
                  </TouchableOpacity>
                )}
                {canUpdateOrders && order.status === 'PREPARING' && (
                  <TouchableOpacity
                    className="bg-notion-green flex-row items-center gap-2 px-4 py-2 rounded-md"
                    onPress={() => updateStatus.mutate({ id: order.id, status: 'READY' })}
                  >
                    <CircleCheck size={16} color="white" />
                    <Text className="text-white font-semibold">Mark Whole Order Ready</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Card>
            </View>
          )})}
        </View>
        </ScreenBody>
      )}
    </ScrollView>
    </PersonaGate>
  );
}
