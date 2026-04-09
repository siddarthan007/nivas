import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { AnalyticsService } from './analytics.service';
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
        return createResponse(data, 'Dashboard stats fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ANALYTICS.VIEW_OPERATIONS,
        detail: { summary: 'Get real-time dashboard stats', tags: ['Analytics'] }
    })
    /**
     * Revenue analytics with trends
     */
    .get('/revenue', async ({ user, query }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }
        // Support both startDate/endDate and days params
        let days = 30;
        if (query.startDate && query.endDate) {
            const start = new Date(query.startDate);
            const end = new Date(query.endDate);
            days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        } else if (query.days) {
            days = parseInt(query.days);
        }
        const data = await AnalyticsService.getRevenueAnalytics(user.hotelId, days);
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
        let days = 30;
        if (query.startDate && query.endDate) {
            const start = new Date(query.startDate);
            const end = new Date(query.endDate);
            days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        } else if (query.days) {
            days = parseInt(query.days);
        }
        const data = await AnalyticsService.getOccupancyAnalytics(user.hotelId, days);
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
        const days = parseInt(query.days ?? '30');
        const data = await AnalyticsService.getKeyMetrics(user.hotelId, days);
        return createResponse(data, 'Key metrics fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ANALYTICS.VIEW_FINANCIALS,
        query: t.Object({ days: t.Optional(t.String()) }),
        detail: { summary: 'Key Performance Metrics (ADR/RevPAR)', tags: ['Analytics'] }
    })
    // Alias: frontend calls /key-metrics
    .get('/key-metrics', async ({ user, query }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }
        const days = parseInt(query.days ?? '30');
        const data = await AnalyticsService.getKeyMetrics(user.hotelId, days);
        return createResponse(data, 'Key metrics fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ANALYTICS.VIEW_FINANCIALS,
        query: t.Object({ days: t.Optional(t.String()) }),
        detail: { summary: 'Key Performance Metrics (alias)', tags: ['Analytics'] }
    });