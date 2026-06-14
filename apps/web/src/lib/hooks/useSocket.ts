/**
 * WebSocket hook for real-time updates
 * Connects to the backend WS endpoint and dispatches events
 */
import { useState, useEffect, useRef, useCallback } from 'react';

type SocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface SocketMessage {
    type: string;
    data?: any;
    timestamp?: string;
}

type MessageHandler = (data: any) => void;

function decodeJwtPayload(token: string): Record<string, unknown> | null {
    try {
        const part = token.split('.')[1];
        if (!part) return null;
        const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
        return JSON.parse(atob(padded));
    } catch {
        return null;
    }
}

function isGuestAuthToken(token: string): boolean {
    const payload = decodeJwtPayload(token);
    if (!payload) return false;
    if (payload.type === 'GUEST') return true;
    const id = payload.id;
    return typeof id === 'string' && id.startsWith('guest-');
}

interface UseSocketOptions {
    autoConnect?: boolean;
    reconnectInterval?: number;
    maxRetries?: number;
}

export function useSocket(options: UseSocketOptions = {}) {
    const { autoConnect = true, reconnectInterval = 5000, maxRetries = 10 } = options;

    const [status, setStatus] = useState<SocketStatus>('disconnected');
    const wsRef = useRef<WebSocket | null>(null);
    const handlersRef = useRef<Map<string, Set<MessageHandler>>>(new Map());
    const retriesRef = useRef(0);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const getWsUrl = useCallback(() => {
        const token = localStorage.getItem('nivas_auth_token');
        if (!token || isGuestAuthToken(token)) return null;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = import.meta.env?.VITE_WS_URL
            || import.meta.env?.VITE_API_URL?.replace(/^http/, 'ws')
            || `${protocol}//${window.location.hostname}:3000`;

        return `${host}/ws/notifications?token=${encodeURIComponent(token)}`;
    }, []);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        const url = getWsUrl();
        if (!url) {
            setStatus('error');
            return;
        }

        setStatus('connecting');

        try {
            const ws = new WebSocket(url);

            ws.onopen = () => {
                setStatus('connected');
                retriesRef.current = 0;
            };

            ws.onmessage = (event) => {
                try {
                    const message: SocketMessage = JSON.parse(event.data);
                    const handlers = handlersRef.current.get(message.type);
                    if (handlers) {
                        handlers.forEach(handler => handler(message.data || message));
                    }
                    // Also broadcast to wildcard handlers
                    const wildcardHandlers = handlersRef.current.get('*');
                    if (wildcardHandlers) {
                        wildcardHandlers.forEach(handler => handler(message));
                    }
                } catch {
                    // Non-JSON message (e.g., 'pong')
                }
            };

            ws.onclose = () => {
                setStatus('disconnected');
                wsRef.current = null;

                if (retriesRef.current < maxRetries) {
                    retriesRef.current += 1;
                    reconnectTimerRef.current = setTimeout(connect, reconnectInterval);
                }
            };

            ws.onerror = () => {
                setStatus('error');
            };

            wsRef.current = ws;
        } catch {
            setStatus('error');
        }
    }, [getWsUrl, reconnectInterval, maxRetries]);

    const disconnect = useCallback(() => {
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
        retriesRef.current = maxRetries; // Prevent reconnection
        wsRef.current?.close();
        wsRef.current = null;
        setStatus('disconnected');
    }, [maxRetries]);

    const on = useCallback((eventType: string, handler: MessageHandler) => {
        if (!handlersRef.current.has(eventType)) {
            handlersRef.current.set(eventType, new Set());
        }
        handlersRef.current.get(eventType)!.add(handler);

        // Return unsubscribe function
        return () => {
            handlersRef.current.get(eventType)?.delete(handler);
        };
    }, []);

    const off = useCallback((eventType: string, handler: MessageHandler) => {
        handlersRef.current.get(eventType)?.delete(handler);
    }, []);

    // Auto-connect on mount
    useEffect(() => {
        if (autoConnect) {
            connect();
        }
        return () => {
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
            }
            retriesRef.current = maxRetries;
            wsRef.current?.close();
        };
    }, [autoConnect, connect, maxRetries]);

    // Ping keepalive
    useEffect(() => {
        if (status !== 'connected') return;
        const pingInterval = setInterval(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send('ping');
            }
        }, 30000);
        return () => clearInterval(pingInterval);
    }, [status]);

    return { status, connect, disconnect, on, off };
}

export default useSocket;
