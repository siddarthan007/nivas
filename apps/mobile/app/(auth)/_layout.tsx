import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

export default function AuthLayout() {
    const { isAuthenticated, isLoading } = useAuthStore();

    if (isLoading) return <LoadingScreen message="Loading..." />;
    if (isAuthenticated) return <Redirect href="/(app)" />;

    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" />
        </Stack>
    );
}
