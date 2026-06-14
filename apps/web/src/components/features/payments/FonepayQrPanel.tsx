'use client';

import { useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { RefreshCw, CheckCircle, QrCode } from 'lucide-react';
import { useFonepayDynamicQr } from '@/lib/hooks/useFonepay';
import Button from '@/components/ui/Button';

interface FonepayQrPanelProps {
    amount: number;
    enabled?: boolean;
    remarks?: string;
    onPaid?: (prn: string) => void;
}

export default function FonepayQrPanel({ amount, enabled = true, remarks, onPaid }: FonepayQrPanelProps) {
    const { qr, status, error, regenerate, isPaid } = useFonepayDynamicQr(amount, enabled, remarks);

    useEffect(() => {
        if (isPaid && qr?.prn) onPaid?.(qr.prn);
    }, [isPaid, qr?.prn, onPaid]);

    return (
        <div style={{ padding: 16, background: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
            {status === 'loading' && (
                <div style={{ fontSize: 13, color: 'var(--notion-text-secondary)' }}>Generating Fonepay QR…</div>
            )}
            {status === 'error' && (
                <div>
                    <QrCode size={48} style={{ color: 'var(--notion-text-muted)', marginBottom: 8 }} />
                    <div style={{ fontSize: 13, color: 'var(--notion-red)', marginBottom: 8 }}>{error}</div>
                    <Button size="sm" variant="secondary" onClick={() => regenerate()}><RefreshCw size={14} style={{ marginRight: 4 }} />Retry</Button>
                </div>
            )}
            {(status === 'ready' || isPaid) && qr?.qrMessage && (
                <>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                        <QRCodeSVG value={qr.qrMessage} size={160} level="M" />
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--notion-text-secondary)' }}>
                        Scan to pay NPR {amount.toFixed(2)}
                    </div>
                    {isPaid ? (
                        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--notion-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <CheckCircle size={16} /> Payment received
                        </div>
                    ) : (
                        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--notion-text-muted)' }}>Waiting for payment…</div>
                    )}
                </>
            )}
        </div>
    );
}
