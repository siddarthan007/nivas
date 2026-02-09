'use client';

import { type ReactNode } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import { SidebarProvider } from '@/lib/contexts/SidebarContext';
import ImpersonationBanner from '@/components/ui/ImpersonationBanner';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useHotelPlan } from '@/lib/hooks/useHotelPlan';
import { AlertTriangle, Clock } from 'lucide-react';

interface DashboardLayoutProps {
    children: ReactNode;
}

function LicenseBanner({ topOffset }: { topOffset: number }) {
    const { plan } = useHotelPlan();
    const { user } = useAuth();

    if (!user?.hotelId || user.userType === 'SUPER_ADMIN') return null;

    const status = plan.licenseStatus;
    const days = plan.daysRemaining;

    if (status === 'ACTIVE' && (days === null || days > 30)) return null;
    if (status === 'TRIAL' && days !== null && days > 7) return null;

    let bgColor = 'var(--notion-yellow-bg)';
    let textColor = 'var(--notion-orange)';
    let message = '';
    let Icon = Clock;

    if (status === 'EXPIRED' || plan.isTrialExpired) {
        bgColor = 'var(--notion-red-bg)';
        textColor = 'var(--notion-red)';
        Icon = AlertTriangle;
        message = 'Your license has expired. Please renew to continue using all features.';
    } else if (status === 'TRIAL') {
        message = `Trial ends in ${days} day${days !== 1 ? 's' : ''}. Upgrade to a paid plan to keep access.`;
    } else if (status === 'ACTIVE' && days !== null && days <= 30) {
        message = `License expires in ${days} day${days !== 1 ? 's' : ''}. Renew soon to avoid disruption.`;
    } else if (status === 'PAUSED') {
        bgColor = 'var(--notion-red-bg)';
        textColor = 'var(--notion-red)';
        Icon = AlertTriangle;
        message = 'Your subscription is paused. Contact support to resume.';
    } else {
        return null;
    }

    return (
        <div style={{
            position: 'fixed', top: `${topOffset}px`, left: 0, right: 0, zIndex: 998,
            backgroundColor: bgColor, color: textColor,
            padding: '8px 16px', fontSize: '13px', fontWeight: '500',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}>
            <Icon size={14} />
            {message}
        </div>
    );
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    const { impersonation, user } = useAuth();
    const { plan } = useHotelPlan();

    // Calculate extra top padding for banners
    const showLicenseBanner = (() => {
        if (!user?.hotelId || user.userType === 'SUPER_ADMIN') return false;
        const status = plan.licenseStatus;
        const days = plan.daysRemaining;
        if (status === 'EXPIRED' || plan.isTrialExpired) return true;
        if (status === 'TRIAL' && days !== null && days <= 7) return true;
        if (status === 'ACTIVE' && days !== null && days <= 30) return true;
        if (status === 'PAUSED') return true;
        return false;
    })();

    const bannerHeight = (impersonation.isImpersonating ? 50 : 0) + (showLicenseBanner ? 36 : 0);

    return (
        <SidebarProvider>
            <ImpersonationBanner />
            <LicenseBanner topOffset={impersonation.isImpersonating ? 50 : 0} />

            <div style={{
                display: 'flex',
                minHeight: '100vh',
                backgroundColor: 'var(--notion-bg)',
                width: '100%'
            }}>
                <Sidebar />
                <main style={{
                    flex: 1,
                    marginLeft: 'var(--sidebar-width)',
                    minWidth: 0,
                    position: 'relative',
                    transition: 'margin-left 300ms ease',
                    paddingTop: bannerHeight > 0 ? `${bannerHeight}px` : '0'
                }}>
                    {children}
                </main>
            </div>
        </SidebarProvider>
    );
}
