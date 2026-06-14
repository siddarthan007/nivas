import { useAuthStore } from '../stores/authStore';

/**
 * Permission checking hook with helper methods
 */
export function usePermissions() {
    const { hasPermission, user, permissions } = useAuthStore();

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
        return permissions.some(p => hasPermission(p));
    };

    /**
     * Check if user has ALL of the given permissions (AND logic)
     */
    const canAll = (permissions: string[]): boolean => {
        return permissions.every(p => hasPermission(p));
    };

    /**
     * Check if user is a specific type
     */
    const isUserType = (type: 'SUPER_ADMIN' | 'HOTEL_STAFF' | 'GUEST'): boolean => {
        return user?.type === type;
    };

    /**
     * Check if user has admin-level access (SUPER_ADMIN or has admin permissions)
     */
    const isAdmin = (): boolean => {
        return user?.type === 'SUPER_ADMIN' ||
            user?.role?.toUpperCase() === 'OWNER' ||
            can('system:manage_tenants') ||
            can('users:manage_roles');
    };

    return {
        can,
        canAny,
        canAll,
        isUserType,
        isAdmin,
        permissions,
        userType: user?.type,
    };
}

export default usePermissions;
