import { useEffect, useState } from 'react';
import { View, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { hasPermission } from '@/utils/permissions';
import { useMobilePersona } from '@/hooks/useMobilePersona';
import { PersonaGate } from '@/components/auth/PersonaGate';
import { ScreenBody } from '@/components/layout/ScreenBody';
import { useDeviceType } from '@/hooks/useDeviceType';
import { trackScreenView } from '@/utils/analytics';
import { api } from '@/api/client';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Heading, Subheading, Text, Caption } from '@/components/ui/Typography';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { DollarSign, Receipt, BarChart3, PieChart, ShieldAlert } from 'lucide-react-native';
import { formatAmount } from '@/utils/currency';
import { CartesianChart, Bar } from 'victory-native';
const CartesianChartCast = CartesianChart as any;
import { matchFont } from '@shopify/react-native-skia';
import { edenFetch } from '@/api/edenFetch';

const PERIOD_DAYS: Record<string, string> = { day: '1', week: '7', month: '30', year: '365' };

const fetchDashboardStats = () => edenFetch(api.analytics.dashboard.get());
const fetchRevenueAnalytics = (days: string) => edenFetch(api.analytics.revenue.get({ query: { days } }));
const fetchSalesInsights = () => edenFetch(api.analytics['sales-insights'].get());

export default function AnalyticsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { capabilities } = useMobilePersona();
  const { isTablet } = useDeviceType();
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('week');

  const canViewFinancials = capabilities.viewFinancialAnalytics ?? hasPermission(user, 'analytics:view_financials');
  const canViewOperations =
    capabilities.viewOperationsAnalytics ??
    (hasPermission(user, 'analytics:view_operations') || hasPermission(user, 'reports:view_sales'));
  const canViewAnalytics = canViewFinancials || canViewOperations;
  const canViewBookings = hasPermission(user, 'bookings:read');
  const canViewInvoices = hasPermission(user, 'finance:view_invoices');
  const canViewLedger = hasPermission(user, 'finance:view_records');
  const canViewProfitLoss = canViewFinancials;

  const font = matchFont({ fontSize: 12 });
  const daysParam = PERIOD_DAYS[period] ?? '7';

  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useQuery({
    queryKey: ['dashboard_stats_analytics'],
    queryFn: fetchDashboardStats,
    enabled: canViewAnalytics,
  });

  const { data: revenueData, isLoading: revLoading, isError: revError, refetch: refetchRev } = useQuery({
    queryKey: ['revenue_analytics', daysParam],
    queryFn: () => fetchRevenueAnalytics(daysParam),
    enabled: canViewAnalytics && canViewFinancials,
  });

  const { data: salesData, isLoading: salesLoading, isError: salesError, refetch: refetchSales } = useQuery({
    queryKey: ['sales_insights'],
    queryFn: fetchSalesInsights,
    enabled: canViewAnalytics && canViewOperations,
  });

  useEffect(() => {
    if (canViewAnalytics) trackScreenView('AnalyticsScreen');
  }, [canViewAnalytics]);

  if (!canViewAnalytics) {
    return (
      <View className="flex-1 bg-notion-bg-secondary items-center justify-center p-6">
        <ShieldAlert size={48} color="#9ca3af" />
        <Heading className="text-notion-text mt-4">Access Denied</Heading>
        <Text className="text-notion-text-secondary text-center mt-2">You don&apos;t have permission to view analytics.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-6 bg-notion-bg-secondary border border-notion-border p-3 rounded-lg">
          <Text className="text-notion-text">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isLoading = statsLoading || (canViewFinancials && revLoading) || (canViewOperations && salesLoading);
  const isError = statsError || (canViewFinancials && revError) || (canViewOperations && salesError);

  const handleRefresh = () => {
    refetchStats();
    refetchRev();
    refetchSales();
  };

  if (isError) {
    return <ErrorState onRetry={handleRefresh} />;
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-notion-bg items-center justify-center">
        <ActivityIndicator size="large" color="#1a365d" />
      </View>
    );
  }

  // Strictly use backend data. No fallbacks.
  const hasRevenueHistory = (revenueData as any)?.trends?.length > 0;
  const hasPopularItems = (salesData as any)?.topItems?.length > 0;

  return (
    <PersonaGate tab="analytics">
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1 bg-notion-bg-secondary dark:bg-notion-bg"
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefresh} tintColor="#37352f" />}
      showsVerticalScrollIndicator={false}
    >
      <View className="bg-notion-bg dark:bg-notion-bg-secondary px-6 pt-16 pb-6 border-b border-notion-border mb-6">
        <Heading className="text-3xl text-notion-text">Analytics</Heading>
        <Text className="text-notion-text-secondary mt-1">
          {canViewFinancials ? 'Sales & revenue' : 'Operations overview'}
        </Text>
        <View className="flex-row gap-2 mt-4">
          {(['day', 'week', 'month', 'year'] as const).map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-full border ${period === p ? 'bg-notion-blue-bg border-notion-blue' : 'border-notion-border'}`}
            >
              <Text className={`text-xs font-semibold capitalize ${period === p ? 'text-notion-blue' : 'text-notion-text-secondary'}`}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScreenBody maxWidth={960}>
      <View className="px-6 pb-20">
        
        {/* KPI Cards */}
        <View className={`mb-6 ${isTablet ? 'flex-row flex-wrap' : 'flex-row justify-between'}`} style={isTablet ? { gap: 12 } : undefined}>
          <Card padding="md" className="bg-notion-blue-bg/30 border-notion-blue-bg" style={isTablet ? { width: '23%' } : { width: '48%' }}>
            <View className="w-8 h-8 rounded-full bg-notion-blue/20 items-center justify-center mb-3">
              <DollarSign size={16} color="#2563eb" />
            </View>
            <Caption className="text-notion-text-secondary font-semibold uppercase tracking-widest text-[10px]">Today's Revenue</Caption>
            <Text className="text-notion-text font-bold text-xl mt-1">
              {formatAmount((stats as any)?.data?.today?.revenue || 0)}
            </Text>
          </Card>
 
          <Card padding="md" className="bg-notion-green-bg/30 border-notion-green-bg" style={isTablet ? { width: '23%' } : { width: '48%' }}>
            <View className="w-8 h-8 rounded-full bg-notion-green/20 items-center justify-center mb-3">
              <Receipt size={16} color="#10b981" />
            </View>
            <Caption className="text-notion-text-secondary font-semibold uppercase tracking-widest text-[10px]">Active Orders</Caption>
            <Text className="text-notion-text font-bold text-xl mt-1">
              {(stats as any)?.data?.realtime?.pendingOrders || 0}
            </Text>
          </Card>
        </View>
 
        {/* Revenue Chart */}
        <Subheading className="uppercase tracking-widest text-notion-text-secondary text-xs mb-3">Weekly Revenue</Subheading>
        {hasRevenueHistory ? (
          <Card className="p-0 border border-notion-border mb-8 overflow-hidden bg-notion-bg dark:bg-white/5">
            <View className="h-72 pt-6 pr-4 pb-2">
              <CartesianChartCast
                data={(revenueData as any).trends}
                xKey={"date" as any}
                yKeys={["revenue"] as any}
                padding={{ left: 10, right: 10, bottom: 20, top: 10 }}
                domainPadding={{ left: 20, right: 20 }}
                axisOptions={{ font }}
              >
                {({ points, chartBounds }: any) => (
                  <Bar 
                    points={points.revenue}
                    chartBounds={chartBounds}
                    color="#2563eb"
                    roundedCorners={{ topLeft: 4, topRight: 4 }}
                    animate={{ type: "spring" }}
                  />
                )}
              </CartesianChartCast>
            </View>
          </Card>
        ) : (
          <Card className="mb-8">
            <EmptyState 
              title="No Revenue Data" 
              description="There is no revenue data recorded for the past 7 days."
              icon={<BarChart3 size={32} color="#9ca3af" />}
            />
          </Card>
        )}
 
        {/* Popular Items Chart */}
        <Subheading className="uppercase tracking-widest text-notion-text-secondary text-xs mb-3">Top Selling Items</Subheading>
        {hasPopularItems ? (
          <Card className="p-0 border border-notion-border mb-8 overflow-hidden bg-notion-bg dark:bg-white/5">
            <View className="h-64 pt-6 pr-4 pb-2">
              <CartesianChartCast
                data={(salesData as any).topItems}
                xKey={"name" as any}
                yKeys={["sales"] as any}
                padding={{ left: 10, right: 10, bottom: 20, top: 10 }}
                domainPadding={{ left: 20, right: 20 }}
                axisOptions={{ font }}
              >
                {({ points, chartBounds }: any) => (
                  <Bar 
                    points={points.sales}
                    chartBounds={chartBounds}
                    color="#10b981"
                    roundedCorners={{ topLeft: 4, topRight: 4 }}
                    animate={{ type: "timing", duration: 800 }}
                  />
                )}
              </CartesianChartCast>
            </View>
          </Card>
        ) : (
          <Card className="mb-8">
            <EmptyState 
              title="No Sales Data" 
              description="There is not enough sales data to determine top selling items."
              icon={<PieChart size={32} color="#9ca3af" />}
            />
          </Card>
        )}

        <Subheading className="uppercase tracking-widest text-notion-text-secondary text-xs mb-3">Advanced Reports</Subheading>
        <View className="flex-row flex-wrap justify-between gap-y-4">
          {canViewBookings && (
            <TouchableOpacity onPress={() => router.push('/owner/bookings')} className="w-[48%]">
              <Card className="border border-notion-border py-4 items-center justify-center bg-notion-bg dark:bg-white/5">
                <Text className="text-notion-text font-bold">Bookings</Text>
              </Card>
            </TouchableOpacity>
          )}
          {canViewInvoices && (
            <TouchableOpacity onPress={() => router.push('/owner/bills')} className="w-[48%]">
              <Card className="border border-notion-border py-4 items-center justify-center bg-notion-bg dark:bg-white/5">
                <Text className="text-notion-text font-bold">Invoices & Bills</Text>
              </Card>
            </TouchableOpacity>
          )}
          {canViewLedger && (
            <TouchableOpacity onPress={() => router.push('/owner/ledger')} className="w-[48%]">
              <Card className="border border-notion-border py-4 items-center justify-center bg-notion-bg dark:bg-white/5">
                <Text className="text-notion-text font-bold">Customer Ledger</Text>
              </Card>
            </TouchableOpacity>
          )}
          {canViewProfitLoss && (
            <TouchableOpacity onPress={() => router.push('/owner/profit-loss')} className="w-[48%]">
              <Card className="border border-notion-border py-4 items-center justify-center bg-notion-bg dark:bg-white/5">
                <Text className="text-notion-text font-bold">Profit & Loss</Text>
              </Card>
            </TouchableOpacity>
          )}
        </View>

      </View>
      </ScreenBody>
    </ScrollView>
    </PersonaGate>
  );
}
