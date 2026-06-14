import { useEffect } from 'react';
import { View, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { ChevronLeft, Bell, CheckCheck } from 'lucide-react-native';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Heading, Text, Caption } from '@/components/ui/Typography';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { useHaptics } from '@/hooks/useHaptics';
import { trackScreenView } from '@/utils/analytics';
import Toast from 'react-native-toast-message';
import { PersonaGate } from '@/components/auth/PersonaGate';
import { deriveNotificationRoute } from '@nivas/shared-utils';

function NotificationsScreenContent() {
  const router = useRouter();
  const { light } = useHaptics();
  const queryClient = useQueryClient();

  useEffect(() => {
    trackScreenView('NotificationsScreen');
  }, []);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.notifications.get();
      if (res.error) throw res.error;
      return res.data?.data || [];
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await api.notifications['read-all'].patch();
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      Notifications.setBadgeCountAsync(0).catch(() => { /* ignore */ });
      Toast.show({ type: 'success', text1: 'All notifications marked as read' });
    },
    onError: (err: any) => {
      Toast.show({ type: 'error', text1: 'Failed to mark read', text2: err.message });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.notifications({ id }).read.patch();
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: any) => {
      Toast.show({ type: 'error', text1: 'Failed', text2: err.message });
    },
  });

  const handleNotificationPress = (n: any) => {
    if (!n.isRead) markReadMutation.mutate(String(n.id));
    const route = deriveNotificationRoute('mobile', { type: n.type, metadata: n.metadata });
    if (route) {
      light();
      router.push(route as any);
    }
  };

  if (isError) {
    return (
      <View className="flex-1 bg-notion-bg-secondary pt-12">
        <View className="px-4 pb-4 flex-row items-center justify-between">
          <TouchableOpacity onPress={() => { light(); router.back(); }} className="w-10 h-10 items-center justify-center bg-notion-bg dark:bg-white/5 rounded-full border border-notion-border">
            <ChevronLeft size={24} color="#37352f" />
          </TouchableOpacity>
          <Heading className="text-notion-text">Notifications</Heading>
          <View className="w-10 h-10" />
        </View>
        <ErrorState onRetry={refetch} />
      </View>
    );
  }

  const notifications = data || [];
  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  return (
    <View className="flex-1 bg-notion-bg-secondary dark:bg-notion-bg">
      <View className="bg-notion-bg dark:bg-notion-bg-secondary border-b border-notion-border pt-14 pb-4 px-4 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => { light(); router.back(); }} className="w-10 h-10 items-center justify-center bg-notion-bg-secondary dark:bg-white/5 rounded-full">
          <ChevronLeft size={24} color="#37352f" />
        </TouchableOpacity>
        <Heading className="text-notion-text">Notifications</Heading>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={() => markAllReadMutation.mutate()} className="px-3 py-1 bg-notion-blue rounded-full">
            <Text className="text-white text-xs font-bold">Mark All Read</Text>
          </TouchableOpacity>
        )}
        {unreadCount === 0 && <View className="w-10 h-10" />}
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
          {notifications.length === 0 ? (
            <EmptyState
              title="No Notifications"
              description="You're all caught up."
              icon={<Bell size={32} color="#9ca3af" />}
            />
          ) : (
            notifications.map((n: any) => (
              <TouchableOpacity
                key={n.id}
                onPress={() => handleNotificationPress(n)}
                activeOpacity={0.7}
              >
                <Card variant="elevated" className={`mb-3 border ${n.isRead ? 'border-notion-border opacity-70' : 'border-notion-blue bg-notion-blue/5'}`} padding="md">
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1">
                      <Text className={`font-bold ${n.isRead ? 'text-notion-text-secondary' : 'text-notion-text'}`}>
                        {n.title || 'Notification'}
                      </Text>
                      <Text className="text-notion-text-secondary text-sm mt-1">{n.message}</Text>
                      <Caption className="text-notion-text-secondary mt-2">{new Date(n.createdAt).toLocaleString()}</Caption>
                    </View>
                    {!n.isRead && <View className="w-2 h-2 rounded-full bg-notion-blue mt-2" />}
                  </View>
                </Card>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

export default function NotificationsScreen() {
  return (
    <PersonaGate tab="notifications">
      <NotificationsScreenContent />
    </PersonaGate>
  );
}
