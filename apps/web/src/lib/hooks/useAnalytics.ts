'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useLiveRefresh } from '@/lib/contexts/WebSocketContext';
import type {
    DashboardStats,
    RevenueAnalytics,
    OccupancyAnalytics,
    KeyMetrics,
    SaaSOverview,
    SaaSPayment,
} from '@/lib/types/api.types';

function isSuperAdminUser(): boolean {
    try {
        const userStr = localStorage.getItem('nivas_user_data');
        if (!userStr) return false;
        const user = JSON.parse(userStr);
        return user.userType === 'SUPER_ADMIN' || user.role?.name === 'SUPER_ADMIN' || user.role === 'SUPER_ADMIN';
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
                    roomsVacant: roomBreakdown['AVAILABLE'] ?? raw.roomsVacant ?? 0,
                    roomsDirty: roomBreakdown['CLEANING'] ?? raw.roomsDirty ?? 0,
                    roomsClean: roomBreakdown['AVAILABLE'] ?? raw.roomsClean ?? 0,
                    roomsMaintenance: roomBreakdown['MAINTENANCE'] ?? raw.roomsMaintenance ?? 0,
                    todayArrivals: raw.today?.expectedCheckIns ?? raw.todayArrivals ?? 0,
                    todayDepartures: raw.today?.expectedCheckOuts ?? raw.todayDepartures ?? 0,
                    pendingOrders: raw.realtime?.pendingOrders ?? raw.pendingOrders ?? 0,
                    pendingHousekeeping: raw.realtime?.pendingHousekeeping ?? raw.pendingHousekeeping ?? 0,
                    todayRevenue: raw.today?.revenue ?? raw.todayRevenue ?? 0,
                    occupancyRate: raw.realtime?.occupancyRate ?? raw.occupancyRate ?? 0,
                    lowStockItems: raw.lowStockItems ?? 0,
                    // Nepali PMS metrics
                    todayUnpaid: raw.today?.unpaid ?? raw.todayUnpaid ?? 0,
                    todayDiscount: raw.today?.discount ?? raw.todayDiscount ?? 0,
                    totalDue: raw.financials?.totalDue ?? raw.totalDue ?? 0,
                    totalPurchase: raw.today?.totalPurchase ?? raw.totalPurchase ?? 0,
                    totalOrders: raw.today?.totalOrders ?? raw.totalOrders ?? 0,
                    qrOrders: raw.today?.qrOrders ?? raw.qrOrders ?? 0,
                    totalMenuItems: raw.inventory?.totalMenuItems ?? raw.totalMenuItems ?? 0,
                    totalEmployees: raw.staff?.totalEmployees ?? raw.totalEmployees ?? 0,
                    totalAdvancePayments: raw.financials?.totalAdvancePayments ?? raw.totalAdvancePayments ?? 0,
                    todayProfit: raw.today?.todayProfit ?? 0,
                    bestHour: raw.today?.bestHour ?? '--',
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

    useLiveRefresh(useCallback((detail) => {
        const t = detail?.eventType;
        if (!t) return;
        const dashboardEvents = new Set([
            'NEW_ORDER', 'ORDER_CREATED', 'BOOKING_CONFIRMED', 'BOOKING_CHECKED_IN',
            'CHECKOUT_ROOM_READY', 'HOUSEKEEPING_ALERT', 'HOUSEKEEPING_REQUEST',
            'NIGHT_AUDIT_COMPLETED', 'PAYMENT_RECEIVED', 'VIP_ARRIVAL', 'INVENTORY_LOW_STOCK',
        ]);
        if (dashboardEvents.has(t)) {
            void fetchDashboard();
        }
    }, [fetchDashboard]));

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
    const [payments, setPayments] = useState<SaaSPayment[]>([]);
    const [tenants, setTenants] = useState<any[]>([]);
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
            const [tenantsRes, analyticsRes, paymentsRes] = await Promise.all([
                api.get<any[]>('/saas-admin/tenants'),
                api.get<any>('/super-admin/analytics/sales'),
                api.get<{ data?: SaaSPayment[] }>('/saas-billing/payments?limit=100')
            ]);

            const tenants = tenantsRes.data || [];
            setTenants(tenants);
            const analytics = analyticsRes.data || {};
            const allPayments = (paymentsRes.data as any)?.data || paymentsRes.data || [];

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

            setPayments(
                (allPayments as any[]).map((p: any) => ({
                    id: p.id,
                    hotelId: p.hotelId,
                    hotelName: p.hotel?.name || `Hotel #${p.hotelId}`,
                    amount: p.amount,
                    currency: p.currency || 'NPR',
                    status: p.status || 'COMPLETED',
                    paymentMethod: p.paymentMethod,
                    transactionId: p.transactionId,
                    invoiceNumber: p.invoiceNumber,
                    periodStart: p.periodStart,
                    periodEnd: p.periodEnd,
                    notes: p.notes,
                    createdAt: p.createdAt,
                }))
            );
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
        payments,
        tenants,
        isLoading,
        error,
        fetchOverview,
    };
}

export default useAnalytics;
