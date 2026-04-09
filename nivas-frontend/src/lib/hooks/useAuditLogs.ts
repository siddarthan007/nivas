'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface AuditLog {
    id: string;
    userId: string;
    userName: string;
    userRole: string;
    action: string;
    entityType: string;
    entityId: string;
    entityName?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    createdAt: string;
}

interface AuditFilters {
    userId?: string;
    action?: string;
    entityType?: string;
    startDate?: string;
    endDate?: string;
}

/**
 * Hook for fetching audit logs with pagination and filtering
 */
export function useAuditLogs() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0,
    });
    const [filters, setFilters] = useState<AuditFilters>({});

    // Fetch logs
    const fetchLogs = useCallback(async (page = 1) => {
        setIsLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: String(pagination.limit),
            });
            for (const [key, val] of Object.entries(filters)) {
                if (val !== undefined && val !== '') params.append(key, val);
            }

            const response = await api.get<any[]>(`/audit/?${params.toString()}`);

            if (response.data) {
                // Backend returns logs with nested user object { user: { fullName, roleId } }
                // Map to flat structure expected by frontend
                const rawLogs = Array.isArray(response.data)
                    ? response.data
                    : (response.data as any).data || [];

                const mappedLogs: AuditLog[] = rawLogs.map((log: any) => ({
                    id: log.id,
                    userId: log.userId,
                    userName: log.user?.fullName || 'System',
                    userRole: log.user?.roleId ? 'Staff' : 'System',
                    action: log.action,
                    entityType: log.entity || log.entityType,
                    entityId: log.entityId,
                    entityName: log.entityName,
                    details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details,
                    ipAddress: log.ipAddress || log.ip_address,
                    createdAt: log.createdAt,
                }));

                setLogs(mappedLogs);
                const total = (response as any).meta?.total ?? mappedLogs.length;
                setPagination(prev => ({
                    ...prev,
                    page,
                    total,
                    totalPages: Math.max(1, Math.ceil(total / prev.limit)),
                }));
            } else {
                setLogs([]);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch audit logs');
        } finally {
            setIsLoading(false);
        }
    }, [filters, pagination.limit]);

    // Initial fetch
    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    // Apply filters
    const applyFilters = (newFilters: AuditFilters) => {
        setFilters(newFilters);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    // Go to page
    const goToPage = (page: number) => {
        if (page >= 1 && page <= pagination.totalPages) {
            fetchLogs(page);
        }
    };

    // Export to CSV
    const exportToCSV = () => {
        const headers = ['Timestamp', 'User', 'Role', 'Action', 'Entity Type', 'Entity', 'IP Address'];
        const rows = logs.map(log => [
            new Date(log.createdAt).toISOString(),
            log.userName,
            log.userRole,
            log.action,
            log.entityType,
            log.entityName || log.entityId,
            log.ipAddress || '',
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    // Delete logs permanently
    const deleteLogs = async (ids: string[]) => {
        if (ids.length === 0) {
            toast.error('No logs selected');
            return false;
        }

        try {
            const response = await api.delete<{ message: string }>('/audit/', { ids });
            toast.success(response.message || `Deleted ${ids.length} log(s)`);
            await fetchLogs();
            return true;
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to delete logs');
            return false;
        }
    };

    // Get unique values for filters
    const actionTypes = [...new Set(logs.map(l => l.action))];
    const entityTypes = [...new Set(logs.map(l => l.entityType))];

    return {
        logs,
        isLoading,
        error,
        pagination,
        filters,
        actionTypes,
        entityTypes,
        fetchLogs,
        applyFilters,
        goToPage,
        exportToCSV,
        deleteLogs,
    };
}

export default useAuditLogs;
