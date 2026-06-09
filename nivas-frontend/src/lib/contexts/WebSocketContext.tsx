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
    KITCHEN_NEW_ORDER:      [['orders'], ['kitchen'], ['dashboard']],
    KITCHEN_ORDER_STATUS:   [['orders'], ['kitchen']],
    BOOKING_CONFIRMED:      [['bookings'], ['rooms'], ['dashboard']],
    CHECKOUT_ROOM_READY:    [['rooms'], ['housekeeping'], ['bookings'], ['dashboard']],
    HOUSEKEEPING_ALERT:     [['housekeeping']],
    HOUSEKEEPING_REQUEST:   [['housekeeping']],
    DND_UPDATE:             [['rooms']],
    CHECKOUT_REQUEST:       [['bookings']],
    NIGHT_AUDIT_COMPLETED:  [['dashboard'], ['finance'], ['analytics']],
    NEW_ORDER:              [['orders'], ['dashboard']],
    ORDER_READY:            [['orders'], ['kitchen']],
    ORDER_CREATED:          [['orders']],
};

export function WebSocketProvider({ children }: { children: ReactNode }) {
    const { isAuthenticated } = useAuth();
    const queryClient = useQueryClient();
    const socket = useSocket({ autoConnect: isAuthenticated });
    const registeredRef = useRef(false);

    useEffect(() => {
        if (socket.status !== 'connected' || registeredRef.current) return;
        registeredRef.current = true;

        const unsubs: (() => void)[] = [];

        const invalidateFor = (eventType?: string) => {
            const queryKeys = eventType ? EVENT_QUERY_MAP[eventType] : undefined;
            if (!queryKeys) return;
            for (const key of queryKeys) {
                queryClient.invalidateQueries({ queryKey: key });
            }
        };

        // Transient live-data events (e.g. KITCHEN_NEW_ORDER, DND_UPDATE).
        for (const eventType of Object.keys(EVENT_QUERY_MAP)) {
            unsubs.push(socket.on(eventType, () => invalidateFor(eventType)));
        }

        // Bell notifications travel under a single NOTIFICATION envelope; refresh
        // affected queries based on the inner notification type.
        unsubs.push(socket.on('NOTIFICATION', (data: any) => {
            invalidateFor(data?.notifType || data?.type);
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
