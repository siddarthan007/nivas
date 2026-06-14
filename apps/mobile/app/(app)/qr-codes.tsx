import { View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { ChevronLeft, Utensils, Wallet } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { Heading, Text } from '@/components/ui/Typography';
import { Card } from '@/components/ui/Card';
import { useHaptics } from '@/hooks/useHaptics';
import { tableQrPayload } from '@/utils/orderTableId';
import { mobileTokenStorage } from '@/utils/auth';
import { useMobilePersona } from '@/hooks/useMobilePersona';
import { ResponsiveContainer } from '@/components/layout/ResponsiveContainer';

const API_URL = process.env.EXPO_PUBLIC_API_URL || '';

export default function QrCodesScreen() {
  const router = useRouter();
  const { light } = useHaptics();
  const { capabilities, persona } = useMobilePersona();
  const canShowPayments = capabilities.paymentQr || ['manager', 'receptionist', 'waiter'].includes(persona);

  const { data: tables, isLoading: tablesLoading } = useQuery({
    queryKey: ['table_qrcodes'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/v1/operations/tables/qrcodes`, {
        headers: { Authorization: `Bearer ${await mobileTokenStorage.getToken()}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Failed to load tables');
      return json.data as { id: number; tableNumber: string; qrPayload: string; status: string }[];
    },
  });

  return (
    <SafeAreaView className="flex-1 bg-notion-bg dark:bg-[#191919]">
      <ResponsiveContainer>
        <View className="flex-row items-center px-4 py-3 border-b border-notion-border">
          <TouchableOpacity onPress={() => { light(); router.back(); }} className="mr-3 p-2">
            <ChevronLeft size={24} color="#6b7280" />
          </TouchableOpacity>
          <Heading className="text-xl flex-1">Table QR Codes</Heading>
        </View>

        {canShowPayments && (
          <TouchableOpacity
            className="mx-4 mt-4 flex-row items-center justify-center gap-2 py-3 rounded-xl bg-notion-blue"
            onPress={() => { light(); router.push('/payment-qr' as any); }}
          >
            <Wallet size={18} color="#fff" />
            <Text className="text-white font-semibold">Payment QR (Fonepay &amp; wallets)</Text>
          </TouchableOpacity>
        )}

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          {tablesLoading && <ActivityIndicator color="#2eaadc" className="mt-8" />}
          {!tablesLoading && (!tables || tables.length === 0) && (
            <View className="items-center mt-8">
              <Utensils size={40} color="#9ca3af" />
              <Text className="text-notion-text-secondary text-center mt-2">No tables configured.</Text>
            </View>
          )}
          <View className="flex-row flex-wrap gap-3 justify-between">
            {tables?.map(table => (
              <Card key={table.id} className="p-3 items-center" style={{ width: '47%' }}>
                <Text className="font-bold text-notion-text mb-2">Table {table.tableNumber}</Text>
                <View className="bg-white p-2 rounded-lg mb-2">
                  <QRCode value={table.qrPayload || tableQrPayload(table.id)} size={120} />
                </View>
                <TouchableOpacity
                  onPress={() => { light(); router.push(`/orders/pos/${table.id}` as any); }}
                  className="bg-notion-blue px-3 py-1.5 rounded-lg"
                >
                  <Text className="text-white text-xs font-semibold">Open POS</Text>
                </TouchableOpacity>
              </Card>
            ))}
          </View>
        </ScrollView>
      </ResponsiveContainer>
    </SafeAreaView>
  );
}
