import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { AnalyticsService } from './analytics.service';
import { ForecastService } from './forecast.service';
import { SaasAdminService } from '../saas/saas-admin.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

/**
 * Analytics Controller - Comprehensive insights for dashboard and reporting
 */
export const analyticsController = new Elysia({ prefix: '/analytics' })
    .use(authMiddleware)
    /**
     * Real-time dashboard stats - current operational snapshot
     */
    .get('/dashboard', async ({ user }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }
        const data = await AnalyticsService.getRealtimeDashboard(user.hotelId);
        
        // Dynamic permission filtering based on user permissions
        const hasOperations = user?.permissions?.includes(PERMISSIONS.ANALYTICS.VIEW_OPERATIONS) || user?.permissions?.includes('*') || user?.type === 'SUPER_ADMIN';
        const hasFinancials = user?.permissions?.includes(PERMISSIONS.ANALYTICS.VIEW_FINANCIALS) || user?.permissions?.includes('*') || user?.type === 'SUPER_ADMIN';

        if (!hasFinancials && data) {
            // Zero/hide financial metrics
            if (data.today) {
                data.today.revenue = 0;
                data.today.unpaid = 0;
                data.today.discount = 0;
                data.today.totalPurchase = 0;
                data.today.todayProfit = 0;
            }
            if (data.financials) {
                data.financials.totalDue = 0;
                data.financials.totalAdvancePayments = 0;
            }
        }

        if (!hasOperations && data) {
            // Hide operational metrics for unauthorized staff
            if (data.realtime) {
                data.realtime.activeGuests = 0;
                data.realtime.occupancyRate = 0;
            }
            if (data.today) {
                data.today.expectedCheckIns = 0;
                data.today.expectedCheckOuts = 0;
                data.today.bestHour = '--';
            }
            if (data.rooms) {
                data.rooms.total = 0;
                data.rooms.breakdown = {};
            }
        }

        return createResponse(data, 'Dashboard stats fetched successfully');
    }, {
        isSignedIn: true,
        detail: { summary: 'Get real-time dashboard stats', tags: ['Analytics'] }
    })
    /**
     * Demand / occupancy + revenue forecast (30/60/90 day) from booking pace.
     */
    .get('/forecast', async ({ user, query }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const horizon = Math.min(180, Math.max(7, parseInt(query.horizon || '90') || 90));
        const data = await ForecastService.getForecast(user.hotelId, horizon);
        return createResponse(data, 'Forecast generated');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ANALYTICS.VIEW_OPERATIONS,
        query: t.Object({ horizon: t.Optional(t.String()) }),
        detail: { summary: 'Demand/occupancy/revenue forecast (on-the-books + pickup)', tags: ['Analytics'] }
    })
    /**
     * Support contacts (platform-wide; read-only for any signed-in user).
     */
    .get('/support-info', async () => {
        return createResponse(await SaasAdminService.getSupportConfig(), 'Support info');
    }, {
        isSignedIn: true,
        detail: { summary: 'Get platform support contacts', tags: ['Support'] }
    })
    /**
     * Sales insights — weekday revenue, busiest hours, visitors, birthdays
     */
    .get('/sales-insights', async ({ user }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }
        const data = await AnalyticsService.getSalesInsights(user.hotelId);
        return createResponse(data, 'Sales insights fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ANALYTICS.VIEW_OPERATIONS,
        detail: { summary: 'Get sales insights (weekday, hours, visitors, birthdays)', tags: ['Analytics'] }
    })
    /**
     * Revenue analytics with trends
     */
    .get('/revenue', async ({ user, query }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }
        const data = await AnalyticsService.getRevenueAnalytics(user.hotelId, {
            days: query.days ? parseInt(query.days) : undefined,
            startDate: query.startDate,
            endDate: query.endDate,
        });
        return createResponse(data, 'Revenue analytics fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ANALYTICS.VIEW_FINANCIALS,
        query: t.Object({
            days: t.Optional(t.String()),
            startDate: t.Optional(t.String()),
            endDate: t.Optional(t.String())
        }),
        detail: { summary: 'Get revenue analytics with trends', tags: ['Analytics'] }
    })
    /**
     * Occupancy analytics
     */
    .get('/occupancy', async ({ user, query }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }
        const data = await AnalyticsService.getOccupancyAnalytics(user.hotelId, {
            days: query.days ? parseInt(query.days) : undefined,
            startDate: query.startDate,
            endDate: query.endDate,
        });
        return createResponse(data, 'Occupancy analytics fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ANALYTICS.VIEW_OPERATIONS,
        query: t.Object({
            days: t.Optional(t.String()),
            startDate: t.Optional(t.String()),
            endDate: t.Optional(t.String())
        }),
        detail: { summary: 'Get occupancy analytics', tags: ['Analytics'] }
    })
    /**
     * Staff performance metrics
     */
    .get('/staff-performance', async ({ user, query }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }
        const days = parseInt(query.days ?? '30');
        const data = await AnalyticsService.getStaffPerformance(user.hotelId, days);
        return createResponse(data, 'Staff performance fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ANALYTICS.VIEW_OPERATIONS,
        query: t.Object({ days: t.Optional(t.String()) }),
        detail: { summary: 'Get staff performance metrics', tags: ['Analytics'] }
    })
    /**
     * SaaS-level overview (Super Admin only)
     */
    .get('/overview', async ({ user }) => {
        if (user!.type !== 'SUPER_ADMIN') {
            throw new ValidationError('Unauthorized: Super Admin access required');
        }
        const data = await AnalyticsService.getSaaSOverview();
        return createResponse(data, 'SaaS overview fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.VIEW_SAAS_ANALYTICS,
        detail: { summary: 'Get SaaS-level overview', tags: ['Analytics'] }
    })
    .get('/metrics', async ({ user, query }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }
        const data = await AnalyticsService.getKeyMetrics(user.hotelId, {
            days: query.days ? parseInt(query.days) : undefined,
            startDate: query.startDate,
            endDate: query.endDate,
        });
        return createResponse(data, 'Key metrics fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ANALYTICS.VIEW_FINANCIALS,
        query: t.Object({
            days: t.Optional(t.String()),
            startDate: t.Optional(t.String()),
            endDate: t.Optional(t.String()),
        }),
        detail: { summary: 'Key Performance Metrics (ADR/RevPAR)', tags: ['Analytics'] }
    })
    // Alias: frontend calls /key-metrics
    .get('/key-metrics', async ({ user, query }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }
        const data = await AnalyticsService.getKeyMetrics(user.hotelId, {
            days: query.days ? parseInt(query.days) : undefined,
            startDate: query.startDate,
            endDate: query.endDate,
        });
        return createResponse(data, 'Key metrics fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ANALYTICS.VIEW_FINANCIALS,
        query: t.Object({
            days: t.Optional(t.String()),
            startDate: t.Optional(t.String()),
            endDate: t.Optional(t.String()),
        }),
        detail: { summary: 'Key Performance Metrics (alias)', tags: ['Analytics'] }
    })
    /**
     * Nepali date (Bikram Sambat) conversion utility
     */
    .get('/nepali-date', async ({ query }) => {
        const dateStr = query.date;
        const adDate = dateStr ? new Date(dateStr) : new Date();
        if (isNaN(adDate.getTime())) {
            throw new ValidationError('Invalid date format');
        }
        const { NepaliDate } = await import('../../utils/nepali-date');
        const bs = new NepaliDate(adDate);
        const bsYear = bs.getYear();
        const bsMonth = bs.getMonth() + 1;
        const bsDay = bs.getDate();
        const BS_MONTH_NAMES_EN = [
            'Baisakh', 'Jestha', 'Asar', 'Shrawan', 'Bhadra', 'Asoj',
            'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
        ];
        const BS_DAY_NAMES = ['आइत', 'सोम', 'मंगल', 'बुध', 'बिहि', 'शुक्र', 'शनि'];
        return createResponse({
            ad: adDate.toISOString(),
            bs: {
                year: bsYear,
                month: bsMonth,
                day: bsDay,
                formatted: `${bsDay} ${BS_MONTH_NAMES_EN[bsMonth - 1]}, ${bsYear}`,
                formattedShort: `${bsYear}/${bsMonth}/${bsDay}`,
            },
            dayName: BS_DAY_NAMES[adDate.getDay()] || '',
        }, 'Nepali date converted successfully');
    }, {
        detail: { summary: 'Convert AD date to Nepali BS date', tags: ['Utilities'] }
    });