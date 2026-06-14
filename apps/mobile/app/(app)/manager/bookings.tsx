import { View, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { hasPermission } from '@/utils/permissions';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Heading, Subheading, Text, Caption } from '@/components/ui/Typography';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChevronLeft, CalendarCheck, CalendarX, Users, ShieldAlert, LogIn, LogOut } from 'lucide-react-native';
import { useHaptics } from '@/hooks/useHaptics';
import { formatAmount } from '@/utils/currency';
import Toast from 'react-native-toast-message';
import { ScreenBody } from '@/components/layout/ScreenBody';
import { useDeviceType } from '@/hooks/useDeviceType';

export default function ManagerBookingsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
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

  return <ManagerBookingsContent />;
}

function ManagerBookingsContent() {
  const router = useRouter();
  const { light } = useHaptics();
  const { isTablet } = useDeviceType();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const canCheckIn = hasPermission(user, 'bookings:create');
  const canCheckOut = hasPermission(user, 'bookings:update');
  const { data: arrivals, isLoading: arrivalsLoading, isError: arrivalsError, refetch: refetchArrivals, isRefetching: arrivalsRefetching } = useQuery({
    queryKey: ['manager_arrivals'],
    queryFn: async () => {
      const res = await api.bookings.get({ query: { segment: 'arrivals', limit: '50' } });
      if (res.error) throw res.error;
      return res.data?.data || [];
    },
  });

  const { data: inhouse, isLoading: inhouseLoading, isError: inhouseError, refetch: refetchInhouse, isRefetching: inhouseRefetching } = useQuery({
    queryKey: ['manager_inhouse'],
    queryFn: async () => {
      const res = await api.bookings.get({ query: { segment: 'inhouse', limit: '50' } });
      if (res.error) throw res.error;
      return res.data?.data || [];
    },
  });

  const { data: departures, isLoading: departuresLoading, isError: departuresError, refetch: refetchDepartures, isRefetching: departuresRefetching } = useQuery({
    queryKey: ['manager_departures'],
    queryFn: async () => {
      const res = await api.bookings.get({ query: { segment: 'departures', limit: '50' } });
      if (res.error) throw res.error;
      return res.data?.data || [];
    },
  });

  const isLoading = arrivalsLoading || inhouseLoading || departuresLoading;
  const isError = arrivalsError || inhouseError || departuresError;
  const refetch = () => { refetchArrivals(); refetchInhouse(); refetchDepartures(); };
  const isRefetching = arrivalsRefetching || inhouseRefetching || departuresRefetching;

  const checkInMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const res = await (api as any).bookings({ id: bookingId })['check-in'].patch({});
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Guest checked in' });
      queryClient.invalidateQueries({ queryKey: ['manager_arrivals'] });
      queryClient.invalidateQueries({ queryKey: ['manager_inhouse'] });
    },
    onError: (e: Error) => Toast.show({ type: 'error', text1: e.message }),
  });

  const checkOutMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const res = await (api as any).bookings({ id: bookingId })['check-out'].patch({});
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Guest checked out — complete payment on web if needed' });
      queryClient.invalidateQueries({ queryKey: ['manager_departures'] });
      queryClient.invalidateQueries({ queryKey: ['manager_inhouse'] });
    },
    onError: (e: Error) => Toast.show({ type: 'error', text1: e.message }),
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
        <Heading className="text-notion-text">Bookings Overview</Heading>
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
          <View className={isTablet ? 'flex-row flex-wrap' : ''} style={isTablet ? { gap: 12 } : undefined}>
          <View style={isTablet ? { width: '48%' } : { width: '100%' }}>
          {/* Arrivals */}
          <Subheading className="uppercase tracking-widest text-notion-text-secondary text-xs mb-3 flex-row items-center">
            <CalendarCheck size={14} color="#10b981" style={{ marginRight: 6 }} />
            Arrivals Today ({(arrivals || []).length})
          </Subheading>
          {(arrivals || []).length === 0 ? (
            <EmptyState title="No Arrivals" description="No expected arrivals today." icon={<CalendarCheck size={32} color="#9ca3af" />} />
          ) : (
            (arrivals || []).map((b: any) => (
              <Card variant="elevated" key={b.id} padding="md" className="mb-3 border-notion-border">
                <View className="flex-row justify-between mb-1">
                  <Text className="font-bold text-notion-text">{b.guestName}</Text>
                  <Caption className="text-notion-blue uppercase font-bold">{b.status}</Caption>
                </View>
                <Text className="text-notion-text-secondary text-sm">Room {b.roomId || 'N/A'} • {b.guestCount} Guest(s)</Text>
                <Text className="text-notion-text-secondary text-xs mt-1">{new Date(b.checkIn).toLocaleString()} {'->'} {new Date(b.checkOut).toLocaleDateString()}</Text>
                {canCheckIn && b.status === 'CONFIRMED' && (
                  <TouchableOpacity
                    onPress={() => { light(); checkInMutation.mutate(String(b.id)); }}
                    className="mt-3 bg-[#0f7b6c] rounded-lg py-2 flex-row items-center justify-center"
                    disabled={checkInMutation.isPending}
                  >
                    <LogIn size={16} color="#fff" />
                    <Text className="text-white font-semibold ml-2">Check in</Text>
                  </TouchableOpacity>
                )}
              </Card>
            ))
          )}

          </View>
          <View style={isTablet ? { width: '48%' } : { width: '100%' }}>
          {/* In-House */}
          <Subheading className="uppercase tracking-widest text-notion-text-secondary text-xs mb-3 mt-6 flex-row items-center">
            <Users size={14} color="#2563eb" style={{ marginRight: 6 }} />
            In-House ({(inhouse || []).length})
          </Subheading>
          {(inhouse || []).length === 0 ? (
            <EmptyState title="No In-House" description="No guests currently in-house." icon={<Users size={32} color="#9ca3af" />} />
          ) : (
            (inhouse || []).map((b: any) => (
              <Card variant="elevated" key={b.id} padding="md" className="mb-3 border-notion-border">
                <View className="flex-row justify-between mb-1">
                  <Text className="font-bold text-notion-text">{b.guestName}</Text>
                  <Caption className="text-notion-green uppercase font-bold">{b.status}</Caption>
                </View>
                <Text className="text-notion-text-secondary text-sm">Room {b.roomId || 'N/A'} • {b.guestCount} Guest(s)</Text>
                <View className="flex-row justify-between mt-2 pt-2 border-t border-notion-border">
                  <Text className="text-notion-text-secondary text-xs">Until {new Date(b.checkOut).toLocaleDateString()}</Text>
                  <Text className="text-notion-text font-medium">{formatAmount(b.totalAmount)}</Text>
                </View>
                {canCheckOut && (
                  <TouchableOpacity
                    onPress={() => { light(); checkOutMutation.mutate(String(b.id)); }}
                    className="mt-3 bg-notion-orange rounded-lg py-2 flex-row items-center justify-center"
                    disabled={checkOutMutation.isPending}
                  >
                    <LogOut size={16} color="#fff" />
                    <Text className="text-white font-semibold ml-2">Check out</Text>
                  </TouchableOpacity>
                )}
              </Card>
            ))
          )}

          </View>
          </View>

          <View style={{ width: '100%' }}>
          {/* Departures */}
          <Subheading className="uppercase tracking-widest text-notion-text-secondary text-xs mb-3 mt-6 flex-row items-center">
            <CalendarX size={14} color="#d9730d" style={{ marginRight: 6 }} />
            Departures Today ({(departures || []).length})
          </Subheading>
          {(departures || []).length === 0 ? (
            <EmptyState title="No Departures" description="No expected departures today." icon={<CalendarX size={32} color="#9ca3af" />} />
          ) : (
            (departures || []).map((b: any) => (
              <Card variant="elevated" key={b.id} padding="md" className="mb-3 border-notion-border">
                <View className="flex-row justify-between mb-1">
                  <Text className="font-bold text-notion-text">{b.guestName}</Text>
                  <Caption className="text-notion-orange uppercase font-bold">{b.status}</Caption>
                </View>
                <Text className="text-notion-text-secondary text-sm">Room {b.roomId || 'N/A'}</Text>
                <Text className="text-notion-text-secondary text-xs mt-1">Checkout by {new Date(b.checkOut).toLocaleString()}</Text>
              </Card>
            ))
          )}
          </View>
          </ScreenBody>
        </ScrollView>
      )}
    </View>
  );
}
