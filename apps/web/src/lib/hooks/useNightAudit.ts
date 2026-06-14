import { useState, useCallback } from 'react';
import api from '../api';
import { toast } from 'sonner';

export interface NightAuditStatus {
    completedToday: boolean;
    lastAudit: NightAuditRecord | null;
}

export interface NightAuditRecord {
    id: string;
    hotelId: number;
    auditDate: string;
    status: 'COMPLETED' | 'FAILED' | 'IN_PROGRESS';
    roomRevenue: string;
    fnbRevenue: string;
    occupancyPercent: string;
    notes?: string;
    triggeredById?: string;
    triggeredBy?: {
        fullName: string;
    };
    createdAt: string;
    completedAt?: string;
}

export function useNightAudit() {
    const [status, setStatus] = useState<NightAuditStatus>({
        completedToday: false,
        lastAudit: null,
    });
    const [history, setHistory] = useState<NightAuditRecord[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchStatus = useCallback(async () => {
        try {
            const res = await api.get<NightAuditStatus>('/night-audit/status');
            setStatus(res.data || { completedToday: false, lastAudit: null });
        } catch (err: any) {
            console.error('Failed to fetch night audit status:', err);
        }
    }, []);

    const fetchHistory = useCallback(async (limit = 30) => {
        setIsLoading(true);
        try {
            const res = await api.get<NightAuditRecord[]>(`/night-audit/history?limit=${limit}`);
            setHistory(res.data || []);
        } catch (err: any) {
            const msg = err?.message || 'Failed to fetch night audit history';
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const triggerAudit = async () => {
        setIsLoading(true);
        try {
            await api.post('/night-audit/trigger');
            toast.success('Night audit completed successfully');
            await fetchStatus();
            await fetchHistory();
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to run night audit');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        status,
        history,
        isLoading,
        fetchStatus,
        fetchHistory,
        triggerAudit,
    };
}
