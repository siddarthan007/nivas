import { useEffect, useState, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import { ArrowLeft, LogIn, LogOut, Check, X, Timer } from 'lucide-react-native';
import { api } from '@/api/client';
import { useMobilePersona } from '@/hooks/useMobilePersona';
import { useAppColors } from '@/hooks/useAppColors';
import { ResponsiveContainer } from '@/components/layout/ResponsiveContainer';
import { Card } from '@/components/ui/Card';
import { Heading, Text, Caption } from '@/components/ui/Typography';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { formatDisplayText, formatDurationMinutes, formatTimeLabel, toIsoString } from '@/utils/formatDisplay';

type AttendanceMe = {
  isClockedIn: boolean;
  currentEntry?: {
    id: string;
    clockIn: string;
    clockOut?: string;
    approvalStatus?: string;
    notes?: string;
  };
  todayEntry?: {
    id: string;
    clockIn: string;
    clockOut?: string;
    approvalStatus?: string;
  };
};

type HistoryEntry = {
  id: string;
  date: string;
  clockIn: string;
  clockOut?: string;
  status: string;
  approvalStatus?: string;
  duration: number;
  overtime: number;
};

type PendingEntry = {
  id: string;
  staffName: string;
  clockIn: string;
  clockOut?: string;
};

function formatTime(iso?: string | Date) {
  return formatTimeLabel(iso);
}

function formatDuration(minutes: unknown) {
  return formatDurationMinutes(minutes);
}

function elapsedSince(clockIn: string | Date) {
  const diff = Date.now() - new Date(clockIn).getTime();
  return formatDurationMinutes(Math.max(0, Math.floor(diff / 60000)));
}

function normalizeAttendanceMe(raw: any): AttendanceMe {
  const normalizeEntry = (entry: any) => {
    if (!entry) return undefined;
    const clockIn = toIsoString(entry.clockIn);
    if (!clockIn) return undefined;
    return {
      id: String(entry.id),
      clockIn,
      clockOut: toIsoString(entry.clockOut),
      approvalStatus: entry.approvalStatus ? String(entry.approvalStatus) : undefined,
      notes: entry.notes,
    };
  };
  return {
    isClockedIn: !!raw?.isClockedIn,
    currentEntry: normalizeEntry(raw?.currentEntry),
    todayEntry: normalizeEntry(raw?.todayEntry),
  };
}

function normalizeHistoryEntry(entry: any): HistoryEntry {
  const dateRaw = toIsoString(entry.date) ?? String(entry.date ?? '');
  const date = dateRaw.includes('T') ? dateRaw.split('T')[0]! : dateRaw;
  return {
    id: String(entry.id),
    date,
    clockIn: toIsoString(entry.clockIn) ?? '',
    clockOut: toIsoString(entry.clockOut),
    status: String(entry.status ?? ''),
    approvalStatus: entry.approvalStatus ? String(entry.approvalStatus) : undefined,
    duration: Number(entry.duration) || 0,
    overtime: Number(entry.overtime) || 0,
  };
}

function normalizePendingEntry(entry: any): PendingEntry {
  return {
    id: String(entry.id),
    staffName: String(entry.staffName ?? 'Staff'),
    clockIn: toIsoString(entry.clockIn) ?? '',
    clockOut: toIsoString(entry.clockOut),
  };
}

export default function AttendanceScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { hasTab } = useMobilePersona();
  const isAttendanceTab = hasTab('attendance') && pathname.includes('attendance');
  const colors = useAppColors();
  const queryClient = useQueryClient();
  const { capabilities } = useMobilePersona();
  const canApprove = !!capabilities.approveAttendance;
  const [elapsed, setElapsed] = useState('0h 0m');

  const { data: me, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['attendance_me'],
    queryFn: async () => {
      const res = await (api as any).attendance.me.get();
      if (res.error) throw res.error;
      return normalizeAttendanceMe(res.data?.data);
    },
  });

  const historyStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().split('T')[0];
  }, []);

  const { data: history = [], refetch: refetchHistory } = useQuery({
    queryKey: ['attendance_my_history', historyStart],
    queryFn: async () => {
      const res = await (api as any).attendance['my-history'].get({
        query: { startDate: historyStart },
      });
      if (res.error) throw res.error;
      return ((res.data?.data?.entries || []) as any[]).map(normalizeHistoryEntry);
    },
  });

  const { data: pending = [], refetch: refetchPending } = useQuery({
    queryKey: ['attendance_pending'],
    enabled: canApprove,
    queryFn: async () => {
      const res = await (api as any).attendance.pending.get();
      if (res.error) throw res.error;
      return ((res.data?.data || []) as any[]).map(normalizePendingEntry);
    },
  });

  const clockIn = useMutation({
    mutationFn: async () => {
      const res = await (api as any).attendance['clock-in'].post({});
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Clocked in', text2: 'Pending manager approval' });
      queryClient.invalidateQueries({ queryKey: ['attendance_me'] });
      queryClient.invalidateQueries({ queryKey: ['attendance_my_history'] });
    },
    onError: (e: Error) => Toast.show({ type: 'error', text1: e.message }),
  });

  const clockOut = useMutation({
    mutationFn: async () => {
      const res = await (api as any).attendance['clock-out'].post({});
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Clocked out', text2: 'Shift recorded for payroll' });
      queryClient.invalidateQueries({ queryKey: ['attendance_me'] });
      queryClient.invalidateQueries({ queryKey: ['attendance_my_history'] });
    },
    onError: (e: Error) => Toast.show({ type: 'error', text1: e.message }),
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const res = await (api as any).attendance({ id }).approve.post({});
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Attendance approved' });
      refetchPending();
    },
  });

  const reject = useMutation({
    mutationFn: async (id: string) => {
      const res = await (api as any).attendance({ id }).reject.post({ notes: 'Rejected from mobile' });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Attendance rejected' });
      refetchPending();
    },
  });

  const isClocked = !!me?.isClockedIn;
  const activeEntry = me?.currentEntry;
  const todayEntry = me?.todayEntry;

  useEffect(() => {
    if (!isClocked || !activeEntry?.clockIn) {
      setElapsed('0h 0m');
      return;
    }
    const tick = () => setElapsed(elapsedSince(activeEntry.clockIn));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [isClocked, activeEntry?.clockIn]);

  const handleRefresh = () => {
    refetch();
    refetchHistory();
    refetchPending();
  };

  return (
    <View className="flex-1 bg-notion-bg-secondary dark:bg-notion-bg" style={{ paddingTop: insets.top }}>
      <ResponsiveContainer>
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 24 + insets.bottom }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor={colors.accent} />}
        >
          {!isAttendanceTab && (
            <TouchableOpacity onPress={() => router.back()} className="flex-row items-center mb-4">
              <ArrowLeft size={20} color={colors.accent} />
              <Text className="ml-2 font-medium" style={{ color: colors.accent }}>Back</Text>
            </TouchableOpacity>
          )}

          <Heading className="mb-1 text-notion-text dark:text-white">Attendance</Heading>
          <Caption className="mb-4 text-notion-text-secondary dark:text-white/60">Clock in when you start · clock out when you finish</Caption>

          <Card className="p-4 mb-4">
            {isLoading ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <>
                <View className="flex-row items-center mb-3">
                  <View className={`w-3 h-3 rounded-full mr-2 ${isClocked ? 'bg-notion-green' : 'bg-notion-border'}`} />
                  <Text className="text-lg font-semibold text-notion-text dark:text-white">
                    {isClocked ? 'On shift' : 'Off duty'}
                  </Text>
                </View>

                {isClocked && activeEntry?.clockIn && (
                  <View className="flex-row items-center mb-3 bg-notion-green-bg rounded-lg px-3 py-2">
                    <Timer size={16} color={colors.isDark ? '#6ee7b7' : '#0f7b6c'} />
                    <Text className="ml-2 text-notion-green dark:text-emerald-300 font-medium">
                      Clocked in {formatTime(activeEntry.clockIn)} · {elapsed}
                    </Text>
                  </View>
                )}

                {!isClocked && todayEntry?.clockOut && (
                  <View className="mb-3 rounded-lg bg-notion-bg-tertiary dark:bg-white/5 px-3 py-2">
                    <Caption>Today&apos;s shift</Caption>
                    <Text className="text-notion-text dark:text-white/90">
                      In {formatTime(todayEntry.clockIn)} → Out {formatTime(todayEntry.clockOut)}
                    </Text>
                    {todayEntry.approvalStatus && (
                      <Caption className="mt-1">Approval: {todayEntry.approvalStatus}</Caption>
                    )}
                  </View>
                )}

                {activeEntry?.approvalStatus && isClocked && (
                  <Caption className="mb-3">Approval: {activeEntry.approvalStatus}</Caption>
                )}

                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => clockIn.mutate()}
                    disabled={isClocked || clockIn.isPending}
                    className={`flex-1 rounded-xl py-3 flex-row items-center justify-center ${
                      isClocked ? 'bg-notion-bg-tertiary dark:bg-white/10' : 'bg-notion-green'
                    }`}
                  >
                    <LogIn size={18} color={isClocked ? colors.textMuted : '#fff'} />
                    <Text className={`font-semibold ml-2 ${isClocked ? 'text-notion-text-secondary' : 'text-white'}`}>
                      Clock in
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => clockOut.mutate()}
                    disabled={!isClocked || clockOut.isPending}
                    className={`flex-1 rounded-xl py-3 flex-row items-center justify-center ${
                      !isClocked ? 'bg-notion-bg-tertiary dark:bg-white/10' : 'bg-notion-red'
                    }`}
                  >
                    <LogOut size={18} color={!isClocked ? colors.textMuted : '#fff'} />
                    <Text className={`font-semibold ml-2 ${!isClocked ? 'text-notion-text-secondary' : 'text-white'}`}>
                      Clock out
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Card>

          {history.length > 0 && (
            <View className="mb-4">
              <Heading className="text-base mb-3 text-notion-text dark:text-white">Recent shifts</Heading>
              {history.slice(0, 10).map(entry => (
                <Card key={entry.id} className="p-3 mb-2">
                  <View className="flex-row justify-between items-start">
                    <View>
                      <Text className="font-medium text-notion-text dark:text-white">{formatDisplayText(entry.date)}</Text>
                      <Caption>
                        In {formatTime(entry.clockIn)}
                        {entry.clockOut ? ` · Out ${formatTime(entry.clockOut)}` : ' · No clock-out'}
                      </Caption>
                    </View>
                    <View className="items-end">
                      <Text className="text-sm font-medium text-notion-text dark:text-white/80">
                        {formatDurationMinutes(entry.duration) !== '0h 0m' ? formatDurationMinutes(entry.duration) : '—'}
                      </Text>
                      <Caption>{entry.approvalStatus || 'PENDING'}</Caption>
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          )}

          {canApprove && (
            <View>
              <Heading className="text-base mb-3 text-notion-text dark:text-white">Pending approvals</Heading>
              {pending.length === 0 ? (
                <Card className="p-4">
                  <Caption>No pending attendance to approve</Caption>
                </Card>
              ) : (
                pending.map(entry => (
                  <Card key={entry.id} className="p-4 mb-3">
                    <Text className="font-semibold text-notion-text dark:text-white">{entry.staffName}</Text>
                    <Caption className="mb-3">
                      In {formatTime(entry.clockIn)}
                      {entry.clockOut ? ` · Out ${formatTime(entry.clockOut)}` : ' · Still on shift'}
                    </Caption>
                    <View className="flex-row gap-3">
                      <TouchableOpacity
                        onPress={() => approve.mutate(entry.id)}
                        className="flex-1 bg-notion-green rounded-lg py-2 flex-row items-center justify-center"
                      >
                        <Check size={16} color="#fff" />
                        <Text className="text-white ml-1 font-medium">Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => reject.mutate(entry.id)}
                        className="flex-1 bg-notion-bg-tertiary dark:bg-white/10 rounded-lg py-2 flex-row items-center justify-center"
                      >
                        <X size={16} color={colors.isDark ? '#ff7369' : '#ef4444'} />
                        <Text className="text-notion-red ml-1 font-medium">Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </Card>
                ))
              )}
            </View>
          )}
        </ScrollView>
      </ResponsiveContainer>
    </View>
  );
}
