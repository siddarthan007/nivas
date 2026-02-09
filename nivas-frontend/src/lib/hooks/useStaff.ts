import { useState, useCallback } from 'react';
import api from '../api';
import { toast } from 'sonner';
import type { User, CreateUserPayload, UpdateUserPayload, Role } from '../types/api.types';

export function useStaff() {
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await api.get<User[]>('/users');
            setUsers(res.data || []);
        } catch (err: any) {
            const msg = err?.response?.data?.message || err.message || 'Failed to fetch staff';
            setError(msg);
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchRoles = useCallback(async () => {
        try {
            const res = await api.get<Role[]>('/roles');
            setRoles(res.data || []);
        } catch (err: any) {
            console.error('Failed to fetch roles', err);
        }
    }, []);

    const createUser = async (data: CreateUserPayload) => {
        setIsLoading(true);
        try {
            await api.post('/users', data);
            await fetchUsers();
            toast.success('Staff member added successfully');
            return true;
        } catch (err: any) {
            const msg = err?.response?.data?.message || err.message || 'Failed to add staff';
            toast.error(msg);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const updateUser = async (id: string, data: UpdateUserPayload) => {
        setIsLoading(true);
        try {
            await api.patch(`/users/${id}`, data);
            await fetchUsers();
            toast.success('Staff member updated successfully');
            return true;
        } catch (err: any) {
            const msg = err?.response?.data?.message || err.message || 'Failed to update user';
            toast.error(msg);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const toggleUserStatus = async (id: string, isActive: boolean) => {
        setIsLoading(true);
        try {
            await api.patch(`/users/${id}/status`, { isActive });
            await fetchUsers();
            toast.success(`User ${isActive ? 'activated' : 'deactivated'} successfully`);
            return true;
        } catch (err: any) {
            const msg = err?.response?.data?.message || err.message || 'Failed to update user status';
            toast.error(msg);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        users,
        roles,
        isLoading,
        error,
        fetchUsers,
        fetchRoles,
        createUser,
        updateUser,
        toggleUserStatus
    };
}
