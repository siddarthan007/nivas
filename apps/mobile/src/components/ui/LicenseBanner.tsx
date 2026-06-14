import { View, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { AlertTriangle } from 'lucide-react-native';
import { useAuthStore } from '@/stores/authStore';

const WARN_STATUSES = new Set(['EXPIRED', 'PAUSED', 'PENDING_PAYMENT']);

export function LicenseBanner() {
    const user = useAuthStore((s) => s.user);
    const isStaff = user?.type === 'HOTEL_STAFF';

    const { data } = useQuery({
        queryKey: ['license-banner'],
        queryFn: async () => {
            const res = await (api as any)['saas-billing']['my-subscription'].get();
            if (res.error) return null;
            return res.data?.data as { hotel?: { licenseStatus?: string; licenseGraceEndsAt?: string | null; licenseExpiresAt?: string | null } } | null;
        },
        enabled: isStaff,
        staleTime: 5 * 60 * 1000,
        retry: false,
    });

    if (!isStaff || !data?.hotel) return null;

    const status = data.hotel.licenseStatus || 'TRIAL';
    if (!WARN_STATUSES.has(status)) return null;

    const graceEnds = data.hotel.licenseGraceEndsAt ? new Date(data.hotel.licenseGraceEndsAt) : null;
    const inGrace = status === 'EXPIRED' && graceEnds && graceEnds > new Date();

    let message = 'Subscription issue — contact your administrator.';
    if (status === 'EXPIRED' && inGrace && graceEnds) {
        const hours = Math.ceil((graceEnds.getTime() - Date.now()) / (1000 * 60 * 60));
        message = `License expired. Grace period ends in ~${hours}h — renew on web.`;
    } else if (status === 'EXPIRED') {
        message = 'License expired. Renew subscription on web to avoid interruption.';
    } else if (status === 'PAUSED') {
        message = 'Subscription paused. Some features may be limited.';
    } else if (status === 'PENDING_PAYMENT') {
        message = 'Payment pending. Complete billing on web.';
    }

    return (
        <View className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex-row items-center gap-2">
            <AlertTriangle size={16} color="#b45309" />
            <Text className="text-xs text-amber-900 flex-1">{message}</Text>
        </View>
    );
}
