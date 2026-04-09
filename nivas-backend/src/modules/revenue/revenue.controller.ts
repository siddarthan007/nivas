import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { RevenueService } from './revenue.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

export const revenueController = new Elysia({ prefix: '/revenue' })
    .use(authMiddleware)
    .post('/rules', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const rule = await RevenueService.createRule(user.hotelId, body);
        return createResponse(rule, 'Revenue rule created successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.UPDATE,
        body: t.Object({
            name: t.String(),
            ruleType: t.Union([
                t.Literal('OCCUPANCY_BASED'),
                t.Literal('DEMAND_BASED'),
                t.Literal('COMPETITOR'),
                t.Literal('SEASONAL'),
                t.Literal('LAST_MINUTE'),
                t.Literal('EARLY_BIRD')
            ]),
            minOccupancy: t.Optional(t.Number()),
            maxOccupancy: t.Optional(t.Number()),
            daysBeforeArrival: t.Optional(t.Number()),
            daysOfWeek: t.Optional(t.Array(t.Number())),
            adjustmentType: t.Union([t.Literal('PERCENTAGE'), t.Literal('FLAT')]),
            adjustmentValue: t.Number(),
            applyToRoomTypes: t.Optional(t.Array(t.String())),
            priority: t.Optional(t.Number())
        }),
        detail: { summary: 'Create revenue rule', tags: ['Revenue'] }
    })

    .get('/rules', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const rules = await RevenueService.getAllRules(user.hotelId);
        return createResponse(rules, 'Revenue rules fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.VIEW_STATUS,
        detail: { summary: 'Get all revenue rules', tags: ['Revenue'] }
    })

    .patch('/rules/:id', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updated = await RevenueService.updateRule(user.hotelId, parseInt(params.id), body);
        return createResponse(updated, 'Revenue rule updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.UPDATE,
        body: t.Partial(t.Object({
            name: t.String(),
            ruleType: t.String(),
            minOccupancy: t.Number(),
            maxOccupancy: t.Number(),
            daysBeforeArrival: t.Number(),
            daysOfWeek: t.Array(t.Number()),
            adjustmentType: t.String(),
            adjustmentValue: t.Number(),
            applyToRoomTypes: t.Array(t.String()),
            priority: t.Number(),
            isActive: t.Boolean()
        })),
        detail: { summary: 'Update revenue rule', tags: ['Revenue'] }
    })

    .delete('/rules/:id', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        await RevenueService.deleteRule(user.hotelId, parseInt(params.id));
        return createResponse(null, 'Revenue rule deleted successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.UPDATE,
        detail: { summary: 'Delete revenue rule', tags: ['Revenue'] }
    })

    .get('/calculate-price', async ({ query, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const data = await RevenueService.calculateDynamicPrice(
            user.hotelId,
            parseFloat(query.basePrice),
            query.checkIn,
            query.roomType
        );
        return createResponse(data, 'Dynamic price calculated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.BOOKINGS.READ,
        query: t.Object({
            basePrice: t.String(),
            checkIn: t.String(),
            roomType: t.String()
        }),
        detail: { summary: 'Calculate dynamic price', tags: ['Revenue'] }
    })

    .get('/analytics', async ({ user, query }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const data = await RevenueService.getRevenueAnalytics(user.hotelId, query.startDate, query.endDate);
        return createResponse(data, 'Revenue analytics fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ANALYTICS.VIEW_FINANCIALS,
        query: t.Object({
            startDate: t.Optional(t.String()),
            endDate: t.Optional(t.String())
        }),
        detail: { summary: 'Get revenue analytics', tags: ['Revenue'] }
    });
