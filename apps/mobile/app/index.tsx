import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

export default function Index() {
    const { isAuthenticated, isLoading } = useAuthStore();

    if (isLoading) return <LoadingScreen message="Starting Nivas..." />;
    if (isAuthenticated) return <Redirect href="/(app)" />;
    return <Redirect href="/(auth)/login" />;
}
