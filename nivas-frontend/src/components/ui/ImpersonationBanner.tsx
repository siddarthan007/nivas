'use client';

import { AlertTriangle, ArrowLeft, Shield } from 'lucide-react';
import Button from './Button';
import { useAuth } from '@/lib/contexts/AuthContext';

export default function ImpersonationBanner() {
    const { impersonation, endImpersonation } = useAuth();

    if (!impersonation.isImpersonating) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            backgroundColor: 'var(--notion-orange)',
            color: '#fff',
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <AlertTriangle size={20} />
                <span style={{ fontWeight: 600, fontSize: '14px' }}>
                    Viewing as: {impersonation.hotelName}
                </span>
                <span style={{ fontSize: '13px', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Shield size={12} />
                    Impersonation active. All actions are being logged.
                </span>
            </div>
            <Button
                variant="secondary"
                size="sm"
                onClick={endImpersonation}
                style={{
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    border: '1px solid rgba(255,255,255,0.4)',
                    color: '#fff',
                }}
            >
                <ArrowLeft size={14} style={{ marginRight: '6px' }} />
                Return to Admin
            </Button>
        </div>
    );
}
