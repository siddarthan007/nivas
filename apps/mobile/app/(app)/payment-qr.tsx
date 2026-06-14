import { useState, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, TextInput, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { ChevronLeft, Wallet, RefreshCw } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { Heading, Subheading, Text } from '@/components/ui/Typography';
import { Card } from '@/components/ui/Card';
import { useHaptics } from '@/hooks/useHaptics';
import { useFonepayDynamicQr } from '@/hooks/useFonepay';
import { mobileTokenStorage } from '@/utils/auth';
import { ResponsiveContainer } from '@/components/layout/ResponsiveContainer';
import { resolveAssetUrl } from '@/utils/resolveAssetUrl';
import { useMobilePersona } from '@/hooks/useMobilePersona';
import { Redirect } from 'expo-router';

const API_URL = process.env.EXPO_PUBLIC_API_URL || '';

type PaymentQrEntry = { imageUrl?: string; label?: string; qrString?: string };

async function fetchPaymentConfig() {
  const token = await mobileTokenStorage.getToken();
  const res = await fetch(`${API_URL}/api/v1/settings/payment`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message || 'Failed to load payment settings');
  return json.data as {
    paymentQr?: PaymentQrEntry;
    paymentQrs?: Record<string, PaymentQrEntry>;
    fonepay?: { qrString?: string };
    enabledMethods?: string[];
  };
}

function DynamicFonepayCard() {
  const [amount, setAmount] = useState('500');
  const parsed = Number(amount) || 0;
  const { qr, status, error, regenerate, isPaid } = useFonepayDynamicQr(parsed, parsed > 0, 'Staff payment QR');
  const { light } = useHaptics();

  return (
    <Card className="p-4 mb-4">
      <Subheading className="mb-2">Dynamic Fonepay QR</Subheading>
      <Text className="text-notion-text-secondary text-sm mb-3">
        Generate a fresh QR for guests to pay any amount — for waiters, reception, or front desk.
      </Text>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        placeholder="Amount (NPR)"
        className="border border-notion-border rounded-xl px-4 py-3 text-notion-text mb-3 bg-notion-bg-secondary"
      />
      {status === 'loading' && <ActivityIndicator color="#2eaadc" />}
      {status === 'error' && (
        <View className="items-center gap-2">
          <Text className="text-red-600 text-sm text-center">{error}</Text>
          <TouchableOpacity onPress={() => { light(); regenerate(); }} className="flex-row items-center gap-1 px-3 py-2 bg-notion-blue rounded-lg">
            <RefreshCw size={14} color="#fff" />
            <Text className="text-white text-xs font-semibold">Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      {qr?.qrMessage && status !== 'error' && (
        <View className="items-center mt-2">
          <View className="bg-white p-3 rounded-xl">
            <QRCode value={qr.qrMessage} size={200} />
          </View>
          <Text className="text-sm font-semibold text-notion-text mt-2">NPR {parsed.toLocaleString()}</Text>
          <Text className="text-xs text-notion-text-secondary mt-1">PRN: {qr.prn}</Text>
          {isPaid && <Text className="text-emerald-600 font-semibold mt-2">Payment confirmed</Text>}
        </View>
      )}
    </Card>
  );
}

export default function PaymentQrScreen() {
  const router = useRouter();
  const { light } = useHaptics();
  const { capabilities, persona } = useMobilePersona();

  const canAccess = capabilities.paymentQr
    || persona === 'manager'
    || persona === 'receptionist'
    || persona === 'waiter';

  const { data: paymentConfig, isLoading } = useQuery({
    queryKey: ['payment_qr_config'],
    queryFn: fetchPaymentConfig,
    enabled: canAccess,
  });

  const staticQrs = useCallback(() => {
    const entries: { key: string; label: string; imageUrl?: string; qrValue?: string }[] = [];
    const cfg = paymentConfig;
    if (cfg?.paymentQr?.imageUrl) {
      entries.push({ key: 'default', label: cfg.paymentQr.label || 'Hotel payment QR', imageUrl: cfg.paymentQr.imageUrl });
    }
    if (cfg?.fonepay?.qrString) {
      entries.push({ key: 'fonepay-static', label: 'Fonepay (static)', qrValue: cfg.fonepay.qrString });
    }
    if (cfg?.paymentQrs) {
      for (const [method, val] of Object.entries(cfg.paymentQrs)) {
        if (val?.imageUrl || val.qrString) {
          entries.push({
            key: method,
            label: val.label || method,
            imageUrl: val.imageUrl,
            qrValue: val.qrString,
          });
        }
      }
    }
    return entries;
  }, [paymentConfig]);

  if (!canAccess) {
    return <Redirect href="/" />;
  }

  return (
    <SafeAreaView className="flex-1 bg-notion-bg dark:bg-[#191919]">
      <ResponsiveContainer>
        <View className="flex-row items-center px-4 py-3 border-b border-notion-border">
          <TouchableOpacity onPress={() => { light(); router.back(); }} className="mr-3 p-2">
            <ChevronLeft size={24} color="#6b7280" />
          </TouchableOpacity>
          <Heading className="text-xl flex-1">Payment QR</Heading>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <Text className="text-notion-text-secondary text-sm mb-4">
            Show guests a scan-to-pay QR from the front desk, restaurant floor, or reception.
          </Text>

          {isLoading && <ActivityIndicator color="#2eaadc" className="mt-4" />}
          <DynamicFonepayCard />

          {staticQrs().map(entry => (
            <Card key={entry.key} className="p-4 mb-3 items-center">
              <Subheading className="mb-2">{entry.label}</Subheading>
              {entry.imageUrl ? (
                <Image source={{ uri: resolveAssetUrl(entry.imageUrl) }} style={{ width: 200, height: 200, borderRadius: 8 }} resizeMode="contain" />
              ) : entry.qrValue ? (
                <View className="bg-white p-3 rounded-xl">
                  <QRCode value={entry.qrValue} size={200} />
                </View>
              ) : null}
            </Card>
          ))}

          {!isLoading && staticQrs().length === 0 && (
            <View className="items-center mt-2 px-4">
              <Wallet size={48} color="#9ca3af" />
              <Text className="text-notion-text-secondary text-center mt-2">
                Configure static payment QRs in web Settings → Payments, or use the dynamic Fonepay QR above.
              </Text>
            </View>
          )}
        </ScrollView>
      </ResponsiveContainer>
    </SafeAreaView>
  );
}
