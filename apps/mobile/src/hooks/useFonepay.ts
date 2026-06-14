import { useCallback, useEffect, useRef, useState } from 'react';
import { mobileTokenStorage } from '@/utils/auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL || '';

interface FonepayQrResult {
    prn: string;
    amount: number;
    qrMessage: string;
}

async function fonepayFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await mobileTokenStorage.getToken();
    const res = await fetch(`${API_URL}/api/v1${path}`, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(init?.headers || {}),
        },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.message || 'Fonepay request failed');
    return json.data as T;
}

export function useFonepayDynamicQr(amount: number, enabled: boolean, remarks?: string) {
    const [qr, setQr] = useState<FonepayQrResult | null>(null);
    const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'paid' | 'error'>('idle');
    const [error, setError] = useState<string | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopPolling = useCallback(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }, []);

    const generate = useCallback(async () => {
        if (!enabled || amount <= 0) return null;
        setStatus('loading');
        setError(null);
        try {
            const data = await fonepayFetch<FonepayQrResult>('/finance/fonepay/qr', {
                method: 'POST',
                body: JSON.stringify({ amount, remarks1: remarks || 'Payment' }),
            });
            if (!data?.qrMessage) throw new Error('Fonepay did not return a QR code');
            setQr(data);
            setStatus('ready');
            return data;
        } catch (e: any) {
            setError(e?.message || 'Could not generate Fonepay QR');
            setStatus('error');
            return null;
        }
    }, [amount, enabled, remarks]);

    useEffect(() => {
        if (!enabled || amount <= 0) {
            stopPolling();
            setQr(null);
            setStatus('idle');
            return;
        }
        generate();
        return () => stopPolling();
    }, [amount, enabled, generate, stopPolling]);

    useEffect(() => {
        if (!qr?.prn || status !== 'ready') return;
        stopPolling();
        pollRef.current = setInterval(async () => {
            try {
                const data = await fonepayFetch<{ paid: boolean; status: string }>(
                    `/finance/fonepay/status?prn=${encodeURIComponent(qr.prn)}`
                );
                if (data?.paid) {
                    setStatus('paid');
                    stopPolling();
                }
            } catch {
                /* keep polling */
            }
        }, 3000);
        return () => stopPolling();
    }, [qr?.prn, status, stopPolling]);

    return { qr, status, error, regenerate: generate, isPaid: status === 'paid' };
}
