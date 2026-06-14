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
import { ChevronLeft, FileText, ShieldAlert } from 'lucide-react-native';
import { formatAmount } from '@/utils/currency';
import { useHaptics } from '@/hooks/useHaptics';

export default function OwnerLedgerScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { light } = useHaptics();
  const canViewFinance = hasPermission(user, 'finance:view_records');

  if (!canViewFinance) {
    return (
      <View className="flex-1 bg-notion-bg-secondary items-center justify-center p-6">
        <ShieldAlert size={48} color="#9ca3af" />
        <Heading className="text-notion-text mt-4">Access Denied</Heading>
        <Text className="text-notion-text-secondary text-center mt-2">You don't have permission to view financial records.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-6 bg-notion-bg-secondary border border-notion-border p-3 rounded-lg">
          <Text className="text-notion-text">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { data: journalEntries, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['owner_ledger'],
    queryFn: async () => {
      const res = await api.finance.gl.journal.get();
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
        <Heading className="text-notion-text">General Ledger</Heading>
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
          {journalEntries?.length === 0 ? (
            <EmptyState 
              title="No Entries Found" 
              description="There are currently no journal entries."
              icon={<FileText size={32} color="#9ca3af" />}
            />
          ) : (
            journalEntries?.map((entry: any) => (
              <Card variant="elevated" key={entry.id} padding="md" className="mb-4 border-notion-border">
                <View className="flex-row justify-between mb-2">
                  <Text className="font-bold text-notion-text text-lg">{entry.description}</Text>
                  <Caption className="text-notion-text-secondary font-mono">{new Date(entry.createdAt).toLocaleDateString()}</Caption>
                </View>
                {entry.reference && (
                  <Text className="text-notion-text-secondary mb-3 text-xs uppercase tracking-widest">Ref: {entry.reference}</Text>
                )}
                
                <View className="bg-notion-bg dark:bg-white/5 p-2 rounded">
                  {entry.lines?.map((line: any, i: number) => (
                    <View key={i} className="flex-row justify-between py-1 border-b border-notion-border/50 last:border-0">
                      <Text className="text-notion-text flex-1" numberOfLines={1}>{line.account?.name || 'Account'}</Text>
                      <View className="flex-row w-32 justify-end">
                        {line.debit > 0 ? (
                          <Text className="text-notion-text font-mono w-16 text-right">{line.debit}</Text>
                        ) : (
                          <Text className="text-notion-text font-mono w-16 text-right">-</Text>
                        )}
                        {line.credit > 0 ? (
                          <Text className="text-notion-text font-mono w-16 text-right">{line.credit}</Text>
                        ) : (
                          <Text className="text-notion-text font-mono w-16 text-right">-</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
