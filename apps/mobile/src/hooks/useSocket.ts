import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { mobileTokenStorage } from '../utils/auth';
import * as Notifications from 'expo-notifications';
import { buildNotificationPushData } from '@nivas/shared-utils';
import { configureNotificationHandler } from '../utils/notifications';
import { useSettingsStore } from '../stores/settingsStore';

configureNotificationHandler();

const MOBILE_WS_QUERY_MAP: Record<string, string[][]> = {
    KITCHEN_NEW_ORDER: [['kitchen_orders'], ['kitchen-orders'], ['kds-orders'], ['active_orders'], ['dashboard_stats']],
    KITCHEN_ORDER_STATUS: [['kitchen_orders'], ['kitchen-orders'], ['kds-orders'], ['active_orders']],
    NEW_ORDER: [['kitchen_orders'], ['active_orders'], ['dashboard_stats'], ['payment_config']],
    ORDER_CREATED: [['kitchen_orders'], ['active_orders'], ['dashboard_stats']],
    ORDER_READY: [['kitchen_orders'], ['kds-orders'], ['active_orders']],
    BOOKING_CONFIRMED: [['manager_arrivals'], ['manager_inhouse'], ['owner_bookings'], ['dashboard_stats']],
    BOOKING_CHECKED_IN: [['manager_arrivals'], ['manager_inhouse'], ['owner_bookings'], ['rooms'], ['dashboard_stats']],
    BOOKING_CHECKED_OUT: [['manager_departures'], ['owner_bookings'], ['rooms']],
    CHECKOUT_ROOM_READY: [['housekeeping_tasks'], ['housekeeping_rooms'], ['rooms'], ['dashboard_stats']],
    HOUSEKEEPING_ALERT: [['housekeeping_tasks'], ['housekeeping_rooms'], ['dashboard_stats']],
    HOUSEKEEPING_REQUEST: [['housekeeping_tasks'], ['housekeeping_rooms']],
    HOUSEKEEPING_TASK_COMPLETED: [['housekeeping_tasks'], ['housekeeping_rooms'], ['rooms']],
    DND_UPDATE: [['rooms'], ['manager_inhouse']],
    CHECKOUT_REQUEST: [['manager_departures'], ['owner_bookings']],
    VIP_ARRIVAL: [['manager_arrivals'], ['dashboard_stats']],
    NEW_MESSAGE: [['messages_conversations'], ['messages_conversation_detail']],
    PAYMENT_RECEIVED: [['license-banner'], ['dashboard_stats'], ['payment_config'], ['payment_qr_config']],
    PAYMENT_DUE_REMINDER: [['license-banner']],
    LICENSE_ACTIVATED: [['license-banner']],
    LICENSE_EXPIRED: [['license-banner']],
    LICENSE_GRACE_PERIOD: [['license-banner']],
    LICENSE_PAUSED: [['license-banner']],
    LICENSE_REVOKED: [['license-banner']],
    LICENSE_EXPIRING_SOON: [['license-banner']],
    NIGHT_AUDIT_COMPLETED: [['dashboard_stats'], ['owner_profit_loss']],
    PROCUREMENT_UPDATED: [['procurement_orders']],
    INVENTORY_LOW_STOCK: [['dashboard_stats']],
};

function invalidateMobileQueries(queryClient: ReturnType<typeof useQueryClient>, eventType?: string) {
    if (!eventType) return;
    const keys = MOBILE_WS_QUERY_MAP[eventType];
    if (!keys) return;
    for (const key of keys) {
        queryClient.invalidateQueries({ queryKey: key });
    }
}

const WS_BASE = process.env.EXPO_PUBLIC_WS_URL;
if (!WS_BASE) {
  console.warn('[useSocket] EXPO_PUBLIC_WS_URL is not set. WebSocket will not connect.');
}
const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 30000;
const HEARTBEAT_INTERVAL_MS = 30000;
const HEARTBEAT_TIMEOUT_MS = 10000;

export type SocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export function useSocket() {
    const queryClient = useQueryClient();
    const ws = useRef<WebSocket | null>(null);
    const [status, setStatus] = useState<SocketStatus>('disconnected');
    const [unreadCount, setUnreadCount] = useState(0);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
    const heartbeatTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectAttempt = useRef(0);
    const isMounted = useRef(true);
    const connectRef = useRef<() => Promise<void>>(null as any);

    const clearTimers = useCallback(() => {
        if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
        if (heartbeatTimer.current) { clearInterval(heartbeatTimer.current); heartbeatTimer.current = null; }
        if (heartbeatTimeout.current) { clearTimeout(heartbeatTimeout.current); heartbeatTimeout.current = null; }
    }, []);

    const startHeartbeat = useCallback((socket: WebSocket) => {
        clearTimers();
        heartbeatTimer.current = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send('ping');
                heartbeatTimeout.current = setTimeout(() => {
                    if (isMounted.current) {
                        socket.close();
                        setStatus('disconnected');
                    }
                }, HEARTBEAT_TIMEOUT_MS);
            }
        }, HEARTBEAT_INTERVAL_MS);
    }, [clearTimers]);

    const connect = useCallback(async () => {
        isMounted.current = true;
        if (ws.current?.readyState === WebSocket.OPEN || ws.current?.readyState === WebSocket.CONNECTING) return;

        clearTimers();
        setStatus('connecting');

        const token = await mobileTokenStorage.getToken();
        if (!token) {
            setStatus('error');
            return;
        }

        if (!WS_BASE) {
            setStatus('error');
            return;
        }

        const url = `${WS_BASE}/ws/notifications?token=${encodeURIComponent(token)}`;
        const socket = new WebSocket(url);

        socket.onopen = () => {
            if (!isMounted.current) { socket.close(); return; }
            reconnectAttempt.current = 0;
            setStatus('connected');
            startHeartbeat(socket);
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'pong' && heartbeatTimeout.current) {
                    clearTimeout(heartbeatTimeout.current);
                    heartbeatTimeout.current = null;
                } else if (data.type === 'CONNECTED') {
                    setUnreadCount(data.unreadCount || 0);
                } else if (data.type === 'NOTIFICATION') {
                    setUnreadCount(prev => prev + 1);
                    const title = data.data?.title || 'Notification';
                    const body = data.data?.message || 'You have a new update.';
                    const notifType = data.data?.notifType || data.data?.type;
                    const pushData = buildNotificationPushData(notifType, data.data?.metadata || data.data);
                    if (useSettingsStore.getState().settings.pushNotifications) {
                      Notifications.scheduleNotificationAsync({
                        content: { title, body, data: pushData },
                        trigger: null,
                      });
                    }
                    invalidateMobileQueries(queryClient, notifType);
                } else if (data.type === 'SYSTEM_ALERT') {
                    const title = data.data?.title || 'Alert';
                    const body = data.data?.message || 'System alert.';
                    Notifications.scheduleNotificationAsync({
                      content: { title, body, data: { payload: data } },
                      trigger: null,
                    });
                } else if (data.type === 'NEW_MESSAGE') {
                    const pushData = buildNotificationPushData('NEW_MESSAGE', data.data);
                    Notifications.scheduleNotificationAsync({
                      content: {
                        title: 'New Message',
                        body: 'You have a new message.',
                        data: pushData,
                      },
                      trigger: null,
                    });
                    queryClient.invalidateQueries({ queryKey: ['messages_conversations'] });
                    queryClient.invalidateQueries({ queryKey: ['messages_conversation_detail'] });
                } else if (data.type === 'KITCHEN_NEW_ORDER' || data.type === 'KITCHEN_ORDER_STATUS') {
                    invalidateMobileQueries(queryClient, data.type);
                } else if (data.type === 'BOOKING_CONFIRMED' || data.type === 'DND_UPDATE' || data.type === 'BOOKING_CHECKED_IN' || data.type === 'BOOKING_CHECKED_OUT') {
                    invalidateMobileQueries(queryClient, data.type);
                } else if (MOBILE_WS_QUERY_MAP[data.type]) {
                    invalidateMobileQueries(queryClient, data.type);
                }
            } catch {
                if (event.data === 'pong' && heartbeatTimeout.current) {
                    clearTimeout(heartbeatTimeout.current);
                    heartbeatTimeout.current = null;
                }
            }
        };

        socket.onclose = () => {
            if (!isMounted.current) return;
            setStatus('disconnected');
            ws.current = null;
            clearTimers();
            const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, reconnectAttempt.current), RECONNECT_MAX_MS);
            reconnectAttempt.current += 1;
            reconnectTimer.current = setTimeout(() => {
                if (isMounted.current) connectRef.current();
            }, delay + Math.random() * 1000);
        };

        socket.onerror = () => {
            if (isMounted.current) setStatus('error');
        };

        ws.current = socket;
    }, [clearTimers, startHeartbeat, queryClient]);

    connectRef.current = connect;

    const disconnect = useCallback(() => {
        clearTimers();
        ws.current?.close();
        ws.current = null;
        setStatus('disconnected');
    }, [clearTimers]);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
            disconnect();
        };
    }, [disconnect]);

    // Reconnect when app comes to foreground
    useEffect(() => {
        const handleAppState = (next: AppStateStatus) => {
            if (next === 'active' && status === 'disconnected') {
                connect();
            }
        };
        const sub = AppState.addEventListener('change', handleAppState);
        return () => sub.remove();
    }, [connect, status]);

    // eslint-disable-next-line react-hooks/refs
    return { status, unreadCount, ws: ws.current, connect, disconnect };
}
