'use client';

import type { ReactNode } from 'react';
import { usePermissions } from '@/lib/hooks/usePermissions';

interface RequirePermissionProps {
    children: ReactNode;
    /** Single permission required */
    permission?: string;
    /** Any of these permissions (OR logic) */
    anyOf?: string[];
    /** All of these permissions (AND logic) */
    allOf?: string[];
    /** Render this if access denied */
    fallback?: ReactNode;
    /** Hide component entirely if no permission (default: true) */
    hide?: boolean;
}

/**
 * Component-level permission guard.
 * Use this to conditionally render UI elements based on permissions.
 * 
 * @example
 * // Require single permission
 * <RequirePermission permission="rooms:create">
 *   <AddRoomButton />
 * </RequirePermission>
 * 
 * @example
 * // Require any of permissions
 * <RequirePermission anyOf={["rooms:manage", "rooms:create"]}>
 *   <RoomControls />
 * </RequirePermission>
 * 
 * @example
 * // Show fallback if no permission
 * <RequirePermission permission="staff:manage" fallback={<UpgradePrompt />}>
 *   <StaffPanel />
 * </RequirePermission>
 */
export function RequirePermission({
    children,
    permission,
    anyOf,
    allOf,
    fallback = null,
    hide = true,
}: RequirePermissionProps) {
    const { can, canAny, canAll, userType } = usePermissions();

    // Super admins have all permissions
    if (userType === 'SUPER_ADMIN') {
        return <>{children}</>;
    }

    // Check single permission
    if (permission && !can(permission)) {
        return hide ? null : <>{fallback}</>;
    }

    // Check anyOf (OR logic)
    if (anyOf && !canAny(anyOf)) {
        return hide ? null : <>{fallback}</>;
    }

    // Check allOf (AND logic)
    if (allOf && !canAll(allOf)) {
        return hide ? null : <>{fallback}</>;
    }

    return <>{children}</>;
}

/**
 * HOC variant for route-level protection
 */
export function withPermission<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    permission: string
) {
    return function PermissionGuardedComponent(props: P) {
        return (
            <RequirePermission permission={permission}>
                <WrappedComponent {...props} />
            </RequirePermission>
        );
    };
}

export default RequirePermission;
