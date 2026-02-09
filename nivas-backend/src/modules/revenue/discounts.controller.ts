import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { DiscountService } from './discounts.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

export const discountsController = new Elysia({ prefix: '/discounts' })
    .use(authMiddleware)
    .post('/', async ({ body, user }) => {
        if (!user || !user.hotelId) throw new ValidationError('Hotel ID required');
        const newRule = await DiscountService.createRule(user.hotelId, body);
        return createResponse(newRule, 'Discount rule created successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.MENU.CREATE,
        body: t.Object({
            outletId: t.Optional(t.Number()),
            name: t.String(),
            description: t.Optional(t.String()),
            discountType: t.Union([t.Literal('PERCENTAGE'), t.Literal('FLAT'), t.Literal('BOGO')]),
            discountValue: t.Number(),
            startTime: t.Optional(t.String()),
            endTime: t.Optional(t.String()),
            daysOfWeek: t.Optional(t.Array(t.Number())),
            startDate: t.Optional(t.String()),
            endDate: t.Optional(t.String()),
            minOrderAmount: t.Optional(t.Number()),
            applicableCategories: t.Optional(t.Array(t.String())),
            applicableItems: t.Optional(t.Array(t.Number())),
            priority: t.Optional(t.Number())
        }),
        detail: { summary: 'Create discount rule', tags: ['Revenue'] }
    })
    .get('/', async ({ user }) => {
        if (!user || !user.hotelId) throw new ValidationError('Hotel ID required');
        const rules = await DiscountService.getAllRules(user.hotelId);
        return createResponse(rules, 'Discount rules fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.MENU.VIEW,
        detail: { summary: 'Get all discount rules', tags: ['Revenue'] }
    })
    .get('/active', async ({ user }) => {
        if (!user || !user.hotelId) throw new ValidationError('Hotel ID required');
        const activeRules = await DiscountService.getActiveRules(user.hotelId);
        return createResponse(activeRules, 'Active discount rules fetched successfully');
    }, {
        isSignedIn: true,
        detail: { summary: 'Get currently active discounts', tags: ['Revenue'] }
    })
    .patch('/:id', async ({ params, body, user }) => {
        if (!user || !user.hotelId) throw new ValidationError('Hotel ID required');
        const updated = await DiscountService.updateRule(user.hotelId, parseInt(params.id), body);
        return createResponse(updated, 'Discount rule updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.MENU.UPDATE,
        body: t.Partial(t.Object({
            name: t.String(),
            description: t.String(),
            discountType: t.String(),
            discountValue: t.Number(),
            startTime: t.String(),
            endTime: t.String(),
            daysOfWeek: t.Array(t.Number()),
            minOrderAmount: t.Number(),
            isActive: t.Boolean(),
            priority: t.Number()
        })),
        detail: { summary: 'Update discount rule', tags: ['Revenue'] }
    })
    .delete('/:id', async ({ params, user }) => {
        if (!user || !user.hotelId) throw new ValidationError('Hotel ID required');
        await DiscountService.deleteRule(user.hotelId, parseInt(params.id));
        return createResponse(null, 'Discount rule deleted successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.MENU.DELETE,
        detail: { summary: 'Delete discount rule', tags: ['Revenue'] }
    });
