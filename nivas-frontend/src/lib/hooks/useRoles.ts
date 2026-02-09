import { useState, useCallback } from 'react';
import api from '../api';
import { toast } from 'sonner';
import type { Role, CreateRolePayload } from '../types/api.types';

export function useRoles() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchRoles = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await api.get<Role[]>('/roles');
            setRoles(res.data || []);
        } catch (err: any) {
            const msg = err?.response?.data?.message || err.message || 'Failed to fetch roles';
            setError(msg);
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createRole = async (data: CreateRolePayload) => {
        setIsLoading(true);
        try {
            await api.post('/roles', data);
            await fetchRoles();
            toast.success('Role created successfully');
            return true;
        } catch (err: any) {
            const msg = err?.response?.data?.message || err.message || 'Failed to create role';
            toast.error(msg);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const updateRole = async (id: number, data: Partial<CreateRolePayload>) => {
        setIsLoading(true);
        try {
            await api.patch(`/roles/${id}`, data);
            await fetchRoles();
            toast.success('Role updated successfully');
            return true;
        } catch (err: any) {
            const msg = err?.response?.data?.message || err.message || 'Failed to update role';
            toast.error(msg);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const deleteRole = async (id: number) => {
        if (!confirm('Are you sure you want to delete this role? This might affect assigned users.')) return false;
        setIsLoading(true);
        try {
            await api.delete(`/roles/${id}`);
            await fetchRoles();
            toast.success('Role deleted successfully');
            return true;
        } catch (err: any) {
            const msg = err?.response?.data?.message || err.message || 'Failed to delete role';
            toast.error(msg);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        roles,
        isLoading,
        error,
        fetchRoles,
        createRole,
        updateRole,
        deleteRole
    };
}
