'use client';

import { useAuth } from '@/lib/contexts/AuthContext';

/**
 * Permission checking hook with helper methods
 */
export function usePermissions() {
    const { hasPermission, user } = useAuth();

    /**
     * Check if user has a specific permission
     */
    const can = (permission: string): boolean => {
        return hasPermission(permission);
    };

    /**
     * Check if user has ANY of the given permissions (OR logic)
     */
    const canAny = (permissions: string[]): boolean => {
        return permissions.some(hasPermission);
    };

    /**
     * Check if user has ALL of the given permissions (AND logic)
     */
    const canAll = (permissions: string[]): boolean => {
        return permissions.every(hasPermission);
    };

    /**
     * Check if user is a specific type
     */
    const isUserType = (type: 'SUPER_ADMIN' | 'HOTEL_STAFF' | 'GUEST'): boolean => {
        return user?.userType === type;
    };

    /**
     * Check if user has admin-level access (SUPER_ADMIN or has admin permissions)
     */
    const isAdmin = (): boolean => {
        return user?.userType === 'SUPER_ADMIN' ||
            user?.role?.name?.toUpperCase() === 'OWNER' ||
            can('system:manage_tenants') ||
            can('users:manage_roles');
    };

    return {
        can,
        canAny,
        canAll,
        isUserType,
        isAdmin,
        permissions: user?.permissions || [],
        userType: user?.userType,
    };
}

export default usePermissions;
