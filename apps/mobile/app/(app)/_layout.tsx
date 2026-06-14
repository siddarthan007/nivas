import { Redirect, Tabs } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useMobilePersona } from '@/hooks/useMobilePersona';
import { useHaptics } from '@/hooks/useHaptics';
import { useNotificationBadges } from '@/hooks/useNotificationBadges';
import { useAppColors } from '@/hooks/useAppColors';
import { LicenseBanner } from '@/components/ui/LicenseBanner';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { registerForPushNotificationsAsync } from '@/utils/notifications';
import {
  Home,
  ClipboardList,
  Utensils,
  BedDouble,
  TrendingUp,
  Package,
  Bell,
  MessageSquare,
  User,
  Clock,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import type { MobileTabId } from '@/constants/mobilePersona';

const TAB_ICONS: Record<MobileTabId, typeof Home> = {
  home: Home,
  orders: Utensils,
  housekeeping: BedDouble,
  kitchen: ClipboardList,
  procurement: Package,
  analytics: TrendingUp,
  messages: MessageSquare,
  notifications: Bell,
  profile: User,
  attendance: Clock,
};

const HIDDEN_TAB_SCREENS = [
  'more',
  'profile',
  'analytics',
  'scan',
  'qr-codes',
  'payment-qr',
  'kitchen',
  'procurement',
  'housekeeping',
  'orders',
  'messages',
  'notifications',
  'attendance',
  'index',
  'manager/bookings',
  'owner/bills',
  'owner/bookings',
  'owner/ledger',
  'owner/profit-loss',
  'orders/pos/[tableId]',
  'orders/room/[id]',
  'orders/table/[id]',
  'housekeeping/room/[id]',
  'bookings/timeline',
];

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const { tabRoutes } = useMobilePersona();
  const { light } = useHaptics();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const colors = useAppColors();
  const isDark = colorScheme === 'dark';
  const { notificationUnread, messageUnread } = useNotificationBadges();

  useEffect(() => {
    if (isAuthenticated) {
      registerForPushNotificationsAsync().catch(() => {});
    }
  }, [isAuthenticated]);

  if (isLoading) return <LoadingScreen message="Loading..." />;
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  const visibleHrefs = new Set(tabRoutes.map((t) => (t.href === '' ? 'index' : t.href)));

  return (
    <View className={`flex-1 ${isDark ? 'dark' : ''}`}>
      <LicenseBanner />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            height: 64 + insets.bottom,
            paddingBottom: 8 + insets.bottom,
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: colors.tabBarBorder,
            backgroundColor: colors.tabBar,
          },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
        }}
        screenListeners={{
          tabPress: () => {
            light();
          },
        }}
      >
        {tabRoutes.map((tab) => {
          const Icon = TAB_ICONS[tab.id];
          const screenName = tab.href || 'index';
          return (
            <Tabs.Screen
              key={tab.id}
              name={screenName}
              options={{
                title: tab.name,
                tabBarIcon: ({ color }) => <Icon size={22} color={color} />,
                tabBarBadge:
                  tab.id === 'notifications' && notificationUnread > 0
                    ? notificationUnread > 99
                      ? '99+'
                      : notificationUnread
                    : tab.id === 'messages' && messageUnread > 0
                      ? messageUnread > 99
                        ? '99+'
                        : messageUnread
                      : undefined,
              }}
            />
          );
        })}

        {HIDDEN_TAB_SCREENS.filter((r) => !visibleHrefs.has(r)).map((r) => (
          <Tabs.Screen key={`hidden-${r}`} name={r} options={{ href: null }} />
        ))}
      </Tabs>
    </View>
  );
}
