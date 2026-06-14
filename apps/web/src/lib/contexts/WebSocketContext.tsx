'use client';

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import { useSocket } from '@/lib/hooks/useSocket';

type EventHandler = (data: any) => void;

interface WebSocketContextValue {
    status: 'connecting' | 'connected' | 'disconnected' | 'error';
    on: (eventType: string, handler: EventHandler) => () => void;
    off: (eventType: string, handler: EventHandler) => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

const EVENT_QUERY_MAP: Record<string, string[][]> = {
    KITCHEN_NEW_ORDER:      [['orders'], ['kitchen'], ['dashboard'], ['active_orders']],
    KITCHEN_ORDER_STATUS:   [['orders'], ['kitchen'], ['active_orders']],
    NEW_ORDER:              [['orders'], ['dashboard'], ['finance'], ['active_orders']],
    ORDER_CREATED:          [['orders'], ['finance'], ['active_orders']],
    ORDER_READY:            [['orders'], ['kitchen'], ['active_orders']],
    BOOKING_CONFIRMED:      [['bookings'], ['rooms'], ['dashboard'], ['finance'], ['manager_arrivals'], ['manager_inhouse']],
    BOOKING_CHECKED_IN:     [['bookings'], ['rooms'], ['dashboard'], ['finance'], ['manager_arrivals'], ['manager_inhouse']],
    BOOKING_CHECKED_OUT:    [['bookings'], ['rooms'], ['dashboard'], ['finance'], ['manager_departures']],
    CHECKOUT_ROOM_READY:    [['rooms'], ['housekeeping'], ['bookings'], ['dashboard'], ['finance']],
    HOUSEKEEPING_TASK_COMPLETED: [['rooms'], ['housekeeping'], ['housekeeping_tasks']],
    HOUSEKEEPING_ALERT:     [['housekeeping'], ['housekeeping_tasks'], ['dashboard']],
    HOUSEKEEPING_REQUEST:   [['housekeeping'], ['housekeeping_tasks'], ['dashboard']],
    DND_UPDATE:             [['rooms'], ['bookings']],
    CHECKOUT_REQUEST:       [['bookings'], ['finance'], ['manager_departures']],
    VIP_ARRIVAL:            [['bookings'], ['dashboard'], ['manager_arrivals']],
    NIGHT_AUDIT_COMPLETED:  [['dashboard'], ['finance'], ['analytics']],
    NEW_MESSAGE:            [['messages'], ['messages_conversations'], ['messages_conversation_detail']],
    PAYMENT_RECEIVED:       [['saas-billing'], ['finance'], ['payments'], ['dashboard']],
    PAYMENT_DUE_REMINDER:   [['saas-billing'], ['finance']],
    LICENSE_ACTIVATED:      [['saas-billing'], ['license']],
    LICENSE_EXPIRED:        [['saas-billing'], ['license']],
    LICENSE_GRACE_PERIOD:   [['saas-billing'], ['license']],
    LICENSE_PAUSED:         [['saas-billing'], ['license']],
    LICENSE_REVOKED:        [['saas-billing'], ['license']],
    LICENSE_EXPIRING_SOON:  [['saas-billing'], ['license']],
    PROCUREMENT_UPDATED:      [['procurement'], ['inventory']],
    INVENTORY_LOW_STOCK:    [['inventory'], ['dashboard']],
};

const LIVE_REFRESH_EVENT = 'nivas:ws-live-refresh';

export function dispatchLiveRefresh(detail?: { eventType?: string }) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(LIVE_REFRESH_EVENT, { detail }));
}

export function useLiveRefresh(handler: (detail?: { eventType?: string }) => void) {
    useEffect(() => {
        const listener = (e: Event) => handler((e as CustomEvent).detail);
        window.addEventListener(LIVE_REFRESH_EVENT, listener);
        return () => window.removeEventListener(LIVE_REFRESH_EVENT, listener);
    }, [handler]);
}

export function WebSocketProvider({ children }: { children: ReactNode }) {
    const { isAuthenticated, user } = useAuth();
    const queryClient = useQueryClient();
    const socket = useSocket({
        autoConnect: isAuthenticated && user?.userType !== 'GUEST',
    });
    const registeredRef = useRef(false);

    useEffect(() => {
        if (socket.status !== 'connected' || registeredRef.current) return;
        registeredRef.current = true;

        const unsubs: (() => void)[] = [];

        const invalidateFor = (eventType?: string) => {
            if (!eventType) return;
            const queryKeys = EVENT_QUERY_MAP[eventType];
            if (queryKeys) {
                for (const key of queryKeys) {
                    queryClient.invalidateQueries({ queryKey: key });
                }
            }
            dispatchLiveRefresh({ eventType });
        };

        for (const eventType of Object.keys(EVENT_QUERY_MAP)) {
            unsubs.push(socket.on(eventType, () => invalidateFor(eventType)));
        }

        unsubs.push(socket.on('NOTIFICATION', (data: any) => {
            const notifType = data?.notifType || data?.type;
            invalidateFor(notifType);
        }));

        return () => {
            unsubs.forEach(unsub => unsub());
            registeredRef.current = false;
        };
    }, [socket.status, socket.on, queryClient]);

    useEffect(() => {
        if (!isAuthenticated && socket.status === 'connected') {
            socket.disconnect();
        }
    }, [isAuthenticated, socket]);

    return (
        <WebSocketContext.Provider value={{
            status: socket.status,
            on: socket.on,
            off: socket.off,
        }}>
            {children}
        </WebSocketContext.Provider>
    );
}

export function useWebSocket(): WebSocketContextValue {
    const context = useContext(WebSocketContext);
    if (!context) {
        throw new Error('useWebSocket must be used within a WebSocketProvider');
    }
    return context;
}

export default WebSocketContext;
