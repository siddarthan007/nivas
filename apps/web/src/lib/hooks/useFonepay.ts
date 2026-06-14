'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

interface FonepayQrResult {
    prn: string;
    amount: number;
    qrMessage: string;
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
            const res = await api.post<FonepayQrResult>('/finance/fonepay/qr', {
                amount,
                remarks1: remarks || 'Payment',
            });
            if (!res.data?.qrMessage) {
                throw new Error('Fonepay did not return a QR code');
            }
            setQr(res.data);
            setStatus('ready');
            return res.data;
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
                const res = await api.get<{ paid: boolean; status: string }>(`/finance/fonepay/status?prn=${encodeURIComponent(qr.prn)}`);
                if (res.data?.paid) {
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
