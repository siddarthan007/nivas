'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type {
    HousekeepingTask,
    HousekeepingStatus,
    CreateHousekeepingPayload,
} from '@/lib/types/api.types';

/**
 * Hook for housekeeping task management
 */
export function useHousekeeping() {
    const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch all tasks
    const fetchTasks = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await api.get<HousekeepingTask[]>('/housekeeping');
            if (response.data) {
                setTasks(response.data);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    // Create a new task
    const createTask = async (data: CreateHousekeepingPayload) => {
        try {
            const response = await api.post<HousekeepingTask>('/housekeeping', data);
            if (response.data) {
                setTasks(prev => [...prev, response.data!]);
                toast.success('Housekeeping task created');
                return { success: true, task: response.data };
            }
            return { success: false, error: 'Failed to create task' };
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to create task';
            toast.error(msg);
            return { success: false, error: msg };
        }
    };

    // Update task status
    const updateStatus = async (taskId: number, status: HousekeepingStatus) => {
        try {
            const response = await api.patch<HousekeepingTask>(`/housekeeping/${taskId}/status`, { status });
            if (response.data) {
                setTasks(prev => prev.map(t => t.id === taskId ? response.data! : t));
                toast.success(`Task marked as ${status.toLowerCase()}`);
                return { success: true, task: response.data };
            }
            return { success: false, error: 'Failed to update status' };
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to update status';
            toast.error(msg);
            return { success: false, error: msg };
        }
    };

    // Start a task (sets IN_PROGRESS and records start time)
    const startTask = async (taskId: number) => {
        try {
            const response = await api.patch<HousekeepingTask>(`/housekeeping/${taskId}/start`);
            if (response.data) {
                setTasks(prev => prev.map(t => t.id === taskId ? response.data! : t));
                toast.success('Task started');
                return { success: true, task: response.data };
            }
            return { success: false, error: 'Failed to start task' };
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to start task';
            toast.error(msg);
            return { success: false, error: msg };
        }
    };

    // Complete a task
    const completeTask = async (taskId: number) => {
        return updateStatus(taskId, 'COMPLETED');
    };

    // Delete a task
    const deleteTask = async (taskId: number) => {
        try {
            await api.delete(`/housekeeping/${taskId}`);
            setTasks(prev => prev.filter(t => t.id !== taskId));
            toast.success('Housekeeping task deleted');
            return { success: true };
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to delete task';
            toast.error(msg);
            return { success: false, error: msg };
        }
    };

    // Filtered tasks by status
    const pendingTasks = tasks.filter(t => t.status === 'PENDING');
    const inProgressTasks = tasks.filter(t => t.status === 'IN_PROGRESS');
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED');

    // Stats
    const stats = {
        total: tasks.length,
        pending: pendingTasks.length,
        inProgress: inProgressTasks.length,
        completed: completedTasks.length,
    };

    return {
        tasks,
        isLoading,
        error,
        stats,
        pendingTasks,
        inProgressTasks,
        completedTasks,
        fetchTasks,
        createTask,
        updateStatus,
        startTask,
        completeTask,
        deleteTask,
    };
}

export default useHousekeeping;
