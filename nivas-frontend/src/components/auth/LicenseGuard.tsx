'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { licenseEvents, type LicenseErrorInfo } from '@/lib/api';
import { useAuth } from '@/lib/contexts/AuthContext';
import { AlertTriangle, ShieldOff, Pause, CreditCard } from 'lucide-react';
import Button from '@/components/ui/Button';

interface LicenseGuardProps {
    children: ReactNode;
}

const STATUS_CONFIG: Record<LicenseErrorInfo['licenseStatus'], { icon: typeof AlertTriangle; title: string; color: string; bgColor: string }> = {
    EXPIRED: {
        icon: AlertTriangle,
        title: 'License Expired',
        color: 'var(--notion-red)',
        bgColor: 'var(--notion-red-bg)',
    },
    REVOKED: {
        icon: ShieldOff,
        title: 'License Revoked',
        color: 'var(--notion-red)',
        bgColor: 'var(--notion-red-bg)',
    },
    PAUSED: {
        icon: Pause,
        title: 'License Paused',
        color: 'var(--notion-yellow)',
        bgColor: 'var(--notion-yellow-bg)',
    },
    PENDING_PAYMENT: {
        icon: CreditCard,
        title: 'Payment Pending',
        color: 'var(--notion-orange)',
        bgColor: 'var(--notion-orange-bg)',
    },
};

export default function LicenseGuard({ children }: LicenseGuardProps) {
    const { user } = useAuth();
    const [licenseError, setLicenseError] = useState<LicenseErrorInfo | null>(null);

    useEffect(() => {
        const unsubscribe = licenseEvents.subscribe((info) => {
            setLicenseError(info);
        });
        return unsubscribe;
    }, []);

    // Super admins and guests bypass license checks
    if (user?.userType === 'SUPER_ADMIN' || user?.userType === 'GUEST') {
        return <>{children}</>;
    }

    // Show license error page if license is invalid
    if (licenseError) {
        const config = STATUS_CONFIG[licenseError.licenseStatus];
        const Icon = config.icon;
        const isGracePeriod = licenseError.graceEndsAt && new Date(licenseError.graceEndsAt) > new Date();

        // During grace period, show a warning banner but allow access
        if (isGracePeriod && licenseError.licenseStatus === 'EXPIRED') {
            return (
                <>
                    <div style={{
                        padding: 'var(--space-3) var(--space-6)',
                        backgroundColor: 'var(--notion-yellow-bg)',
                        borderBottom: '1px solid var(--notion-yellow)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 'var(--space-3)',
                        fontSize: '13px',
                        color: 'var(--notion-yellow)',
                        fontWeight: 500,
                        position: 'sticky',
                        top: 0,
                        zIndex: 9999,
                    }}>
                        <AlertTriangle size={16} />
                        <span>
                            Your license has expired. Service will be suspended on{' '}
                            {new Date(licenseError.graceEndsAt!).toLocaleDateString()}.
                            Please contact your administrator.
                        </span>
                        <a
                            href="/hotel/billing"
                            style={{
                                color: 'var(--notion-yellow)',
                                textDecoration: 'underline',
                                fontWeight: 600,
                            }}
                        >
                            View Billing
                        </a>
                    </div>
                    {children}
                </>
            );
        }

        // Full blocking UI for expired/revoked/paused licenses
        return (
            <div className="page-center" style={{ padding: 'var(--space-8)' }}>
                <div className="card-box" style={{ maxWidth: '480px', width: '100%', padding: 'var(--space-10)' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        backgroundColor: config.bgColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto var(--space-6)',
                    }}>
                        <Icon size={32} color={config.color} />
                    </div>

                    <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: 'var(--space-3)' }}>
                        {config.title}
                    </h1>

                    <p style={{ fontSize: '14px', marginBottom: 'var(--space-6)', lineHeight: '1.6' }} className="text-notion-secondary">
                        {licenseError.message}
                    </p>

                    {licenseError.expiresAt && (
                        <p style={{ fontSize: '12px', marginBottom: 'var(--space-6)' }} className="text-notion-muted">
                            Expired: {new Date(licenseError.expiresAt).toLocaleDateString()}
                        </p>
                    )}

                    <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
                        <Button
                            variant="primary"
                            onClick={() => { window.location.href = '/hotel/billing'; }}
                        >
                            View Billing
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => setLicenseError(null)}
                        >
                            Dismiss
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}



