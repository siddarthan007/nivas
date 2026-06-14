import { View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ShieldAlert } from 'lucide-react-native';
import { Heading, Text } from '@/components/ui/Typography';
import type { MobileTabId } from '@/constants/mobilePersona';
import { useMobilePersona } from '@/hooks/useMobilePersona';
import { useAuthStore } from '@/stores/authStore';
import { hasPermission } from '@/utils/permissions';

/** Permission fallback for screens reachable via More (not always a visible tab). */
const TAB_PERMISSION_FALLBACK: Partial<Record<MobileTabId, string>> = {
    messages: 'communications:read_messages',
    notifications: 'notifications:view',
    procurement: 'inventory:read',
    analytics: 'analytics:view_operations',
    attendance: '',
    profile: '',
};

interface PersonaGateProps {
    tab: MobileTabId;
    children: React.ReactNode;
}

/** Blocks screens outside the user's mobile persona or lacking permission. */
export function PersonaGate({ tab, children }: PersonaGateProps) {
    const router = useRouter();
    const { hasTab } = useMobilePersona();
    const { user } = useAuthStore();

    const perm = TAB_PERMISSION_FALLBACK[tab];
    const allowed = hasTab(tab) || perm === '' || (perm ? hasPermission(user, perm) : false);

    if (!allowed) {
        return (
            <View className="flex-1 bg-notion-bg-secondary dark:bg-notion-bg items-center justify-center p-6">
                <ShieldAlert size={48} color="#9ca3af" />
                <Heading className="text-notion-text mt-4">Not available</Heading>
                <Text className="text-notion-text-secondary text-center mt-2">
                    This area is not part of your role on mobile. Use the web app for full access.
                </Text>
                <TouchableOpacity
                    onPress={() => router.replace('/')}
                    className="mt-6 bg-notion-bg-secondary border border-notion-border px-4 py-3 rounded-lg"
                >
                    <Text className="text-notion-text">Go to Home</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return <>{children}</>;
}

export default PersonaGate;
