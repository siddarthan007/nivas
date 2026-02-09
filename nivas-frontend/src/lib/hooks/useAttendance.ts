/**
 * Attendance API Hook
 * Connects to /attendance endpoints
 */
import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import { toast } from 'sonner';

export interface AttendanceEntry {
    id: string; // Changed to string (UUID)
    staffId: string; // Changed to string (UUID)
    staffName: string;
    department?: string;
    clockIn: string;
    clockOut?: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE';
    notes?: string;
    duration?: number; // in minutes
}

export interface AttendanceStats {
    present: number;
    absent: number;
    late: number;
    onLeave: number;
    total: number;
}

export interface ClockInPayload {
    notes?: string;
}

export interface ClockOutPayload {
    notes?: string;
}

export interface UseAttendanceReturn {
    entries: AttendanceEntry[];
    stats: AttendanceStats;
    currentEntry: AttendanceEntry | null;
    isClocked: boolean;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    clockIn: (payload?: ClockInPayload) => Promise<boolean>;
    clockOut: (payload?: ClockOutPayload) => Promise<boolean>;
}

export function useAttendance(): UseAttendanceReturn {
    const [entries, setEntries] = useState<AttendanceEntry[]>([]);
    const [currentEntry, setCurrentEntry] = useState<AttendanceEntry | null>(null);
    const [stats, setStats] = useState<AttendanceStats>({ present: 0, absent: 0, late: 0, onLeave: 0, total: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const isClocked = Boolean(currentEntry && !currentEntry.clockOut);

    const fetchAttendance = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            // Fetch today's attendance list
            const today = new Date().toISOString().split('T')[0];
            const response = await api.get<{ entries: AttendanceEntry[]; stats: AttendanceStats; currentEntry?: AttendanceEntry }>(`/attendance?date=${today}`);

            if (response.data) {
                setEntries(response.data.entries || []);
                setStats(response.data.stats || { present: 0, absent: 0, late: 0, onLeave: 0, total: 0 });
                setCurrentEntry(response.data.currentEntry || null);
            }
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to fetch attendance';
            setError(message);
            console.error('[useAttendance]', e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const clockIn = useCallback(async (payload?: ClockInPayload): Promise<boolean> => {
        try {
            const response = await api.post<AttendanceEntry>('/attendance/clock-in', payload || {});
            if (response.data) {
                setCurrentEntry(response.data);
                toast.success('Clocked in successfully');
                await fetchAttendance();
                return true;
            }
            return false;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to clock in';
            toast.error(message);
            return false;
        }
    }, [fetchAttendance]);

    const clockOut = useCallback(async (payload?: ClockOutPayload): Promise<boolean> => {
        try {
            const response = await api.post<AttendanceEntry>('/attendance/clock-out', payload || {});
            if (response.data) {
                setCurrentEntry(response.data);
                toast.success('Clocked out successfully');
                await fetchAttendance();
                return true;
            }
            return false;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to clock out';
            toast.error(message);
            return false;
        }
    }, [fetchAttendance]);

    useEffect(() => {
        fetchAttendance();
    }, [fetchAttendance]);

    return {
        entries,
        stats,
        currentEntry,
        isClocked,
        isLoading,
        error,
        refresh: fetchAttendance,
        clockIn,
        clockOut
    };
}

export default useAttendance;
