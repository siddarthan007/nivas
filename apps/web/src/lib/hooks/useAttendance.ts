/**
 * Attendance API Hook
 * Connects to /attendance endpoints
 */
import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import { toast } from 'sonner';

export interface AttendanceEntry {
    id: string;
    staffId: string;
    staffName: string;
    department?: string;
    clockIn: string;
    clockOut?: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE';
    notes?: string;
    duration?: number;
    overtime?: number;
    approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
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

export interface AttendanceHistoryEntry extends AttendanceEntry {
    date: string;
    duration: number;
    overtime: number;
}

export interface StaffMonthlySummary {
    staffName: string;
    department: string;
    year: number;
    month: number;
    attendanceMap: Record<string, { id: string; clockIn: string | null; clockOut: string | null; status: string; notes: string | null }>;
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
    // History
    historyEntries: AttendanceHistoryEntry[];
    isHistoryLoading: boolean;
    fetchHistory: (startDate?: string, endDate?: string, userId?: string, mineOnly?: boolean) => Promise<void>;
    // Staff summary
    staffSummary: StaffMonthlySummary | null;
    isSummaryLoading: boolean;
    fetchStaffSummary: (userId: string, year: number, month: number) => Promise<void>;
    // Manual mark
    markAttendance: (userId: string, date: string, status: 'PRESENT' | 'ABSENT' | 'LATE', notes?: string) => Promise<boolean>;
    pendingApprovals: AttendanceEntry[];
    fetchPendingApprovals: () => Promise<void>;
    approveEntry: (id: string) => Promise<boolean>;
    rejectEntry: (id: string, notes?: string) => Promise<boolean>;
}

export function useAttendance(): UseAttendanceReturn {
    const [entries, setEntries] = useState<AttendanceEntry[]>([]);
    const [currentEntry, setCurrentEntry] = useState<AttendanceEntry | null>(null);
    const [stats, setStats] = useState<AttendanceStats>({ present: 0, absent: 0, late: 0, onLeave: 0, total: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // History state
    const [historyEntries, setHistoryEntries] = useState<AttendanceHistoryEntry[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);

    // Staff summary state
    const [staffSummary, setStaffSummary] = useState<StaffMonthlySummary | null>(null);
    const [isSummaryLoading, setIsSummaryLoading] = useState(false);
    const [pendingApprovals, setPendingApprovals] = useState<AttendanceEntry[]>([]);
    const [isClockedIn, setIsClockedIn] = useState(false);

    const isClocked = isClockedIn;

    const fetchAttendance = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const meResponse = await api.get<{
                isClockedIn: boolean;
                currentEntry: AttendanceEntry | null;
                todayEntry: AttendanceEntry | null;
            }>('/attendance/me');

            if (meResponse.data) {
                setIsClockedIn(Boolean(meResponse.data.isClockedIn));
                setCurrentEntry(meResponse.data.currentEntry || null);
            }

            const today = new Date().toISOString().split('T')[0];
            try {
                const rosterResponse = await api.get<{ entries: AttendanceEntry[]; stats: AttendanceStats }>(
                    `/attendance?date=${today}`,
                );
                if (rosterResponse.data) {
                    setEntries(rosterResponse.data.entries || []);
                    setStats(rosterResponse.data.stats || { present: 0, absent: 0, late: 0, onLeave: 0, total: 0 });
                }
            } catch {
                // Staff without roster permission still clock in/out via /attendance/me
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
                setIsClockedIn(true);
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
                setIsClockedIn(false);
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

    const fetchHistory = useCallback(async (startDate?: string, endDate?: string, userId?: string, mineOnly = false) => {
        setIsHistoryLoading(true);
        try {
            const params = new URLSearchParams();
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            const path = mineOnly
                ? `/attendance/my-history?${params.toString()}`
                : `/attendance/history?${params.toString()}${userId ? `&userId=${userId}` : ''}`;
            const response = await api.get<{ entries: AttendanceHistoryEntry[] }>(path);
            setHistoryEntries(response.data?.entries || []);
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to fetch attendance history';
            toast.error(message);
        } finally {
            setIsHistoryLoading(false);
        }
    }, []);

    const fetchStaffSummary = useCallback(async (userId: string, year: number, month: number) => {
        setIsSummaryLoading(true);
        try {
            const response = await api.get<StaffMonthlySummary>(`/attendance/staff/${userId}/summary?year=${year}&month=${month}`);
            setStaffSummary(response.data || null);
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to fetch staff summary';
            toast.error(message);
        } finally {
            setIsSummaryLoading(false);
        }
    }, []);

    const markAttendance = useCallback(async (targetUserId: string, date: string, status: 'PRESENT' | 'ABSENT' | 'LATE', notes?: string): Promise<boolean> => {
        try {
            await api.post('/attendance/mark', { userId: targetUserId, date, status, notes });
            toast.success(`Attendance marked as ${status}`);
            await fetchAttendance();
            return true;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to mark attendance';
            toast.error(message);
            return false;
        }
    }, [fetchAttendance]);

    const fetchPendingApprovals = useCallback(async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const response = await api.get<AttendanceEntry[]>(`/attendance/pending?date=${today}`);
            setPendingApprovals(Array.isArray(response.data) ? response.data : []);
        } catch {
            // Silent — managers only; avoid toast spam if rate-limited or forbidden
        }
    }, []);

    const approveEntry = useCallback(async (id: string): Promise<boolean> => {
        try {
            await api.post(`/attendance/${id}/approve`, {});
            toast.success('Attendance approved');
            await Promise.all([fetchAttendance(), fetchPendingApprovals()]);
            return true;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to approve';
            toast.error(message);
            return false;
        }
    }, [fetchAttendance, fetchPendingApprovals]);

    const rejectEntry = useCallback(async (id: string, notes?: string): Promise<boolean> => {
        try {
            await api.post(`/attendance/${id}/reject`, { notes });
            toast.success('Attendance rejected');
            await Promise.all([fetchAttendance(), fetchPendingApprovals()]);
            return true;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to reject';
            toast.error(message);
            return false;
        }
    }, [fetchAttendance, fetchPendingApprovals]);

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
        clockOut,
        historyEntries,
        isHistoryLoading,
        fetchHistory,
        staffSummary,
        isSummaryLoading,
        fetchStaffSummary,
        markAttendance,
        pendingApprovals,
        fetchPendingApprovals,
        approveEntry,
        rejectEntry,
    };
}

export default useAttendance;
