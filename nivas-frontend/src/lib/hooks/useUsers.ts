'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { User, Role, CreateUserPayload, UpdateUserPayload, CreateRolePayload } from '@/lib/types/api.types';

type UserMutationPayload = UpdateUserPayload & {
    password?: string;
};

/**
 * Hook for user (staff) management
 */
export function useUsers() {
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch all users
    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await api.get<User[]>('/users');
            if (response.data) {
                setUsers(response.data);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch users');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Fetch all roles
    const fetchRoles = useCallback(async () => {
        try {
            const response = await api.get<Role[]>('/roles');
            if (response.data) {
                setRoles(response.data);
            }
        } catch (err) {
            console.error('Failed to fetch roles:', err);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchUsers();
        fetchRoles();
    }, [fetchUsers, fetchRoles]);

    // Create a new user
    const createUser = async (data: CreateUserPayload) => {
        try {
            const response = await api.post<User>('/iam/register', data);
            if (response.data) {
                setUsers(prev => [...prev, response.data!]);
                return { success: true, user: response.data };
            }
            return { success: false, error: 'Failed to create user' };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Failed to create user' };
        }
    };

    // Update user
    const updateUser = async (id: string, data: UserMutationPayload) => {
        try {
            const user = users.find((item) => item.id === id);
            if (!user) {
                return { success: false, error: 'User not found' };
            }

            const requests: Promise<unknown>[] = [];

            if (data.fullName !== undefined || data.phone !== undefined) {
                requests.push(api.put(`/users/${id}`, {
                    fullName: data.fullName ?? user.fullName,
                    phone: data.phone ?? user.phone,
                }));
            }

            if (data.roleId !== undefined && data.roleId !== user.role?.id) {
                requests.push(api.patch(`/users/${id}/role`, { roleId: data.roleId }));
            }

            if (data.password) {
                requests.push(api.patch(`/users/${id}/password`, { password: data.password }));
            }

            if (requests.length === 0) {
                return { success: true, user };
            }

            await Promise.all(requests);
            await fetchUsers();
            return { success: true };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Failed to update user' };
        }
    };

    // Toggle user active status
    const toggleActive = async (id: string) => {
        const user = users.find(u => u.id === id);
        if (!user) return { success: false, error: 'User not found' };

        try {
            await api.patch(`/users/${id}/status`, { isActive: !user.isActive });
            await fetchUsers();
            return { success: true };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Failed to update user status' };
        }
    };

    // Delete user
    const deleteUser = async (_id: string) => {
        return { success: false, error: 'Deleting users is not supported by the current backend.' };
    };

    // Create a new role
    const createRole = async (data: CreateRolePayload) => {
        try {
            const response = await api.post<Role>('/roles', data);
            if (response.data) {
                setRoles(prev => [...prev, response.data!]);
                return { success: true, role: response.data };
            }
            return { success: false, error: 'Failed to create role' };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Failed to create role' };
        }
    };

    // Delete role
    const deleteRole = async (id: number) => {
        try {
            await api.delete(`/roles/${id}`);
            setRoles(prev => prev.filter(r => r.id !== id));
            return { success: true };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Failed to delete role' };
        }
    };

    // Update role
    const updateRole = async (id: number, data: Partial<CreateRolePayload>) => {
        try {
            const response = await api.patch<Role>(`/roles/${id}`, data);
            if (response.data) {
                setRoles(prev => prev.map(r => r.id === id ? response.data! : r));
                return { success: true, role: response.data };
            }
            return { success: false, error: 'Failed to update role' };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Failed to update role' };
        }
    };

    // Computed values
    const activeUsers = users.filter(u => u.isActive);
    const inactiveUsers = users.filter(u => !u.isActive);

    const stats = {
        total: users.length,
        active: activeUsers.length,
        inactive: inactiveUsers.length,
        rolesCount: roles.length,
    };

    return {
        users,
        roles,
        activeUsers,
        inactiveUsers,
        stats,
        isLoading,
        error,
        fetchUsers,
        fetchRoles,
        createUser,
        updateUser,
        toggleActive,
        deleteUser,
        createRole,
        updateRole,
        deleteRole,
    };
}

export default useUsers;
