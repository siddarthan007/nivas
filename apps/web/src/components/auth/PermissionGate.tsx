'use client';

import type { ReactNode } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';

interface PermissionGateProps {
    permission: string | string[];
    mode?: 'any' | 'all';
    children: ReactNode;
    fallback?: ReactNode;
}

/**
 * Conditionally renders children based on user permissions.
 * Use for hiding UI elements that require specific permissions.
 */
export default function PermissionGate({
    permission,
    mode = 'any',
    children,
    fallback = null
}: PermissionGateProps) {
    const { hasPermission, user } = useAuth();

    // Super admin sees everything
    if (user?.userType === 'SUPER_ADMIN') {
        return <>{children}</>;
    }

    const permissions = Array.isArray(permission) ? permission : [permission];

    let hasAccess = false;
    if (mode === 'any') {
        hasAccess = permissions.some(p => hasPermission(p));
    } else {
        hasAccess = permissions.every(p => hasPermission(p));
    }

    if (!hasAccess) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}
