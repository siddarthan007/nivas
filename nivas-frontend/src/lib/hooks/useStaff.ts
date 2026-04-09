/**
 * Staff management hook - delegates to useUsers for unified user/role management.
 * Provides a toast-based API wrapper for backward compatibility with StaffPage.
 */
import { useCallback } from 'react';
import { toast } from 'sonner';
import { useUsers } from './useUsers';
import type { CreateUserPayload, UpdateUserPayload } from '../types/api.types';

type StaffMutationPayload = UpdateUserPayload & {
    password?: string;
};

export function useStaff() {
    const base = useUsers();

    const createUser = useCallback(async (data: CreateUserPayload) => {
        const result = await base.createUser(data);
        if (result.success) {
            toast.success('Staff member added successfully');
        } else {
            toast.error(result.error || 'Failed to add staff');
        }
        return result.success;
    }, [base]);

    const updateUser = useCallback(async (id: string, data: StaffMutationPayload) => {
        const result = await base.updateUser(id, data);
        if (result.success) {
            toast.success('Staff member updated successfully');
        } else {
            toast.error(result.error || 'Failed to update user');
        }
        return result.success;
    }, [base]);

    const toggleUserStatus = useCallback(async (id: string, isActive: boolean) => {
        const user = base.users.find(u => u.id === id);
        if (!user) {
            toast.error('User not found');
            return false;
        }
        const result = await base.toggleActive(id);
        if (result.success) {
            toast.success(`User ${isActive ? 'activated' : 'deactivated'} successfully`);
        } else {
            toast.error(result.error || 'Failed to update user status');
        }
        return result.success;
    }, [base]);

    return {
        users: base.users,
        roles: base.roles,
        isLoading: base.isLoading,
        error: base.error,
        fetchUsers: base.fetchUsers,
        fetchRoles: base.fetchRoles,
        createUser,
        updateUser,
        toggleUserStatus,
    };
}
