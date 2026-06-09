'use client';

import { type ReactNode } from 'react';
import AiChatLauncher from "@/components/features/ai/AiChatLauncher";
import SupportButton from "@/components/features/support/SupportButton";
import { usePermissions } from "@/lib/hooks/usePermissions";
import Sidebar from '@/components/layout/Sidebar';
import { SidebarProvider } from '@/lib/contexts/SidebarContext';
import ImpersonationBanner from '@/components/ui/ImpersonationBanner';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useHotelPlan } from '@/lib/hooks/useHotelPlan';
import { AlertTriangle, Clock } from 'lucide-react';

interface DashboardLayoutProps {
    children: ReactNode;
}

function LicenseRibbon() {
    const { plan } = useHotelPlan();
    const { user } = useAuth();

    if (!user?.hotelId || user.userType === 'SUPER_ADMIN') return null;

    const status = plan.licenseStatus;
    const days = plan.daysRemaining;

    if (status === 'ACTIVE' && (days === null || days > 30)) return null;
    if (status === 'TRIAL' && days !== null && days > 7) return null;

    let bgColor = '#D97706';
    let textColor = '#FFFFFF';
    let message = '';
    let Icon = Clock;

    if (status === 'EXPIRED' || plan.isTrialExpired) {
        bgColor = '#DC2626';
        textColor = '#FFFFFF';
        Icon = AlertTriangle;
        message = 'Your license has expired. Please renew to continue using all features.';
    } else if (status === 'TRIAL') {
        message = `Trial ends in ${days} day${days !== 1 ? 's' : ''}. Upgrade to a paid plan to keep access.`;
    } else if (status === 'ACTIVE' && days !== null && days <= 30) {
        message = `License expires in ${days} day${days !== 1 ? 's' : ''}. Renew soon to avoid disruption.`;
    } else if (status === 'PAUSED') {
        bgColor = '#DC2626';
        textColor = '#FFFFFF';
        Icon = AlertTriangle;
        message = 'Your subscription is paused. Contact support to resume.';
    } else {
        return null;
    }

    return (
        <div style={{
            backgroundColor: bgColor, color: textColor,
            padding: '6px 16px', fontSize: '12px', fontWeight: '500',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            flexShrink: 0,
            position: 'sticky', top: 0, zIndex: 50,
        }}>
            <Icon size={12} />
            {message}
        </div>
    );
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    const { impersonation, user } = useAuth();
    const { plan } = useHotelPlan();
    const { can } = usePermissions();

    // Calculate extra top padding for banners
    return (
        <SidebarProvider>
            <ImpersonationBanner />

            {/* Floating support button (hotel staff) — contacts set by SaaS admin. */}
            {user?.userType !== 'SUPER_ADMIN' && <SupportButton />}

            {/* Floating "Ask your hotel" AI assistant (staff). Self-hides if AI off. */}
            {user?.userType !== 'SUPER_ADMIN' && can('analytics:view_operations') && (
                <AiChatLauncher
                    endpoint="/ai/ask" field="question"
                    title="Ask your hotel" subtitle="AI analytics"
                    intro="Ask about your sales, occupancy, room types or guest feedback — answered from your own data."
                    suggestions={['Revenue this week vs last 30 days?', 'Which room type earns the most?', 'Forecast occupancy for next 30 days?', 'Any recurring complaints?']}
                />
            )}

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
                    display: 'flex',
                    flexDirection: 'column',
                }}>
                    <LicenseRibbon />
                    {children}
                </main>
            </div>
        </SidebarProvider>
    );
}
