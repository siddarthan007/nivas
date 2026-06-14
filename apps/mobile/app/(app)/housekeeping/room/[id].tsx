import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useGlobalSearchParams, useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { ChevronLeft, CircleCheck, TriangleAlert, MessageSquare, Wrench } from 'lucide-react-native';
import { hasPermission } from '@/utils/permissions';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Heading, Subheading, Text, Caption } from '@/components/ui/Typography';
import { useHaptics } from '@/hooks/useHaptics';
import Toast from 'react-native-toast-message';
import Animated, { FadeInUp } from 'react-native-reanimated';

export default function HousekeepingRoomDetailsScreen() {
  const segments = useSegments();
  let id: string | undefined;
  try {
    const params = useGlobalSearchParams();
    id = params?.id as string;
  } catch (e) {
    // fallback
  }
  if (!id && segments.length > 0) {
    id = segments[segments.length - 1];
  }
  const router = useRouter();
  const { user } = useAuthStore();
  const { light, success, error: errorHaptic } = useHaptics();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [isReportingMaintenance, setIsReportingMaintenance] = useState(false);
  const canUpdateHousekeeping = hasPermission(user, 'housekeeping:update_status');

  const { data: room, isLoading: roomLoading } = useQuery({
    queryKey: ['room', id],
    queryFn: async () => {
      const res = await api.rooms.get();
      if (res.error) throw res.error;
      return res.data?.data?.find((r: any) => String(r.id) === String(id));
    },
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['housekeeping_tasks', id],
    queryFn: async () => {
      const res = await api.housekeeping.get();
      if (res.error) throw res.error;
      return (res.data?.data || []).filter((t: any) => String(t.roomId) === String(id));
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await api.rooms({ id: String(id) }).patch({ status });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: (_, status) => {
      success();
      Toast.show({ type: 'success', text1: 'Status Updated', text2: `Room is now ${status}` });
      queryClient.invalidateQueries({ queryKey: ['housekeeping_rooms'] });
      queryClient.invalidateQueries({ queryKey: ['room', id] });
      router.back();
    },
    onError: (err: any) => {
      errorHaptic();
      Toast.show({ type: 'error', text1: 'Update Failed', text2: err.message });
    }
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: number; status: string }) => {
      const res = await api.housekeeping({ id: String(taskId) }).status.patch({ status });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      success();
      queryClient.invalidateQueries({ queryKey: ['housekeeping_tasks', id] });
    },
    onError: (err: any) => {
      errorHaptic();
      Toast.show({ type: 'error', text1: 'Task Update Failed', text2: err.message });
    }
  });

  const isLoading = roomLoading || tasksLoading;
  const allTasksCompleted = (tasks || []).length > 0 && (tasks || []).every((t: any) => t.status === 'COMPLETED' || t.status === 'DONE');

  if (isLoading) {
    return (
      <View className="flex-1 bg-notion-bg items-center justify-center">
        <ActivityIndicator size="large" color="#37352f" />
      </View>
    );
  }

  if (!room) {
    return (
      <View className="flex-1 bg-notion-bg items-center justify-center p-6">
        <Heading>Room not found</Heading>
        <TouchableOpacity onPress={() => router.back()} className="mt-4 bg-notion-bg-secondary p-3 rounded-lg border border-notion-border">
          <Text>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-notion-bg-secondary dark:bg-notion-bg">
      <View className="bg-notion-bg dark:bg-notion-bg-secondary border-b border-notion-border pt-14 pb-4 px-4 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => { light(); router.back(); }} className="w-10 h-10 items-center justify-center bg-notion-bg-secondary dark:bg-white/5 rounded-full">
          <ChevronLeft size={24} color="#37352f" />
        </TouchableOpacity>
        <View className="items-center">
          <Heading className="text-notion-text">Room {room.number}</Heading>
          <Caption className="text-notion-text-secondary">{room.type}</Caption>
        </View>
        <View className="w-10 h-10" />
      </View>

      <ScrollView className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 100 }}>
        <Animated.View entering={FadeInUp.delay(100)}>
          <Card variant="elevated" className="p-5 border border-notion-border mb-6">
            <Subheading className="mb-2">Current Status</Subheading>
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold uppercase tracking-widest text-notion-text">{room.status}</Text>
              {room.status === 'CLEANING' && <TriangleAlert color="#f59e0b" size={24} />}
              {room.status === 'AVAILABLE' && <CircleCheck color="#10b981" size={24} />}
            </View>
          </Card>

          <Text className="font-bold text-notion-text mb-2 text-lg">Housekeeping Tasks ({(tasks || []).length})</Text>
          {(tasks || []).length === 0 ? (
            <Card variant="elevated" className="p-5 border border-notion-border mb-6">
              <Text className="text-notion-text-secondary text-center">No tasks assigned for this room.</Text>
            </Card>
          ) : (
            <Card variant="elevated" className="p-0 border border-notion-border mb-6 overflow-hidden">
              {(tasks || []).map((task: any, idx: number) => (
                <View key={task.id} className={`p-4 flex-row items-center justify-between ${idx < (tasks || []).length - 1 ? 'border-b border-notion-border' : ''}`}>
                  <View className="flex-1">
                    <Text className="text-notion-text font-medium">{task.taskType}</Text>
                    <Caption className="text-notion-text-secondary">{task.priority} • {task.status}</Caption>
                    {task.notes ? <Caption className="text-notion-text-secondary italic mt-1">{task.notes}</Caption> : null}
                  </View>
                  {canUpdateHousekeeping && (
                    <TouchableOpacity
                      onPress={() => {
                        const next = task.status === 'PENDING' ? 'IN_PROGRESS' : 'COMPLETED';
                        updateTaskMutation.mutate({ taskId: task.id, status: next });
                      }}
                      disabled={updateTaskMutation.isPending}
                    >
                      <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${task.status === 'COMPLETED' || task.status === 'DONE' ? 'bg-notion-green border-notion-green' : 'border-notion-border'}`}>
                        {(task.status === 'COMPLETED' || task.status === 'DONE') && <CircleCheck size={14} color="white" />}
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </Card>
          )}

          <Text className="font-bold text-notion-text mb-2 text-lg">Add Note or Issue</Text>
          <View className="bg-notion-bg border border-notion-border rounded-xl p-3 flex-row items-start mb-4">
            <MessageSquare color="#9ca3af" size={20} style={{ marginTop: 4, marginRight: 8 }} />
            <TextInput
              multiline
              numberOfLines={3}
              placeholder="E.g. Broken AC, requires extra pillows..."
              placeholderTextColor="#9ca3af"
              value={note}
              onChangeText={setNote}
              className="flex-1 text-notion-text min-h-[60px]"
              textAlignVertical="top"
            />
          </View>

          {canUpdateHousekeeping && (
            isReportingMaintenance ? (
              <Animated.View entering={FadeInUp}>
                <TouchableOpacity
                  onPress={() => updateStatusMutation.mutate('MAINTENANCE')}
                  className="bg-notion-red p-4 rounded-xl flex-row items-center justify-center shadow-sm"
                >
                  <Wrench color="white" size={20} style={{ marginRight: 8 }} />
                  <Text className="text-white font-bold">Confirm Maintenance Required</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIsReportingMaintenance(false)}
                  className="p-4 mt-2 items-center"
                >
                  <Text className="text-notion-text-secondary font-medium">Cancel</Text>
                </TouchableOpacity>
              </Animated.View>
            ) : (
              <TouchableOpacity
                onPress={() => setIsReportingMaintenance(true)}
                className="bg-notion-bg-secondary border border-notion-border p-4 rounded-xl flex-row items-center justify-center shadow-sm"
              >
                <Wrench color="#6b7280" size={20} style={{ marginRight: 8 }} />
                <Text className="text-notion-text-secondary font-bold">Report Maintenance Issue</Text>
              </TouchableOpacity>
            )
          )}

        </Animated.View>
      </ScrollView>

      {canUpdateHousekeeping && (
        <View className="absolute bottom-6 left-6 right-6">
          <TouchableOpacity
            onPress={() => updateStatusMutation.mutate('AVAILABLE')}
            disabled={updateStatusMutation.isPending || !allTasksCompleted}
            className={`bg-notion-green p-4 rounded-xl flex-row items-center justify-center shadow-md ${updateStatusMutation.isPending || !allTasksCompleted ? 'opacity-60' : ''}`}
          >
            {updateStatusMutation.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <CircleCheck color="white" size={24} style={{ marginRight: 8 }} />
                <Text className="text-white font-bold text-lg">Mark as Clean & Available</Text>
              </>
            )}
          </TouchableOpacity>
          {!allTasksCompleted && (
            <Caption className="text-center text-notion-text-secondary mt-2">Complete all tasks first</Caption>
          )}
        </View>
      )}
    </View>
  );
}
