globalThis.RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

import messaging from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';

// FCM background handler — runs when app is in background/killed (data messages).
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  const title = remoteMessage.notification?.title || 'Nivas';
  const body = remoteMessage.notification?.body || 'You have a new update';
  const data = remoteMessage.data || {};

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: null,
  });
});

import 'expo-router/entry';
