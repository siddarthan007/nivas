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
import { ChevronLeft, Calendar, ShieldAlert } from 'lucide-react-native';
import { formatAmount } from '@/utils/currency';
import { useHaptics } from '@/hooks/useHaptics';

export default function OwnerBookingsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { light } = useHaptics();
  const canViewBookings = hasPermission(user, 'bookings:read');

  if (!canViewBookings) {
    return (
      <View className="flex-1 bg-notion-bg-secondary items-center justify-center p-6">
        <ShieldAlert size={48} color="#9ca3af" />
        <Heading className="text-notion-text mt-4">Access Denied</Heading>
        <Text className="text-notion-text-secondary text-center mt-2">You don't have permission to view bookings.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-6 bg-notion-bg-secondary border border-notion-border p-3 rounded-lg">
          <Text className="text-notion-text">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { data: bookings, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['owner_bookings'],
    queryFn: async () => {
      const res = await api.bookings.get({ query: { limit: '50' } });
      if (res.error) throw res.error;
      return res.data?.data || [];
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
        <Heading className="text-notion-text">All Bookings</Heading>
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
          {bookings?.length === 0 ? (
            <EmptyState 
              title="No Bookings Found" 
              description="There are currently no bookings in the system."
              icon={<Calendar size={32} color="#9ca3af" />}
            />
          ) : (
            bookings?.map((b: any) => (
              <Card variant="elevated" key={b.id} padding="md" className="mb-4 border-notion-border">
                <View className="flex-row justify-between mb-2">
                  <Text className="font-bold text-notion-text text-lg">{b.guestName}</Text>
                  <View className="px-2 py-1 bg-notion-blue/10 rounded">
                    <Caption className="text-notion-blue font-bold uppercase">{b.status}</Caption>
                  </View>
                </View>
                <Text className="text-notion-text-secondary mb-1">Room {b.roomId} • {b.guestCount} Guest(s)</Text>
                <Text className="text-notion-text-secondary font-mono text-xs">
                  {new Date(b.checkIn).toLocaleDateString()}{' -> '}{new Date(b.checkOut).toLocaleDateString()}
                </Text>
                <View className="mt-3 pt-3 border-t border-notion-border flex-row justify-between">
                  <Text className="text-notion-text font-medium">Total: {formatAmount(b.totalAmount)}</Text>
                  {b.advancePayment > 0 && <Text className="text-notion-green font-medium">Paid: {formatAmount(b.advancePayment)}</Text>}
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
