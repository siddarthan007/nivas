import { useEffect, useMemo } from 'react';
import { View, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { trackScreenView, trackAction } from '@/utils/analytics';
import { useHaptics } from '@/hooks/useHaptics';
import { formatAmount } from '@/utils/currency';
import { formatNepaliDate } from '@nivas/shared-utils/nepali-dates';
import { api } from '@/api/client';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Heading, Subheading, Text, Caption } from '@/components/ui/Typography';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  ClipboardList,
  UtensilsCrossed,
  BedDouble,
  TrendingUp,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CalendarCheck,
  CalendarDays,
  Sparkles,
  Package,
  QrCode,
  ScanLine,
  Wallet,
} from 'lucide-react-native';
import { CartesianChart, Line } from 'victory-native';
const CartesianChartCast = CartesianChart as any;

import { ResponsiveContainer } from '@/components/layout/ResponsiveContainer';
import { useMobilePersona } from '@/hooks/useMobilePersona';
import { useDeviceType } from '@/hooks/useDeviceType';
import { useAppColors } from '@/hooks/useAppColors';
import { DASHBOARD_COLORS } from '@/constants/dashboardTokens';

const fetchDashboardStats = async () => {
  try {
    const res = await api.analytics.dashboard.get();
    if (res.error) {
      if (res.error.status === 403) {
        return {};
      }
      throw res.error;
    }
    return res.data?.data;
  } catch (error: any) {
    if (error?.status === 403 || error?.message?.includes('403') || error?.status === 401) {
      return {};
    }
    throw error;
  }
};

export default function DashboardScreen() {
  const { user } = useAuthStore();
  const { capabilities, persona } = useMobilePersona();
  const colors = useAppColors();
  const { light } = useHaptics();
  const router = useRouter();
  const { isTablet } = useDeviceType();
  const insets = useSafeAreaInsets();

  const { data: stats, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard_stats'],
    queryFn: fetchDashboardStats,
  });

  useEffect(() => {
    trackScreenView('DashboardScreen');
  }, []);

  const actions = useMemo(() => {
    const arr: any[] = [];

    if (capabilities.viewOperationsAnalytics || capabilities.viewFinancialAnalytics) {
      arr.push({ label: 'Occupancy', icon: BedDouble, color: DASHBOARD_COLORS.blue, valFn: (s: any) => s?.rooms ? `${s.rooms.breakdown?.OCCUPIED || 0}/${s.rooms.total || 0}` : '0/0', href: null });
    }
    if (capabilities.viewFinancialAnalytics) {
      arr.push({ label: 'Today Revenue', icon: TrendingUp, color: DASHBOARD_COLORS.green, valFn: (s: any) => s?.today?.revenue ? formatAmount(s.today.revenue) : '0', href: '/analytics' });
    }

    if (persona === 'waiter' || persona === 'manager' || persona === 'receptionist') {
      if (capabilities.pos) {
        arr.push({ label: 'Pending Orders', icon: UtensilsCrossed, color: DASHBOARD_COLORS.orange, valFn: (s: any) => s?.realtime?.pendingOrders || '0', href: '/orders' });
      }
    }

    if (capabilities.housekeepingTasks) {
      arr.push({ label: 'Dirty Rooms', icon: CircleAlert, color: DASHBOARD_COLORS.red, valFn: (s: any) => s?.rooms?.breakdown?.DIRTY || '0', href: '/housekeeping' });
      arr.push({ label: 'Cleaning Tasks', icon: Sparkles, color: DASHBOARD_COLORS.purple, valFn: (s: any) => s?.realtime?.pendingHousekeeping || '0', href: '/housekeeping' });
      arr.push({ label: 'Completed', icon: CircleCheck, color: DASHBOARD_COLORS.green, valFn: (s: any) => s?.rooms?.breakdown?.AVAILABLE || '0', href: null });
    }

    if (capabilities.bookings && (persona === 'owner' || persona === 'manager' || persona === 'receptionist')) {
      arr.push({ label: 'Arrivals Today', icon: CalendarCheck, color: DASHBOARD_COLORS.green, valFn: (s: any) => s?.today?.expectedCheckIns || '0', href: '/manager/bookings' });
      arr.push({ label: 'Timeline', icon: CalendarDays, color: DASHBOARD_COLORS.blue, valFn: () => 'View', href: '/bookings/timeline' });
    }

    if (capabilities.manageProcurement || persona === 'owner' || persona === 'manager') {
      arr.push({ label: 'Purchase Orders', icon: Package, color: DASHBOARD_COLORS.purple, valFn: (s: any) => s?.inventory?.pendingPOs || '0', href: '/procurement' });
    }

    if (capabilities.pos || persona === 'receptionist' || persona === 'manager' || persona === 'waiter') {
      arr.push({ label: 'Scan QR', icon: ScanLine, color: DASHBOARD_COLORS.blue, valFn: () => 'Open', href: '/scan' });
      arr.push({ label: 'Table QRs', icon: QrCode, color: DASHBOARD_COLORS.purple, valFn: () => 'View', href: '/qr-codes' });
    }
    if (capabilities.paymentQr || persona === 'manager' || persona === 'receptionist' || persona === 'waiter') {
      arr.push({ label: 'Payment QR', icon: Wallet, color: DASHBOARD_COLORS.green, valFn: () => 'Show', href: '/payment-qr' });
    }

  if (persona === 'kitchen' && capabilities.kitchenQueue) {
      arr.push({ label: 'Kitchen Queue', icon: ClipboardList, color: DASHBOARD_COLORS.orange, valFn: (s: any) => s?.realtime?.pendingOrders || '0', href: '/kitchen' });
    }

    return arr;
  }, [capabilities, persona]);

  if (isError) {
    return <ErrorState onRetry={refetch} />;
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1 bg-notion-bg-secondary dark:bg-notion-bg"
      refreshControl={
        <RefreshControl 
          refreshing={isRefetching} 
          onRefresh={() => {
            trackAction('dashboard_refresh');
            refetch();
          }} 
          tintColor={colors.text} 
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <ResponsiveContainer maxWidth={900}>
        {/* Header */}
        <View 
          className="bg-notion-bg dark:bg-notion-bg-secondary px-6 pb-6 border-b border-notion-border dark:border-white/5 mb-6 flex-row justify-between items-center shadow-sm"
          style={{ paddingTop: insets.top + 16 }}
        >
          <View className="flex-1 pr-4">
            <Caption className="font-semibold mb-1 tracking-wider uppercase text-notion-text-secondary dark:text-white/50 text-[10px]">
              Welcome
            </Caption>
            <Caption className="font-semibold mb-2 tracking-wider uppercase text-notion-text-secondary dark:text-white/50 text-[10px]">
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}  •  {formatNepaliDate()}
            </Caption>
            <Heading className="text-4xl font-extrabold text-notion-text dark:text-white tracking-tight leading-tight mb-1">
              {user?.name || 'Staff'}
            </Heading>
            <Text className="text-notion-text-secondary dark:text-white/60 font-semibold text-lg">
              {user?.role || 'Staff'}
            </Text>
          </View>
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => { light(); router.push('/profile' as any); }}
            className="w-12 h-12 rounded-full bg-notion-blue-bg border border-notion-blue/20 items-center justify-center shadow-sm"
          >
            <Text className="text-notion-blue font-bold text-lg">
              {user?.name ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2) : 'U'}
            </Text>
          </TouchableOpacity>
        </View>

        <View className="px-6 pb-20">
          <View className="mb-4">
            <Subheading className="uppercase tracking-widest text-notion-text-secondary text-xs ml-1">Quick Overview</Subheading>
          </View>
          
          <View className="flex-row flex-wrap justify-between gap-y-4 mb-8" style={isTablet ? { gap: 16, justifyContent: 'flex-start' } : {}}>
            {actions.map((action: any, index: number) => (
              <TouchableOpacity
                key={index}
                activeOpacity={0.7}
                onPress={() => {
                  if (action.href) {
                    light();
                    router.push(action.href as any);
                  }
                }}
                disabled={!action.href}
                style={{ width: isTablet ? '31%' : '48%' }}
              >
                <Card 
                  padding="md" 
                  variant={action.href ? "elevated" : "default"} 
                  className={`bg-notion-bg dark:bg-notion-bg-secondary border-notion-border dark:border-white/5 ${!action.href ? 'opacity-80' : ''}`} 
                  style={{ minHeight: 125 }}
                >
                  <View className="flex-row justify-between items-start mb-3">
                    <View 
                      className="w-10 h-10 rounded-xl items-center justify-center shadow-sm" 
                      style={{ backgroundColor: `${action.color}15` }}
                    >
                      <action.icon size={20} color={action.color} />
                    </View>
                    {action.href && <ChevronRight size={18} color={DASHBOARD_COLORS.muted} />}
                  </View>
                  <Text className="font-bold text-2xl mt-1 text-notion-text tracking-tight">
                    {isLoading ? '-' : (action.valFn ? action.valFn(stats) : '')}
                  </Text>
                  <Caption className="text-notion-text-secondary mt-1">{action.label}</Caption>
                </Card>
              </TouchableOpacity>
            ))}
          </View>

          {/* Analytics Charts (If they have permission) */}
          {(capabilities.viewFinancialAnalytics) && (stats as any)?.revenueHistory && (
            <View className="mb-8">
              <View className="mb-4">
                <Subheading className="uppercase tracking-widest text-notion-text-secondary text-xs ml-1">Revenue Trends</Subheading>
              </View>
              <Card padding="none" variant="elevated" className="bg-notion-bg dark:bg-notion-bg-secondary border-notion-border dark:border-white/5 h-64 overflow-hidden pt-4 pr-4">
              <CartesianChartCast
                  data={(stats as any).revenueHistory}
                  xKey={"date" as any}
                  yKeys={["revenue"] as any}
                  padding={{ left: 10, right: 10, bottom: 10, top: 10 }}
                >
                  {({ points }: any) => (
                    <Line 
                      points={points.revenue} 
                      color={DASHBOARD_COLORS.blue} 
                      strokeWidth={3} 
                      animate={{ type: "timing", duration: 600 }}
                    />
                  )}
                </CartesianChartCast>
              </Card>
            </View>
          )}
        </View>
      </ResponsiveContainer>
    </ScrollView>
  );
}
