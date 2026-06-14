'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const GUEST_TOKEN_KEY = 'guest_token';

type SocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface SocketMessage {
    type: string;
    data?: Record<string, unknown>;
    message?: string;
    timestamp?: string;
}

type MessageHandler = (data: Record<string, unknown>) => void;

interface UseGuestSocketOptions {
    enabled?: boolean;
    reconnectInterval?: number;
    maxRetries?: number;
}

/**
 * WebSocket for the guest portal — uses guest_token (separate from staff auth).
 */
export function useGuestSocket(options: UseGuestSocketOptions = {}) {
    const { enabled = false, reconnectInterval = 5000, maxRetries = 10 } = options;

    const [status, setStatus] = useState<SocketStatus>('disconnected');
    const wsRef = useRef<WebSocket | null>(null);
    const handlersRef = useRef<Map<string, Set<MessageHandler>>>(new Map());
    const retriesRef = useRef(0);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const getWsUrl = useCallback(() => {
        let token: string | null = null;
        try {
            token = localStorage.getItem(GUEST_TOKEN_KEY);
        } catch { /* SSR */ }
        if (!token) return null;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = import.meta.env?.VITE_WS_URL
            || import.meta.env?.VITE_API_URL?.replace(/^http/, 'ws')
            || `${protocol}//${window.location.hostname}:3000`;

        return `${host}/ws/notifications?token=${encodeURIComponent(token)}`;
    }, []);

    const disconnect = useCallback(() => {
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
        retriesRef.current = maxRetries;
        wsRef.current?.close();
        wsRef.current = null;
        setStatus('disconnected');
    }, [maxRetries]);

    const connect = useCallback(() => {
        if (!enabled) return;
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        const url = getWsUrl();
        if (!url) {
            setStatus('disconnected');
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
                    if (message.type === 'ERROR') {
                        setStatus('error');
                        return;
                    }
                    const payload = (message.data || message) as Record<string, unknown>;
                    const handlers = handlersRef.current.get(message.type);
                    handlers?.forEach(handler => handler(payload));
                    handlersRef.current.get('*')?.forEach(handler => handler({ ...payload, type: message.type }));
                } catch {
                    // pong / non-json
                }
            };

            ws.onclose = () => {
                setStatus('disconnected');
                wsRef.current = null;
                if (!enabled) return;
                if (retriesRef.current < maxRetries) {
                    retriesRef.current += 1;
                    reconnectTimerRef.current = setTimeout(connect, reconnectInterval);
                }
            };

            ws.onerror = () => setStatus('error');

            wsRef.current = ws;
        } catch {
            setStatus('error');
        }
    }, [enabled, getWsUrl, reconnectInterval, maxRetries]);

    const on = useCallback((eventType: string, handler: MessageHandler) => {
        if (!handlersRef.current.has(eventType)) {
            handlersRef.current.set(eventType, new Set());
        }
        handlersRef.current.get(eventType)!.add(handler);
        return () => handlersRef.current.get(eventType)?.delete(handler);
    }, []);

    const off = useCallback((eventType: string, handler: MessageHandler) => {
        handlersRef.current.get(eventType)?.delete(handler);
    }, []);

    useEffect(() => {
        if (enabled) {
            connect();
        } else {
            disconnect();
        }
        return () => disconnect();
    }, [enabled, connect, disconnect]);

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

export default useGuestSocket;
