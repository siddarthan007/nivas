import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useEffect } from 'react';
import { useFonepayDynamicQr } from '@/hooks/useFonepay';

interface FonepayQrPanelProps {
    amount: number;
    enabled?: boolean;
    remarks?: string;
    onPaid: (prn: string) => void;
    onManualConfirm?: () => void;
}

export function FonepayQrPanel({ amount, enabled = true, remarks, onPaid, onManualConfirm }: FonepayQrPanelProps) {
    const { qr, status, error, regenerate, isPaid } = useFonepayDynamicQr(amount, enabled, remarks);

    useEffect(() => {
        if (isPaid && qr?.prn) onPaid(qr.prn);
    }, [isPaid, qr?.prn, onPaid]);

    if (!enabled || amount <= 0) return null;

    return (
        <View className="items-center py-4 px-3 bg-notion-bg-secondary rounded-xl border border-notion-border mb-3">
            <Text className="text-xs font-bold uppercase tracking-widest text-notion-text-secondary mb-2">Fonepay</Text>
            {status === 'loading' && <ActivityIndicator color="#2eaadc" />}
            {status === 'error' && (
                <View className="items-center gap-2">
                    <Text className="text-sm text-red-600 text-center">{error}</Text>
                    <TouchableOpacity onPress={regenerate} className="px-3 py-1.5 bg-notion-blue rounded-lg">
                        <Text className="text-white text-xs font-semibold">Retry</Text>
                    </TouchableOpacity>
                </View>
            )}
            {qr && status !== 'error' && (
                <>
                    <Text className="text-sm font-semibold text-notion-text">NPR {amount.toLocaleString()}</Text>
                    <Text className="text-xs text-notion-text-secondary mt-1">PRN: {qr.prn}</Text>
                    <Text className="text-xs text-notion-text-secondary text-center mt-2 px-2">
                        Guest scans Fonepay QR on their app. Payment status is checked automatically.
                    </Text>
                    {isPaid ? (
                        <Text className="text-sm font-semibold text-emerald-600 mt-2">Payment confirmed</Text>
                    ) : onManualConfirm ? (
                        <TouchableOpacity onPress={onManualConfirm} className="mt-3 px-3 py-2 border border-notion-border rounded-lg">
                            <Text className="text-xs font-semibold text-notion-text">Payment received manually</Text>
                        </TouchableOpacity>
                    ) : null}
                </>
            )}
        </View>
    );
}
