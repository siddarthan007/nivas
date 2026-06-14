import { useEffect, useState } from 'react';
import { View, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Utensils, UtensilsCrossed, ArrowRight, Search, BedDouble, Users } from 'lucide-react-native';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { trackScreenView } from '@/utils/analytics';
import { api } from '@/api/client';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Heading, Subheading, Text } from '@/components/ui/Typography';
import { useHaptics } from '@/hooks/useHaptics';
import { PersonaGate } from '@/components/auth/PersonaGate';
import { useDeviceType } from '@/hooks/useDeviceType';
import { useAppColors } from '@/hooks/useAppColors';
import { orderMatchesTable } from '@/utils/orderTableId';

export default function MobileOrdersScreen() {
  const router = useRouter();
  const { isTablet } = useDeviceType();
  const colors = useAppColors();
  const { light } = useHaptics();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'tables' | 'rooms'>('tables');

  useEffect(() => {
    trackScreenView('MobileOrdersScreen');
  }, []);

  const { data: tables, isLoading: tablesLoading, isError: tablesError, refetch: refetchTables, isRefetching: tablesRefetching } = useQuery({
    queryKey: ['tables'],
    queryFn: async () => {
      const res = await api.operations.tables.get();
      if (res.error) throw res.error;
      return res.data?.data || [];
    },
  });

  const { data: rooms, isLoading: roomsLoading, isError: roomsError, refetch: refetchRooms, isRefetching: roomsRefetching } = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      const res = await api.rooms.get();
      if (res.error) throw res.error;
      return res.data?.data || [];
    },
  });

  const { data: activeOrders, isError: ordersError, refetch: refetchOrders } = useQuery({
    queryKey: ['active_orders'],
    queryFn: async () => {
      const res = await api.orders.get({ query: { status: 'PENDING,PREPARING,READY' } });
      if (res.error) throw res.error;
      return res.data?.data || [];
    },
  });

  const isLoading = activeTab === 'tables' ? tablesLoading : roomsLoading;
  const isRefetching = activeTab === 'tables' ? tablesRefetching : roomsRefetching;
  const isError = activeTab === 'tables' ? tablesError : roomsError || ordersError;

  const onRefresh = () => {
    refetchOrders();
    if (activeTab === 'tables') refetchTables();
    else refetchRooms();
  };

  const filteredTables = tables?.filter((t: any) => 
    t.tableNumber.toString().includes(search) || t.status.toLowerCase().includes(search.toLowerCase())
  );

  const filteredRooms = rooms?.filter((r: any) => 
    r.number.toString().includes(search) || r.status.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return { bg: 'bg-notion-green-bg', text: 'text-notion-green', border: 'border-notion-green-bg' };
      case 'OCCUPIED': return { bg: 'bg-notion-red-bg', text: 'text-notion-red', border: 'border-notion-red-bg' };
      case 'RESERVED': return { bg: 'bg-notion-blue-bg', text: 'text-notion-blue', border: 'border-notion-blue-bg' };
      case 'CLEANING': return { bg: 'bg-notion-bg-tertiary', text: 'text-notion-text-secondary', border: 'border-notion-border' };
      default: return { bg: 'bg-notion-bg-secondary', text: 'text-notion-text-secondary', border: 'border-notion-border' };
    }
  };

  const renderHeader = () => (
    <View className="bg-notion-bg dark:bg-notion-bg-secondary px-6 pt-16 pb-6 border-b border-notion-border dark:border-white/10 mb-4">
      <Heading className="text-3xl text-notion-text dark:text-white">Floor Plan</Heading>
      <Text className="text-notion-text-secondary dark:text-white/60 mt-1">Manage tables, rooms, and active orders</Text>
      
      <View
        className="flex-row mt-6 p-1 rounded-lg"
        style={{ backgroundColor: colors.segmentTrack }}
      >
        <TouchableOpacity 
          className="flex-1 py-2 rounded-md items-center"
          style={activeTab === 'tables' ? { backgroundColor: colors.segmentActive } : undefined}
          onPress={() => { light(); setActiveTab('tables'); }}
        >
          <Text className={`font-semibold ${activeTab === 'tables' ? 'text-notion-text dark:text-white' : 'text-notion-text-secondary dark:text-white/50'}`}>Tables</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          className="flex-1 py-2 rounded-md items-center"
          style={activeTab === 'rooms' ? { backgroundColor: colors.segmentActive } : undefined}
          onPress={() => { light(); setActiveTab('rooms'); }}
        >
          <Text className={`font-semibold ${activeTab === 'rooms' ? 'text-notion-text dark:text-white' : 'text-notion-text-secondary dark:text-white/50'}`}>Room Service</Text>
        </TouchableOpacity>
      </View>

      <View
        className="mt-4 flex-row items-center rounded-xl px-4 py-3 border border-notion-border dark:border-white/10"
        style={{ backgroundColor: colors.bgSecondary }}
      >
        <Search color={colors.textMuted} size={20} />
        <TextInput
          placeholder={`Search ${activeTab}...`}
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          className="flex-1 ml-3 text-notion-text dark:text-white text-base"
        />
      </View>
      <View className="mt-6">
        <Subheading className="uppercase tracking-widest text-notion-text-secondary text-xs">
          {activeTab === 'tables' ? 'Restaurant Floor' : 'Hotel Rooms'}
        </Subheading>
      </View>
    </View>
  );

  const renderTableItem = ({ item: table }: { item: any }) => {
    const tableOrders = activeOrders?.filter((o: any) => orderMatchesTable(o, table.id)) || [];
    const hasActiveOrder = tableOrders.length > 0;
    
    return (
      <View style={{ width: '100%', paddingHorizontal: 12, paddingVertical: 6 }}>
        <TouchableOpacity 
          className="w-full"
          activeOpacity={0.7}
          onPress={() => { light(); router.push(`/orders/table/${table.id}` as any); }}
        >
          <Card padding="md" variant="elevated" className={`border ${getStatusStyle(table.status).border}`} style={{ minHeight: 120 }}>
            <View className="flex-row justify-between items-start mb-3">
              <Text className="font-bold text-xl text-notion-text">T{table.tableNumber}</Text>
              <View className={`px-2 py-0.5 rounded ${getStatusStyle(table.status).bg}`}>
                <Text className={`text-[10px] font-bold ${getStatusStyle(table.status).text}`}>
                  {table.status?.substring(0, 3)}
                </Text>
              </View>
            </View>
            
            <View className="flex-1 justify-end">
              {hasActiveOrder ? (
                <View className="bg-notion-blue-bg px-2 py-1 rounded mb-2">
                  <Text className="text-xs font-semibold text-notion-blue">
                    {tableOrders.length} Order{tableOrders.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              ) : (
                <Text className="text-xs text-notion-text-secondary mb-2">
                  {table.currentGuest ? table.currentGuest : 'Available'}
                </Text>
              )}
              
              <View className="flex-row items-center justify-between border-t border-notion-border pt-2 mt-1">
                <Text className="text-xs font-medium text-notion-text">Dashboard</Text>
                <ArrowRight size={14} color={colors.textMuted} />
              </View>
            </View>
          </Card>
        </TouchableOpacity>
      </View>
    );
  };

  const renderRoomItem = ({ item: room }: { item: any }) => {
    const roomOrders = activeOrders?.filter((o: any) => o.roomId === room.id) || [];
    const hasActiveOrder = roomOrders.length > 0;
    
    return (
      <View style={{ width: '100%', paddingHorizontal: 12, paddingVertical: 6 }}>
        <TouchableOpacity 
          className="w-full"
          activeOpacity={0.7}
          onPress={() => { light(); router.push(`/orders/room/${room.id}` as any); }}
        >
          <Card padding="md" variant="elevated" className={`border ${getStatusStyle(room.status).border}`} style={{ minHeight: 120 }}>
            <View className="flex-row justify-between items-start mb-3">
              <Text className="font-bold text-xl text-notion-text">R{room.number}</Text>
              <View className={`px-2 py-0.5 rounded ${getStatusStyle(room.status).bg}`}>
                <Text className={`text-[10px] font-bold ${getStatusStyle(room.status).text}`}>
                  {room.status?.substring(0, 3)}
                </Text>
              </View>
            </View>
            
            <View className="flex-1 justify-end">
              {hasActiveOrder ? (
                <View className="bg-notion-blue-bg px-2 py-1 rounded mb-2">
                  <Text className="text-xs font-semibold text-notion-blue">
                    {roomOrders.length} Order{roomOrders.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              ) : (
                <Text className="text-xs text-notion-text-secondary mb-2">
                  {room.type}
                </Text>
              )}
              
              <View className="flex-row items-center justify-between border-t border-notion-border pt-2 mt-1">
                <Text className="text-xs font-medium text-notion-text">Dashboard</Text>
                <ArrowRight size={14} color={colors.textMuted} />
              </View>
            </View>
          </Card>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <PersonaGate tab="orders">
      <View className="flex-1 bg-notion-bg-secondary dark:bg-notion-bg">
        {isError ? (
          <View className="flex-1">
            {renderHeader()}
            <View className="px-6 py-6">
              <ErrorState onRetry={() => { refetchOrders(); refetchTables(); refetchRooms(); }} />
            </View>
          </View>
        ) : isLoading ? (
          <View className="flex-1">
            {renderHeader()}
            <View className="flex-1 items-center justify-center py-20">
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          </View>
        ) : (
          <FlashList
            data={activeTab === 'tables' ? (filteredTables ?? []) : (filteredRooms ?? [])}
            ListHeaderComponent={renderHeader}
            numColumns={isTablet ? 3 : 2}
            estimatedItemSize={140}
            renderItem={activeTab === 'tables' ? renderTableItem : renderRoomItem}
            refreshing={isRefetching}
            onRefresh={onRefresh}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={() => (
              <View className="px-6 py-6">
                {activeTab === 'tables' ? (
                  <EmptyState 
                    icon={<Utensils size={48} color={colors.textMuted} />}
                    title="No tables found"
                    description="Try adjusting your search query."
                  />
                ) : (
                  <EmptyState 
                    icon={<BedDouble size={48} color={colors.textMuted} />}
                    title="No rooms found"
                    description="Try adjusting your search query."
                  />
                )}
              </View>
            )}
          />
        )}
      </View>
    </PersonaGate>
  );
}
