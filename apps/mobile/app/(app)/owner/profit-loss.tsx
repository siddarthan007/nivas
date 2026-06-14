import { View, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { hasPermission } from '@/utils/permissions';
import { api } from '@/api/client';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Heading, Subheading, Text, Caption } from '@/components/ui/Typography';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChevronLeft, BarChart, ShieldAlert } from 'lucide-react-native';
import { formatAmount } from '@/utils/currency';
import { useHaptics } from '@/hooks/useHaptics';

export default function OwnerProfitLossScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { light } = useHaptics();
  const canViewFinancials = hasPermission(user, 'analytics:view_financials');

  if (!canViewFinancials) {
    return (
      <View className="flex-1 bg-notion-bg-secondary items-center justify-center p-6">
        <ShieldAlert size={48} color="#9ca3af" />
        <Heading className="text-notion-text mt-4">Access Denied</Heading>
        <Text className="text-notion-text-secondary text-center mt-2">You don't have permission to view profit & loss data.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-6 bg-notion-bg-secondary border border-notion-border p-3 rounded-lg">
          <Text className="text-notion-text">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { data: plData, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['owner_profit_loss'],
    queryFn: async () => {
      const res = await api.finance.gl['profit-loss'].get();
      if (res.error) throw res.error;
      return res.data?.data;
    },
  });

  if (isError) {
    return (
      <View className="flex-1 bg-notion-bg-secondary pt-12">
        <View className="px-4 pb-4">
          <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center bg-notion-bg dark:bg-white/5 rounded-full border border-notion-border">
            <ChevronLeft size={24} color="#37352f" />
          </TouchableOpacity>
        </View>
        <ErrorState onRetry={refetch} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-notion-bg-secondary dark:bg-notion-bg">
      <View className="bg-notion-bg dark:bg-notion-bg-secondary border-b border-notion-border pt-14 pb-4 px-4 flex-row items-center">
        <TouchableOpacity onPress={() => { light(); router.back(); }} className="w-10 h-10 items-center justify-center bg-notion-bg-secondary dark:bg-white/5 rounded-full mr-3">
          <ChevronLeft size={24} color="#37352f" />
        </TouchableOpacity>
        <Heading className="text-notion-text">Profit & Loss</Heading>
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
          {!plData ? (
            <EmptyState 
              title="No Financial Data" 
              description="There is no financial data to generate a P&L statement."
              icon={<BarChart size={32} color="#9ca3af" />}
            />
          ) : (
            <View>
              {/* Revenue Section */}
              <Card variant="elevated" padding="md" className="mb-4 border-notion-border">
                <Subheading className="text-notion-green uppercase tracking-widest text-xs mb-3">Revenue</Subheading>
                {plData.revenue?.map((acc: any, i: number) => (
                  <View key={i} className="flex-row justify-between py-2 border-b border-notion-border/50">
                    <Text className="text-notion-text">{acc.name}</Text>
                    <Text className="text-notion-text font-mono">{formatAmount(acc.amount)}</Text>
                  </View>
                ))}
                <View className="flex-row justify-between mt-3 pt-2">
                  <Text className="font-bold text-notion-text">Total Revenue</Text>
                  <Text className="font-bold text-notion-green font-mono text-lg">{formatAmount(plData.totalRevenue || 0)}</Text>
                </View>
              </Card>

              {/* Expenses Section */}
              <Card variant="elevated" padding="md" className="mb-4 border-notion-border">
                <Subheading className="text-notion-red uppercase tracking-widest text-xs mb-3">Expenses</Subheading>
                {plData.expense?.map((acc: any, i: number) => (
                  <View key={i} className="flex-row justify-between py-2 border-b border-notion-border/50">
                    <Text className="text-notion-text">{acc.name}</Text>
                    <Text className="text-notion-text font-mono">{formatAmount(acc.amount)}</Text>
                  </View>
                ))}
                <View className="flex-row justify-between mt-3 pt-2">
                  <Text className="font-bold text-notion-text">Total Expenses</Text>
                  <Text className="font-bold text-notion-red font-mono text-lg">{formatAmount(plData.totalExpense || 0)}</Text>
                </View>
              </Card>

              {/* Net Income Section */}
              <Card variant="elevated" padding="md" className="mb-8 border-notion-blue bg-notion-blue/5">
                <View className="flex-row justify-between items-center">
                  <Heading className="text-notion-text text-xl">Net Income</Heading>
                  <Heading className={`text-xl ${(plData.netProfit || 0) >= 0 ? 'text-notion-green' : 'text-notion-red'} font-mono`}>
                    {formatAmount(plData.netProfit || 0)}
                  </Heading>
                </View>
              </Card>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
