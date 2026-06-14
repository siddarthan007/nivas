import React, { createContext, useContext, useEffect } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAuthStore } from '@/stores/authStore';

interface SocketContextValue {
    status: ReturnType<typeof useSocket>['status'];
    unreadCount: number;
    connect: () => Promise<void>;
    disconnect: () => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
    const { connect, disconnect, status, unreadCount } = useSocket();
    const token = useAuthStore(s => s.token);

    useEffect(() => {
        if (token) {
            connect();
        } else {
            disconnect();
        }
    }, [token, connect, disconnect]);

    return (
        <SocketContext.Provider value={{ status, unreadCount, connect, disconnect }}>
            {children}
        </SocketContext.Provider>
    );
}

export function useSocketContext(): SocketContextValue {
    const ctx = useContext(SocketContext);
    if (!ctx) throw new Error('useSocketContext must be used within SocketProvider');
    return ctx;
}
