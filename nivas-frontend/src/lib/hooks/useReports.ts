'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { RevenueAnalytics, OccupancyAnalytics, KeyMetrics } from '@/lib/types/api.types';

interface ReportPeriod {
    startDate: string;
    endDate: string;
    label: string;
}

/**
 * Hook for fetching analytics and reports data
 */
export function useReports() {
    const [revenue, setRevenue] = useState<RevenueAnalytics | null>(null);
    const [occupancy, setOccupancy] = useState<OccupancyAnalytics | null>(null);
    const [metrics, setMetrics] = useState<KeyMetrics | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [period, setPeriod] = useState<ReportPeriod>({
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] ?? '',
        endDate: new Date().toISOString().split('T')[0] ?? '',
        label: 'Last 30 Days',
    });

    // Fetch all reports
    const fetchReports = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const [revenueRes, occupancyRes, metricsRes] = await Promise.all([
                api.get<RevenueAnalytics>(`/analytics/revenue?startDate=${period.startDate}&endDate=${period.endDate}`),
                api.get<OccupancyAnalytics>(`/analytics/occupancy?startDate=${period.startDate}&endDate=${period.endDate}`),
                api.get<KeyMetrics>('/analytics/key-metrics'),
            ]);

            if (revenueRes.data) setRevenue(revenueRes.data);
            if (occupancyRes.data) {
                const raw = occupancyRes.data as any;
                // Transform backend currentOccupancy object to byRoomType array
                if (raw.currentOccupancy && !raw.byRoomType) {
                    raw.byRoomType = Object.entries(raw.currentOccupancy).map(
                        ([type, data]: [string, any]) => ({
                            type,
                            occupancy: parseFloat(data.rate) || 0,
                            total: data.total || 0,
                            occupied: data.occupied || 0,
                        })
                    );
                }
                if (raw.averageOccupancy && typeof raw.averageOccupancy === 'string') {
                    raw.averageOccupancy = parseFloat(raw.averageOccupancy);
                }
                setOccupancy(raw);
            }
            if (metricsRes.data) setMetrics(metricsRes.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch reports');
        } finally {
            setIsLoading(false);
        }
    }, [period]);

    // Initial fetch and on period change
    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    // Period presets
    const setPeriodPreset = (preset: 'today' | 'week' | 'month' | 'quarter' | 'year') => {
        const now = new Date();
        const end = now.toISOString().split('T')[0] ?? '';
        let start: string;
        let label: string;

        switch (preset) {
            case 'today':
                start = end;
                label = 'Today';
                break;
            case 'week':
                start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] ?? '';
                label = 'Last 7 Days';
                break;
            case 'month':
                start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] ?? '';
                label = 'Last 30 Days';
                break;
            case 'quarter':
                start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] ?? '';
                label = 'Last 90 Days';
                break;
            case 'year':
                start = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] ?? '';
                label = 'Last Year';
                break;
        }

        setPeriod({ startDate: start, endDate: end, label });
    };

    // Custom period
    const setCustomPeriod = (startDate: string, endDate: string) => {
        setPeriod({ startDate, endDate, label: 'Custom' });
    };

    return {
        revenue,
        occupancy,
        metrics,
        period,
        isLoading,
        error,
        fetchReports,
        setPeriodPreset,
        setCustomPeriod,
    };
}

export default useReports;
