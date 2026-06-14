import '@/styles/global.css';
import { useEffect } from 'react';
import { View } from 'react-native';
import { Slot } from 'expo-router';
import * as Linking from 'expo-linking';
import { handleDeepLink } from '@/utils/deepLink';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useColorScheme } from 'nativewind';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import Toast from 'react-native-toast-message';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { initOfflineSync } from '@/services/syncQueue';
import { setupNotificationListeners } from '@/utils/notifications';
import { SocketProvider } from '@/components/providers/SocketProvider';

import { ObserveRoot, useObserve } from 'expo-observe';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            retry: 1,
        },
        mutations: {
            onError: (error) => {
                Toast.show({
                    type: 'error',
                    text1: 'Something went wrong',
                    text2: error instanceof Error ? error.message : 'Please try again.',
                });
            }
        }
    },
});

export default function RootLayout() {
    const restore = useAuthStore((s) => s.restore);
    const { loadSettings, settings, isLoading: settingsLoading } = useSettingsStore();
    const { setColorScheme, colorScheme: systemScheme } = useColorScheme();
    const { markInteractive } = useObserve();
    const isDark =
        settings.theme === 'dark' ||
        (settings.theme === 'system' && systemScheme === 'dark');

    useEffect(() => {
        initOfflineSync();

        void Promise.allSettled([loadSettings(), restore()]).finally(() => {
            markInteractive();
        });

        const unsubscribeNotifications = setupNotificationListeners();
        Linking.getInitialURL().then((url) => {
            if (url) handleDeepLink(url);
        }).catch(() => { /* ignore */ });
        const linkSub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
        return () => {
            unsubscribeNotifications();
            linkSub.remove();
        };
    }, [loadSettings, restore, markInteractive]);

    useEffect(() => {
        if (!settingsLoading) {
            setColorScheme(settings.theme);
        }
    }, [settings.theme, settingsLoading, setColorScheme]);

    return (
        <ObserveRoot>
            <View className={`flex-1 ${isDark ? 'dark' : ''}`} style={{ flex: 1 }}>
            <ErrorBoundary>
                <SafeAreaProvider>
                    <QueryClientProvider client={queryClient}>
                        <SocketProvider>
                            <OfflineBanner />
                            <Slot />
                            <StatusBar style={
                                settings.theme === 'system'
                                    ? (systemScheme === 'dark' ? 'light' : 'dark')
                                    : (settings.theme === 'dark' ? 'light' : 'dark')
                            } />
                            <Toast />
                        </SocketProvider>
                    </QueryClientProvider>
                </SafeAreaProvider>
            </ErrorBoundary>
            </View>
        </ObserveRoot>
    );
}
