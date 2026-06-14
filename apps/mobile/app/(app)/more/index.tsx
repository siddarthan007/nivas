import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  User,
  Clock,
  Package,
  MessageSquare,
  TrendingUp,
  ClipboardList,
  ScanLine,
  Wallet,
  QrCode,
  ChevronRight,
  BedDouble,
} from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { Heading, Text } from '@/components/ui/Typography';
import { useAuthStore } from '@/stores/authStore';
import { useMobilePersona } from '@/hooks/useMobilePersona';
import { useHaptics } from '@/hooks/useHaptics';
import { ResponsiveContainer } from '@/components/layout/ResponsiveContainer';

type MoreItem = {
  label: string;
  href: string;
  icon: typeof User;
  show?: boolean;
};

export default function MoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { capabilities, persona } = useMobilePersona();
  const { light } = useHaptics();

  const items: MoreItem[] = [
    { label: 'My profile', href: '/profile', icon: User, show: true },
    { label: 'Attendance', href: '/attendance', icon: Clock, show: true },
    { label: 'Messages', href: '/messages', icon: MessageSquare, show: true },
    { label: 'Procurement', href: '/procurement', icon: Package, show: !!capabilities.manageProcurement },
    { label: 'Analytics', href: '/analytics', icon: TrendingUp, show: !!(capabilities.viewFinancialAnalytics || capabilities.viewOperationsAnalytics) },
    { label: 'Kitchen queue', href: '/kitchen', icon: ClipboardList, show: !!capabilities.kitchenQueue && persona !== 'kitchen' },
    { label: 'Bookings', href: '/manager/bookings', icon: BedDouble, show: !!capabilities.bookings && (persona === 'manager' || persona === 'owner') },
    { label: 'Table QR codes', href: '/qr-codes', icon: QrCode, show: !!capabilities.pos || persona === 'manager' || persona === 'waiter' || persona === 'receptionist' },
    { label: 'Payment QR', href: '/payment-qr', icon: Wallet, show: !!capabilities.paymentQr || persona === 'manager' || persona === 'waiter' || persona === 'receptionist' },
    { label: 'Scan QR', href: '/scan', icon: ScanLine, show: !!capabilities.pos || persona === 'manager' || persona === 'waiter' || persona === 'receptionist' },
  ].filter(i => i.show);

  return (
    <View className="flex-1 bg-white dark:bg-[#191919]" style={{ paddingTop: insets.top }}>
      <ResponsiveContainer>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 + insets.bottom }}>
          <Heading className="mb-1">More</Heading>
          <Text className="text-gray-500 dark:text-gray-400 mb-4">{user?.fullName || 'Staff'}</Text>
          <Card className="p-0 overflow-hidden">
            {items.map((item, idx) => {
              const Icon = item.icon;
              return (
                <TouchableOpacity
                  key={item.href}
                  onPress={() => { light(); router.push(item.href as any); }}
                  className={`flex-row items-center px-4 py-4 ${idx < items.length - 1 ? 'border-b border-gray-100 dark:border-[#2f2f2f]' : ''}`}
                >
                  <Icon size={20} color="#2eaadc" />
                  <Text className="flex-1 ml-3 font-medium text-gray-900 dark:text-gray-100">{item.label}</Text>
                  <ChevronRight size={18} color="#9ca3af" />
                </TouchableOpacity>
              );
            })}
          </Card>
        </ScrollView>
      </ResponsiveContainer>
    </View>
  );
}
