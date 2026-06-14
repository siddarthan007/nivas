import { useEffect, useState } from 'react';
import { View, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Package, CircleCheck, XCircle, Truck, DollarSign, User, Calendar, FileText } from 'lucide-react-native';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Heading, Subheading, Text, Caption } from '@/components/ui/Typography';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { useHaptics } from '@/hooks/useHaptics';
import { hasPermission } from '@/utils/permissions';
import { useAuthStore } from '@/stores/authStore';
import { formatAmount } from '@/utils/currency';
import { trackScreenView } from '@/utils/analytics';
import { PersonaGate } from '@/components/auth/PersonaGate';
import { ScreenBody } from '@/components/layout/ScreenBody';
import Toast from 'react-native-toast-message';

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  DRAFT: { bg: 'bg-notion-bg-secondary', text: 'text-notion-text-secondary', border: 'border-notion-border' },
  APPROVED: { bg: 'bg-notion-green-bg', text: 'text-notion-green', border: 'border-notion-green-bg' },
  REJECTED: { bg: 'bg-notion-red-bg', text: 'text-notion-red', border: 'border-notion-red-bg' },
  RECEIVED: { bg: 'bg-notion-blue-bg', text: 'text-notion-blue', border: 'border-notion-blue-bg' },
  PARTIALLY_RECEIVED: { bg: 'bg-notion-yellow-bg', text: 'text-notion-yellow', border: 'border-notion-yellow-bg' },
  CANCELLED: { bg: 'bg-notion-text/10', text: 'text-notion-text-secondary', border: 'border-notion-border' },
};

export default function ProcurementScreen() {
  const router = useRouter();
  const { light, success: successHaptic, error: errorHaptic } = useHaptics();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedPO, setSelectedPO] = useState<any>(null);

  const canManageProcurement = hasPermission(user, 'inventory:manage_procurement');

  useEffect(() => {
    trackScreenView('ProcurementScreen');
  }, []);

  const { data: pos, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['purchase_orders'],
    queryFn: async () => {
      const res = await (api as any).procurement['purchase-orders'].get();
      if (res.error) throw res.error;
      return res.data?.data || [];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await (api as any).procurement['purchase-orders']({ id }).approve.post();
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      successHaptic();
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      Toast.show({ type: 'success', text1: 'PO Approved' });
    },
    onError: (err: any) => {
      errorHaptic();
      Toast.show({ type: 'error', text1: 'Approval failed', text2: err.message });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await (api as any).procurement['purchase-orders']({ id }).reject.post();
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      successHaptic();
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      Toast.show({ type: 'success', text1: 'PO Rejected' });
    },
    onError: (err: any) => {
      errorHaptic();
      Toast.show({ type: 'error', text1: 'Rejection failed', text2: err.message });
    },
  });

  const receiveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await (api as any).procurement['purchase-orders']({ id }).receive.patch({});
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      successHaptic();
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      Toast.show({ type: 'success', text1: 'Goods Received (GRN)' });
    },
    onError: (err: any) => {
      errorHaptic();
      Toast.show({ type: 'error', text1: 'Receive failed', text2: err.message });
    },
  });

  if (isError) {
    return (
      <View className="flex-1 bg-notion-bg-secondary pt-12">
        <View className="px-4 pb-4">
          <TouchableOpacity onPress={() => { light(); router.back(); }} className="w-10 h-10 items-center justify-center bg-notion-bg dark:bg-white/5 rounded-full border border-notion-border">
            <ChevronLeft size={24} color="#37352f" />
          </TouchableOpacity>
        </View>
        <ErrorState onRetry={refetch} />
      </View>
    );
  }

  return (
    <PersonaGate tab="procurement">
    <View
      className="flex-1 bg-notion-bg-secondary dark:bg-notion-bg">
      <View className="bg-notion-bg dark:bg-notion-bg-secondary border-b border-notion-border pt-14 pb-4 px-4 flex-row items-center">
        <TouchableOpacity onPress={() => { light(); router.back(); }} className="w-10 h-10 items-center justify-center bg-notion-bg-secondary dark:bg-white/5 rounded-full">
          <ChevronLeft size={24} color="#37352f" />
        </TouchableOpacity>
        <View className="ml-3 flex-1">
          <Heading className="text-notion-text">Purchase Orders</Heading>
        </View>
        <View className="w-10 h-10" />
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1a365d" />
        </View>
      ) : (
        <ScrollView
          className="flex-1 p-4"
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#37352f" />}
        >
          <ScreenBody maxWidth={960}>
          {(pos || []).length === 0 ? (
            <EmptyState
              title="No Purchase Orders"
              description="There are no purchase orders in the system."
              icon={<Package size={32} color="#9ca3af" />}
            />
          ) : (
            (pos || []).map((po: any) => {
              const style = STATUS_COLORS[po.status] || STATUS_COLORS.DRAFT;
              return (
                <TouchableOpacity
                  key={po.id}
                  activeOpacity={0.7}
                  onPress={() => { light(); setSelectedPO(po); }}
                >
                  <Card variant="elevated" className={`mb-3 border ${style.border}`} padding="md">
                    <View className="flex-row justify-between items-start mb-2">
                      <View className="flex-1">
                        <Text className="font-bold text-notion-text">{po.poNumber}</Text>
                        <Text className="text-notion-text-secondary text-sm">{po.supplierName || 'Unknown Supplier'}</Text>
                      </View>
                      <View className={`px-2 py-0.5 rounded ${style.bg}`}>
                        <Text className={`text-[10px] font-bold ${style.text}`}>{po.status?.replace('_', ' ')}</Text>
                      </View>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center">
                        <DollarSign size={14} color="#9ca3af" />
                        <Text className="text-notion-text-secondary text-sm ml-1">{formatAmount(po.totalCost || 0)}</Text>
                      </View>
                      <Caption className="text-notion-text-secondary">{new Date(po.createdAt).toLocaleDateString()}</Caption>
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })
          )}
          </ScreenBody>
        </ScrollView>
      )}

      {/* PO Detail Modal */}
      <Modal visible={!!selectedPO} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedPO(null)}>
        <SafeAreaView className="flex-1 bg-notion-bg dark:bg-notion-bg">
          <View className="flex-row items-center justify-between p-4 border-b border-notion-border">
            <View className="flex-1">
              <Text className="text-xl font-bold text-notion-text">{selectedPO?.poNumber}</Text>
              <Text className="text-notion-text-secondary text-sm">{selectedPO?.status?.replace('_', ' ')}</Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedPO(null)} className="bg-notion-bg-secondary p-2 rounded-full">
              <XCircle size={24} color="#37352f" />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 p-4">
            <Card className="mb-4 border border-notion-border" padding="md">
              <View className="flex-row items-center mb-3">
                <User size={16} color="#9ca3af" />
                <Text className="text-notion-text-secondary text-sm ml-2">{selectedPO?.supplierName || 'Unknown Supplier'}</Text>
              </View>
              <View className="flex-row items-center mb-3">
                <Calendar size={16} color="#9ca3af" />
                <Text className="text-notion-text-secondary text-sm ml-2">{selectedPO?.createdAt ? new Date(selectedPO.createdAt).toLocaleString() : '—'}</Text>
              </View>
              <View className="flex-row items-center mb-3">
                <DollarSign size={16} color="#9ca3af" />
                <Text className="text-notion-text font-bold text-lg ml-2">{formatAmount(selectedPO?.totalCost || 0)}</Text>
              </View>
              {selectedPO?.notes && (
                <View className="flex-row items-start">
                  <FileText size={16} color="#9ca3af" style={{ marginTop: 2 }} />
                  <Text className="text-notion-text-secondary text-sm ml-2 flex-1">{selectedPO.notes}</Text>
                </View>
              )}
            </Card>

            <Subheading className="text-notion-text-secondary uppercase tracking-widest text-xs mb-3">Items</Subheading>
            {(selectedPO?.items || []).length > 0 ? (
              (selectedPO?.items || []).map((item: any, idx: number) => (
                <Card key={idx} className="mb-2 border border-notion-border" padding="sm">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-notion-text font-medium">{item.name || `Item #${item.itemId}`}</Text>
                    <Text className="text-notion-text-secondary text-sm">{item.quantity} x {formatAmount(item.unitCost || 0)}</Text>
                  </View>
                </Card>
              ))
            ) : (
              <Text className="text-notion-text-secondary text-center py-4">No items listed.</Text>
            )}

            <View className="h-20" />
          </ScrollView>

          {/* Action Buttons */}
          {canManageProcurement && selectedPO && (
            <View className="p-4 border-t border-notion-border bg-notion-bg">
              {selectedPO.status === 'DRAFT' && (
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => { light(); approveMutation.mutate(selectedPO.id); }}
                    disabled={approveMutation.isPending}
                    className="flex-1 bg-notion-green p-4 rounded-xl flex-row items-center justify-center"
                  >
                    {approveMutation.isPending ? <ActivityIndicator color="white" /> : (
                      <>
                        <CircleCheck size={18} color="white" style={{ marginRight: 8 }} />
                        <Text className="text-white font-bold">Approve</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { light(); rejectMutation.mutate(selectedPO.id); }}
                    disabled={rejectMutation.isPending}
                    className="flex-1 bg-notion-red p-4 rounded-xl flex-row items-center justify-center"
                  >
                    {rejectMutation.isPending ? <ActivityIndicator color="white" /> : (
                      <>
                        <XCircle size={18} color="white" style={{ marginRight: 8 }} />
                        <Text className="text-white font-bold">Reject</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {(selectedPO.status === 'APPROVED' || selectedPO.status === 'PARTIALLY_RECEIVED') && (
                <TouchableOpacity
                  onPress={() => { light(); receiveMutation.mutate(selectedPO.id); }}
                  disabled={receiveMutation.isPending}
                  className="bg-notion-blue p-4 rounded-xl flex-row items-center justify-center"
                >
                  {receiveMutation.isPending ? <ActivityIndicator color="white" /> : (
                    <>
                      <Truck size={18} color="white" style={{ marginRight: 8 }} />
                      <Text className="text-white font-bold">Receive Goods (GRN)</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </View>
    </PersonaGate>
  );
}
