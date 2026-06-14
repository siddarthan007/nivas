'use client';

import { useModuleConfig } from '@/lib/hooks/useModuleConfig';
import { useHotelPlan } from '@/lib/hooks/useHotelPlan';
import { usePathname } from '@/lib/router';
import { isPathAllowedByPropertyModules } from '@/lib/config/property-modules';

// Path prefix → plan module id (must match backend module IDs)
const PATH_TO_MODULE: Record<string, string> = {
    '/hotel/rooms': 'rooms',
    '/hotel/bookings': 'bookings',
    '/hotel/housekeeping': 'housekeeping',
    '/hotel/operations/floor-plan': 'floor-plan',
    '/hotel/operations/tables': 'table-plan',
    '/hotel/guests': 'crm',
    '/hotel/orders': 'orders',
    '/hotel/menu': 'menu',
    '/hotel/kitchen': 'kitchen',
    '/hotel/pos': 'orders',
    '/hotel/inventory': 'inventory',
    '/hotel/finance': 'finance',
    '/hotel/reports': 'reports',
    '/hotel/staff': 'staff',
    '/hotel/roles': 'roles',
    '/hotel/crm': 'crm',
    '/hotel/corporate': 'crm',
    '/hotel/events': 'events',
    '/hotel/procurement': 'inventory',
    '/hotel/reviews': 'reports',
};

function getModuleForPath(pathname: string): string | null {
    for (const [prefix, moduleId] of Object.entries(PATH_TO_MODULE)) {
        if (pathname.startsWith(prefix)) return moduleId;
    }
    return null;
}

export default function ModuleGuard({ children }: { children: React.ReactNode }) {
    const { config, isLoading: configLoading } = useModuleConfig();
    const { hasModule, isLoading: planLoading } = useHotelPlan();
    const pathname = usePathname();

    if (configLoading || planLoading) {
        return (
            <div className="page-center-column">
                <div className="animate-spin loading-spinner" />
            </div>
        );
    }

    if (!isPathAllowedByPropertyModules(pathname, config)) {
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

    const requiredModule = getModuleForPath(pathname);
    if (requiredModule && !hasModule(requiredModule)) {
        return (
            <div className="page-center-column">
                <h1 style={{ fontSize: '48px', fontWeight: '700' }}>403</h1>
                <p style={{ fontSize: '14px' }} className="text-notion-secondary">
                    This module is not included in your current plan.
                </p>
                <a href="/hotel" style={{ color: 'var(--notion-blue)', textDecoration: 'none', fontSize: '14px', marginTop: '12px' }}>
                    Go to Dashboard
                </a>
            </div>
        );
    }

    return <>{children}</>;
}
