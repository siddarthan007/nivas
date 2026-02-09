'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type {
    DashboardStats,
    RevenueAnalytics,
    OccupancyAnalytics,
    KeyMetrics,
    SaaSOverview,
} from '@/lib/types/api.types';

function isSuperAdminUser(): boolean {
    try {
        const userStr = localStorage.getItem('nivas_user_data');
        if (!userStr) return false;
        const user = JSON.parse(userStr);
        return user.userType === 'SUPER_ADMIN' || user.role === 'SUPER_ADMIN';
    } catch {
        return false;
    }
}

export function useAnalytics() {
    const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
    const [revenueData, setRevenueData] = useState<RevenueAnalytics | null>(null);
    const [occupancyData, setOccupancyData] = useState<OccupancyAnalytics | null>(null);
    const [metrics, setMetrics] = useState<KeyMetrics | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDashboard = useCallback(async () => {
        if (isSuperAdminUser()) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const response = await api.get<any>('/analytics/dashboard');
            if (response.data) {
                const raw = response.data as any;
                const roomBreakdown = raw.rooms?.breakdown ?? {};
                const mapped: DashboardStats = {
                    roomsTotal: raw.rooms?.total ?? raw.roomsTotal ?? 0,
                    roomsOccupied: roomBreakdown['OCCUPIED'] ?? raw.roomsOccupied ?? 0,
                    roomsVacant: roomBreakdown['VACANT'] ?? roomBreakdown['AVAILABLE'] ?? raw.roomsVacant ?? 0,
                    roomsDirty: roomBreakdown['DIRTY'] ?? raw.roomsDirty ?? 0,
                    roomsClean: roomBreakdown['CLEAN'] ?? raw.roomsClean ?? 0,
                    roomsMaintenance: roomBreakdown['MAINTENANCE'] ?? raw.roomsMaintenance ?? 0,
                    todayArrivals: raw.today?.expectedCheckIns ?? raw.todayArrivals ?? 0,
                    todayDepartures: raw.today?.expectedCheckOuts ?? raw.todayDepartures ?? 0,
                    pendingOrders: raw.realtime?.pendingOrders ?? raw.pendingOrders ?? 0,
                    pendingHousekeeping: raw.realtime?.pendingHousekeeping ?? raw.pendingHousekeeping ?? 0,
                    todayRevenue: raw.today?.revenue ?? raw.todayRevenue ?? 0,
                    occupancyRate: raw.realtime?.occupancyRate ?? raw.occupancyRate ?? 0,
                    lowStockItems: raw.lowStockItems ?? 0,
                };
                setDashboardStats(mapped);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to fetch dashboard stats';
            if (!msg.includes('400') && !msg.includes('403')) {
                setError(msg);
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchRevenue = useCallback(async (days = 30) => {
        if (isSuperAdminUser()) return;

        try {
            const response = await api.get<RevenueAnalytics>(`/analytics/revenue?days=${days}`);
            if (response.data) {
                setRevenueData(response.data);
            }
        } catch {
            // Silently fail for non-critical analytics
        }
    }, []);

    const fetchOccupancy = useCallback(async (days = 30) => {
        if (isSuperAdminUser()) return;

        try {
            const response = await api.get<OccupancyAnalytics>(`/analytics/occupancy?days=${days}`);
            if (response.data) {
                setOccupancyData(response.data);
            }
        } catch {
            // Silently fail for non-critical analytics
        }
    }, []);

    const fetchMetrics = useCallback(async (days = 30) => {
        if (isSuperAdminUser()) return;

        try {
            const response = await api.get<KeyMetrics>(`/analytics/metrics?days=${days}`);
            if (response.data) {
                setMetrics(response.data);
            }
        } catch {
            // Silently fail for non-critical analytics
        }
    }, []);

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    const refreshAll = useCallback(async (days = 30) => {
        await Promise.all([
            fetchDashboard(),
            fetchRevenue(days),
            fetchOccupancy(days),
            fetchMetrics(days),
        ]);
    }, [fetchDashboard, fetchRevenue, fetchOccupancy, fetchMetrics]);

    return {
        dashboardStats,
        revenueData,
        occupancyData,
        metrics,
        isLoading,
        error,
        fetchDashboard,
        fetchRevenue,
        fetchOccupancy,
        fetchMetrics,
        refreshAll,
    };
}

export function useSaaSAnalytics() {
    const [overview, setOverview] = useState<SaaSOverview | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchOverview = useCallback(async () => {
        if (!isSuperAdminUser()) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const [tenantsRes, analyticsRes] = await Promise.all([
                api.get<any[]>('/saas-admin/tenants'),
                api.get<any>('/super-admin/analytics/sales')
            ]);

            const tenants = tenantsRes.data || [];
            const analytics = analyticsRes.data || {};

            const now = new Date();
            const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

            const totalTenants = tenants.length;
            const activeTenants = tenants.filter((t: any) => t.isActive).length;
            const expiringLicenses = tenants.filter((t: any) => {
                if (!t.licenseExpiresAt) return false;
                const expiry = new Date(t.licenseExpiresAt);
                return expiry > now && expiry <= thirtyDaysFromNow;
            }).length;

            setOverview({
                totalTenants,
                activeTenants,
                expiringLicenses,
                monthlyRevenue: analytics.totalRevenue || 0,
                totalRevenue: analytics.totalRevenue || 0,
                revenueHistory: analytics.revenueHistory || [],
                tenantGrowth: analytics.tenantGrowth || []
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch SaaS overview');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOverview();
    }, [fetchOverview]);

    return {
        overview,
        isLoading,
        error,
        fetchOverview,
    };
}

export default useAnalytics;
