import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PricingService } from './pricing.service';
import { PERMISSIONS } from '../../config/permissions';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';
import { db } from '../../db';
import { hotels } from '../../db/schema';
import { eq } from 'drizzle-orm';

export const pricingController = new Elysia({ prefix: '/revenue/pricing' })
    .use(authMiddleware)
    .post('/check-rate', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');

        const hotel = await db.query.hotels.findFirst({
            where: eq(hotels.id, user.hotelId),
            columns: { timezone: true }
        });
        const timezone = hotel?.timezone ?? 'Asia/Kathmandu';

        const result = await PricingService.calculateRate(
            user.hotelId,
            body.baseRate,
            new Date(body.date),
            timezone
        );
        return createResponse(result, 'Rate calculated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ANALYTICS.VIEW_FINANCIALS,
        body: t.Object({
            baseRate: t.Number(),
            date: t.String()
        }),
        detail: { summary: 'Simulate pricing rules', tags: ['Revenue'] }
    })
    .get('/rules', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const rules = await PricingService.getRules(user.hotelId);
        return createResponse(rules, 'Pricing rules fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        detail: { summary: 'Get all pricing rules', tags: ['Revenue'] }
    })
    .post('/rules', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const rule = await PricingService.createRule(user.hotelId, body);
        return createResponse(rule, 'Pricing rule created successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        body: t.Object({
            name: t.String(),
            type: t.String(),
            adjustmentType: t.Union([t.Literal('FLAT'), t.Literal('PERCENTAGE')]),
            adjustmentValue: t.Number(),
            startDate: t.Optional(t.String()),
            endDate: t.Optional(t.String()),
            daysOfWeek: t.Optional(t.Array(t.Number())),
            isActive: t.Optional(t.Boolean()),
            minOccupancy: t.Optional(t.Number()),
            maxOccupancy: t.Optional(t.Number())
        }),
        detail: { summary: 'Create pricing rule', tags: ['Revenue'] }
    })
    .patch('/rules/:id', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updated = await PricingService.updateRule(user.hotelId, parseInt(params.id), body);
        return createResponse(updated, 'Pricing rule updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        body: t.Partial(t.Object({
            name: t.String(),
            type: t.String(),
            adjustmentType: t.Union([t.Literal('FLAT'), t.Literal('PERCENTAGE')]),
            adjustmentValue: t.Number(),
            startDate: t.Optional(t.String()),
            endDate: t.Optional(t.String()),
            daysOfWeek: t.Optional(t.Array(t.Number())),
            isActive: t.Optional(t.Boolean()),
            minOccupancy: t.Optional(t.Number()),
            maxOccupancy: t.Optional(t.Number())
        })),
        detail: { summary: 'Update pricing rule', tags: ['Revenue'] }
    })
    .delete('/rules/:id', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        await PricingService.deleteRule(user.hotelId, parseInt(params.id));
        return createResponse(null, 'Pricing rule deleted successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        detail: { summary: 'Delete pricing rule', tags: ['Revenue'] }
    });