/**
 * @deprecated Use `useUsers()` instead -- it provides unified user+role management.
 * This file is kept for backward compatibility.
 */
import { useUsers } from './useUsers';

export function useRoles() {
    const { roles, isLoading, error, fetchRoles, createRole, updateRole, deleteRole } = useUsers();

    return {
        roles,
        isLoading,
        error,
        fetchRoles,
        createRole: async (data: Parameters<typeof createRole>[0]) => {
            const result = await createRole(data);
            return result.success;
        },
        updateRole: async (id: number, data: Parameters<typeof updateRole>[1]) => {
            const result = await updateRole(id, data);
            return result.success;
        },
        deleteRole: async (id: number) => {
            const result = await deleteRole(id);
            return result.success;
        },
    };
}
