'use client';

import { useState } from 'react';
import { AlertTriangle, ArrowLeft, Shield, Loader2 } from 'lucide-react';
import Button from './Button';
import { useAuth } from '@/lib/contexts/AuthContext';

export default function ImpersonationBanner() {
    const { impersonation, endImpersonation } = useAuth();
    const [isEnding, setIsEnding] = useState(false);

    if (!impersonation.isImpersonating) return null;

    const handleEnd = async () => {
        if (!window.confirm('End impersonation and return to your admin session?')) return;
        setIsEnding(true);
        try {
            await endImpersonation();
        } finally {
            setIsEnding(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            backgroundColor: 'var(--notion-orange)',
            color: 'var(--foreground-inverse)',
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                <AlertTriangle size={20} />
                <span style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap' }}>
                    Viewing as: {impersonation.hotelName}
                </span>
                <span style={{
                    fontSize: '12px',
                    opacity: 0.9,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                }}>
                    <Shield size={12} />
                    Session logged
                    {impersonation.impersonationId && (
                        <span style={{ fontFamily: 'monospace', opacity: 0.7, fontSize: '11px' }}>
                            · {impersonation.impersonationId.slice(0, 8)}
                        </span>
                    )}
                </span>
            </div>
            <Button
                variant="secondary"
                size="sm"
                onClick={handleEnd}
                disabled={isEnding}
                style={{
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    border: '1px solid rgba(255,255,255,0.4)',
                    color: 'var(--foreground-inverse)',
                    flexShrink: 0,
                    marginLeft: '12px',
                }}
            >
                {isEnding ? (
                    <Loader2 size={14} style={{ marginRight: '6px' }} className="spin" />
                ) : (
                    <ArrowLeft size={14} style={{ marginRight: '6px' }} />
                )}
                {isEnding ? 'Returning...' : 'Return to Admin'}
            </Button>
        </div>
    );
}
