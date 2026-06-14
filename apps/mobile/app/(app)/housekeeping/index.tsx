import { useEffect, useState } from 'react';
import { View, ScrollView, RefreshControl, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { BedDouble, CircleCheck, CircleAlert, Wrench } from 'lucide-react-native';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { trackScreenView } from '@/utils/analytics';
import { api } from '@/api/client';
import { useAuthStore } from '@/stores/authStore';
import { hasPermission } from '@/utils/permissions';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Heading, Subheading, Caption } from '@/components/ui/Typography';
import Toast from 'react-native-toast-message';
import { PersonaGate } from '@/components/auth/PersonaGate';
import { useRouter } from 'expo-router';
import { useDeviceType } from '@/hooks/useDeviceType';
import { ScreenBody } from '@/components/layout/ScreenBody';

export default function HousekeepingScreen() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { isTablet } = useDeviceType();
  const canUpdateHousekeeping = hasPermission(user, 'housekeeping:update_status');
  const [filter, setFilter] = useState<'ALL' | 'DIRTY' | 'MAINTENANCE' | 'CLEAN'>('ALL');

  useEffect(() => {
    trackScreenView('HousekeepingScreen');
  }, []);

  const { data: tasks, isLoading: tasksLoading, isError: tasksError, refetch: refetchTasks, isRefetching: tasksRefetching } = useQuery({
    queryKey: ['housekeeping_tasks'],
    queryFn: async () => {
      const res = await api.housekeeping.get();
      if (res.error) throw res.error;
      return res.data?.data || [];
    },
  });

  const { data: rooms, isLoading: roomsLoading, refetch: refetchRooms } = useQuery({
    queryKey: ['housekeeping_rooms'],
    queryFn: async () => {
      const res = await api.rooms.get();
      if (res.error) throw res.error;
      return res.data?.data || [];
    },
  });

  const updateRoomStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await api.rooms({ id }).patch({ status });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Room status updated' });
      queryClient.invalidateQueries({ queryKey: ['housekeeping_rooms'] });
    },
    onError: () => {
      Toast.show({ type: 'error', text1: 'Failed to update room status' });
    }
  });

  const isLoading = tasksLoading || roomsLoading;
  const isError = tasksError;
  const refetch = () => { refetchTasks(); refetchRooms(); };
  const isRefetching = tasksRefetching;

  if (isError) {
    return <ErrorState onRetry={refetch} />;
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-notion-bg items-center justify-center">
        <ActivityIndicator size="large" color="#1a365d" />
      </View>
    );
  }

  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'border-notion-yellow';
      case 'IN_PROGRESS': return 'border-notion-blue';
      case 'COMPLETED': return 'border-notion-green';
      case 'DONE': return 'border-notion-green';
      default: return 'border-notion-border';
    }
  };

  const getRoomStatusColor = (status: string) => {
    switch (status) {
      case 'CLEANING': return 'border-notion-blue';
      case 'MAINTENANCE': return 'border-notion-gray';
      case 'AVAILABLE': return 'border-notion-green';
      case 'OCCUPIED': return 'border-notion-red';
      default: return 'border-notion-border';
    }
  };



  const pendingTasks = tasks?.filter((t: any) => t.status !== 'COMPLETED' && t.status !== 'DONE') || [];
  const activeRooms = rooms?.filter((r: any) => {
    if (filter === 'ALL') return r.status === 'CLEANING' || r.status === 'MAINTENANCE';
    if (filter === 'DIRTY') return r.status === 'CLEANING';
    if (filter === 'MAINTENANCE') return r.status === 'MAINTENANCE';
    if (filter === 'CLEAN') return r.status === 'AVAILABLE';
    return true;
  }) || [];

  const totalRooms = rooms?.length || 1;
  const cleanRooms = rooms?.filter((r: any) => r.status === 'AVAILABLE').length || 0;
  const progressPercent = Math.round((cleanRooms / totalRooms) * 100);

  return (
    <PersonaGate tab="housekeeping">
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1 bg-notion-bg-secondary dark:bg-notion-bg"
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#37352f" />}
      contentContainerStyle={pendingTasks.length === 0 && activeRooms.length === 0 ? { flex: 1 } : undefined}
    >
      <ScreenBody maxWidth={960}>
      <View className="bg-notion-bg px-6 pt-16 pb-6 border-b border-notion-border mb-4">
        <Heading className="text-3xl">Housekeeping</Heading>
        <Text className="text-notion-text-secondary mt-1">Manage room cleaning status</Text>
        
        {/* Progress Bar */}
        <View className="mt-4">
          <View className="flex-row justify-between mb-1">
            <Text className="text-xs text-notion-text-secondary font-bold tracking-widest uppercase">Clean Rooms</Text>
            <Text className="text-xs text-notion-text-secondary font-bold">{cleanRooms} / {totalRooms} ({progressPercent}%)</Text>
          </View>
          <View className="h-2 bg-notion-bg-secondary rounded-full overflow-hidden border border-notion-border">
            <View className="h-full bg-notion-green" style={{ width: `${progressPercent}%` }} />
          </View>
        </View>

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4 flex-row gap-2">
          {['ALL', 'DIRTY', 'MAINTENANCE', 'CLEAN'].map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f as any)}
              className={`px-4 py-2 rounded-full border ${filter === f ? 'bg-notion-text border-notion-text' : 'bg-transparent border-notion-border'}`}
            >
              <Text className={`font-semibold text-sm ${filter === f ? 'text-white' : 'text-notion-text-secondary'}`}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Active Tasks Section */}
      {pendingTasks.length > 0 && (
        <View className="px-6 pb-4">
          <Subheading className="uppercase tracking-widest text-notion-text-secondary text-xs mb-3">Active Tasks ({pendingTasks.length})</Subheading>
          {pendingTasks.map((task: any) => (
            <Card key={task.id} padding="md" variant="elevated" className={`mb-3 border-l-4 ${getTaskStatusColor(task.status)}`}>
              <View className="flex-row justify-between items-center mb-1">
                <Text className="font-bold text-notion-text">Room {task.room?.number || task.roomId}</Text>
                <View className="px-2 py-1 rounded bg-notion-bg-secondary border border-notion-border">
                  <Caption className="font-semibold text-notion-text-secondary">{task.status}</Caption>
                </View>
              </View>
              <Text className="text-sm text-notion-text-secondary mb-1">{task.taskType} • {task.priority}</Text>
              {task.notes ? <Text className="text-xs text-notion-text-secondary italic">{task.notes}</Text> : null}
              <TouchableOpacity
                className="mt-3 bg-notion-blue self-start px-4 py-2 rounded-md"
                onPress={() => router.push(`/housekeeping/room/${task.roomId}` as any)}
              >
                <Text className="text-white font-semibold text-sm">Open Room</Text>
              </TouchableOpacity>
            </Card>
          ))}
        </View>
      )}

      {/* Rooms needing attention */}
      {activeRooms.length > 0 && (
        <View className="px-6 pb-4">
          <Subheading className="uppercase tracking-widest text-notion-text-secondary text-xs mb-3">Rooms ({activeRooms.length})</Subheading>
          {activeRooms.map((room: any) => (
            <Card key={room.id} padding="md" variant="elevated" className={`mb-3 border-l-4 ${getRoomStatusColor(room.status)}`}>
              <View className="flex-row justify-between items-center mb-2">
                <Text className="font-bold text-notion-text">Room {room.number}</Text>
                <View className="px-2 py-1 rounded bg-notion-bg-secondary border border-notion-border">
                  <Caption className="font-semibold text-notion-text-secondary">{room.status}</Caption>
                </View>
              </View>
              <Text className="text-sm text-notion-text-secondary mb-3">{room.type} • Floor {room.floorNumber || 'N/A'}</Text>
              <TouchableOpacity
                className="bg-notion-blue self-start px-4 py-2 rounded-md"
                onPress={() => router.push(`/housekeeping/room/${room.id}` as any)}
              >
                <Text className="text-white font-semibold text-sm">Open Room</Text>
              </TouchableOpacity>
            </Card>
          ))}
        </View>
      )}

      {/* All other rooms */}
      {(rooms || []).filter((r: any) => r.status === 'AVAILABLE' || r.status === 'OCCUPIED').length > 0 && (
        <View className="px-6 pb-8">
          <Subheading className="uppercase tracking-widest text-notion-text-secondary text-xs mb-3">All Rooms</Subheading>
          {rooms?.filter((r: any) => r.status === 'AVAILABLE' || r.status === 'OCCUPIED').map((room: any) => (
            <Card key={room.id} padding="md" className={`mb-3 border-l-4 ${getRoomStatusColor(room.status)} opacity-70`}>
              <View className="flex-row justify-between items-center">
                <View>
                  <Text className="font-semibold text-notion-text">Room {room.number}</Text>
                  <Text className="text-xs text-notion-text-secondary">{room.status}</Text>
                </View>
                {canUpdateHousekeeping && (
                  <TouchableOpacity
                    className="bg-notion-blue-bg px-3 py-1.5 rounded"
                    onPress={() => updateRoomStatus.mutate({ id: room.id.toString(), status: 'CLEANING' })}
                  >
                    <Text className="text-notion-blue text-xs font-semibold">Mark Dirty</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Card>
          ))}
        </View>
      )}

      {pendingTasks.length === 0 && activeRooms.length === 0 && (
        <EmptyState
          icon={<BedDouble size={48} color="#9ca3af" />}
          title="All Caught Up"
          description="No pending housekeeping tasks or rooms marked for cleaning."
        />
      )}
      </ScreenBody>
    </ScrollView>
    </PersonaGate>
  );
}
