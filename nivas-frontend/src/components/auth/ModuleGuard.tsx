'use client';

import { useModuleConfig } from '@/lib/hooks/useModuleConfig';
import { usePathname } from '@/lib/router';

const HOTEL_ROUTES = ['/hotel/rooms', '/hotel/bookings', '/hotel/housekeeping', '/hotel/operations/floor-plan', '/hotel/guests'];
const FB_ROUTES = ['/hotel/orders', '/hotel/menu', '/hotel/operations/tables', '/hotel/kitchen', '/hotel/pos'];

function isRouteDisabled(pathname: string, config: { enableHotel: boolean; enableFoodAndBeverage: boolean }) {
    if (HOTEL_ROUTES.some(r => pathname.startsWith(r)) && !config.enableHotel) return true;
    if (FB_ROUTES.some(r => pathname.startsWith(r)) && !config.enableFoodAndBeverage) return true;
    return false;
}

export default function ModuleGuard({ children }: { children: React.ReactNode }) {
    const { config, isLoading } = useModuleConfig();
    const pathname = usePathname();

    if (isLoading) {
        return (
            <div className="page-center-column">
                <div className="animate-spin loading-spinner" />
            </div>
        );
    }

    if (isRouteDisabled(pathname, config)) {
        return (
            <div className="page-center-column">
                <h1 style={{ fontSize: '48px', fontWeight: '700' }}>403</h1>
                <p style={{ fontSize: '14px' }} className="text-notion-secondary">
                    This module is disabled for your property.
                </p>
                <a href="/hotel" style={{ color: 'var(--notion-blue)', textDecoration: 'none', fontSize: '14px', marginTop: '12px' }}>
                    Go to Dashboard
                </a>
            </div>
        );
    }

    return <>{children}</>;
}
