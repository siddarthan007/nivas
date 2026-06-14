import messaging from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { buildNotificationPushData, navigateFromNotificationData } from '@nivas/shared-utils';
import { router } from 'expo-router';
import { api } from '../api/client';
import { useSettingsStore } from '../stores/settingsStore';

let handlerConfigured = false;
let pendingNavigation: Record<string, unknown> | null = null;

function runNavigation(data: Record<string, unknown> | undefined) {
    if (!data) return;
    const navRouter = { push: (href: string) => router.push(href as never) };
    const attempt = () => navigateFromNotificationData('mobile', data, navRouter);
    if (!attempt()) {
        pendingNavigation = data;
        setTimeout(() => {
            if (pendingNavigation) {
                const navRouter = { push: (href: string) => router.push(href as never) };
                navigateFromNotificationData('mobile', pendingNavigation, navRouter);
                pendingNavigation = null;
            }
        }, 600);
    } else {
        pendingNavigation = null;
    }
}

export function configureNotificationHandler() {
    if (handlerConfigured) return;
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });
    handlerConfigured = true;
}

async function ensureAndroidChannel() {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync('default', {
        name: 'Nivas Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1a365d',
        enableVibrate: true,
        showBadge: true,
    });
}

function getDeviceId(): string {
    const installId = (Constants as any).installationId;
    if (installId) return installId;
    const deviceId = (Constants as any).deviceId;
    if (deviceId) return deviceId;
    return `device-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function registerForPushNotificationsAsync() {
    configureNotificationHandler();
    if (Platform.OS === 'web') return;
    if (!useSettingsStore.getState().settings.pushNotifications) return;

    await ensureAndroidChannel();

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    try {
        if (Platform.OS === 'ios') {
            await messaging().requestPermission();
        } else if (!messaging().isDeviceRegisteredForRemoteMessages) {
            await messaging().registerDeviceForRemoteMessages();
        }
    } catch {
        /* FCM optional on simulators */
    }

    try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.expoConfig?.owner;
        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        const expoToken = tokenData.data;

        await (api as any).notifications.push.register.post({
            expoPushToken: expoToken,
            platform: Platform.OS as 'ios' | 'android',
            deviceId: getDeviceId(),
        });
    } catch (err) {
        console.warn('[Push] Registration skipped:', err);
    }
}

function handleNotificationNavigation(data: Record<string, unknown> | undefined) {
    runNavigation(data);
}

function mapRemoteMessageData(remoteMessage: { data?: Record<string, string | object> }): Record<string, unknown> {
    const raw = remoteMessage.data || {};
    const type = String(raw.type || raw.notifType || '');
    const parsed: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
        parsed[k] = typeof v === 'string' ? v : v;
    }
    return buildNotificationPushData(type, parsed);
}

export function setupNotificationListeners() {
    configureNotificationHandler();

    const unsubForeground = messaging().onMessage(async (remoteMessage) => {
        if (!useSettingsStore.getState().settings.pushNotifications) return;
        const data = mapRemoteMessageData(remoteMessage);
        await Notifications.scheduleNotificationAsync({
            content: {
                title: remoteMessage.notification?.title || String(data.title || 'Nivas'),
                body: remoteMessage.notification?.body || String(data.message || 'You have a new update'),
                data,
                sound: true,
            },
            trigger: null,
        });
    });

    const unsubOpened = messaging().onNotificationOpenedApp((remoteMessage) => {
        handleNotificationNavigation(mapRemoteMessageData(remoteMessage));
    });

    messaging().getInitialNotification().then((remoteMessage) => {
        if (remoteMessage) {
            handleNotificationNavigation(mapRemoteMessageData(remoteMessage));
        }
    }).catch(() => { /* ignore */ });

    const expoResponseSub = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as Record<string, unknown>;
        handleNotificationNavigation(data);
    });

    Notifications.getLastNotificationResponseAsync().then((response) => {
        if (response) {
            const data = response.notification.request.content.data as Record<string, unknown>;
            handleNotificationNavigation(data);
        }
    }).catch(() => { /* ignore */ });

    return () => {
        unsubForeground();
        unsubOpened();
        expoResponseSub.remove();
    };
}

/** @deprecated Use registerForPushNotificationsAsync */
export async function getFCMToken() {
    return registerForPushNotificationsAsync();
}

/** @deprecated Use registerForPushNotificationsAsync */
export async function requestUserPermission() {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
}

export { handleNotificationNavigation };
