import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { LosDiscountService } from './los-discounts.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

/**
 * LOS (Length of Stay) Discounts Controller
 * Manages length-of-stay based pricing discounts
 */
export const losDiscountsController = new Elysia({ prefix: '/los-discounts' })
    .use(authMiddleware)
    /**
     * Create LOS discount rule
     */
    .post('/', async ({ body, user }) => {
        if (!user || !user.hotelId) throw new ValidationError('Hotel ID required');
        const newRule = await LosDiscountService.createRule(user.hotelId, body);
        return createResponse(newRule, 'LOS discount created successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.UPDATE,
        body: t.Object({
            name: t.String(),
            minNights: t.Number(),
            maxNights: t.Optional(t.Number()),
            discountType: t.Union([
                t.Literal('PERCENTAGE'),
                t.Literal('FREE_NIGHT'),
                t.Literal('FLAT_PER_NIGHT')
            ]),
            discountValue: t.Number(),
            applyTo: t.Optional(t.Union([t.Literal('ALL'), t.Literal('LAST'), t.Literal('SPECIFIC')])),
            specificNight: t.Optional(t.Number()),
            roomTypes: t.Optional(t.Array(t.String())),
            startDate: t.Optional(t.String()),
            endDate: t.Optional(t.String())
        }),
        detail: { summary: 'Create LOS discount', tags: ['Revenue'] }
    })
    /**
     * Get all LOS discount rules
     */
    .get('/', async ({ user }) => {
        if (!user || !user.hotelId) throw new ValidationError('Hotel ID required');
        const rules = await LosDiscountService.getAllRules(user.hotelId);
        return createResponse(rules, 'LOS discounts fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.VIEW_STATUS,
        detail: { summary: 'Get all LOS discounts', tags: ['Revenue'] }
    })
    /**
     * Calculate LOS discount for a booking
     */
    .get('/calculate', async ({ user, query }) => {
        if (!user || !user.hotelId) throw new ValidationError('Hotel ID required');
        const result = await LosDiscountService.calculateDiscount(user.hotelId, query);
        return createResponse(result, 'Discount calculation successful');
    }, {
        isSignedIn: true,
        query: t.Object({
            nights: t.String(),
            roomType: t.String(),
            checkIn: t.String()
        }),
        detail: { summary: 'Calculate LOS discount for booking', tags: ['Discounts'] }
    })
    /**
     * Update LOS discount rule
     */
    .patch('/:id', async ({ params, body, user }) => {
        if (!user || !user.hotelId) throw new ValidationError('Hotel ID required');
        const updated = await LosDiscountService.updateRule(user.hotelId, parseInt(params.id), body);
        return createResponse(updated, 'LOS discount updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.UPDATE,
        body: t.Partial(t.Object({
            name: t.String(),
            minNights: t.Number(),
            maxNights: t.Number(),
            discountType: t.String(),
            discountValue: t.Number(),
            isActive: t.Boolean()
        })),
        detail: { summary: 'Update LOS discount', tags: ['Discounts'] }
    })
    /**
     * Delete LOS discount rule
     */
    .delete('/:id', async ({ params, user }) => {
        if (!user || !user.hotelId) throw new ValidationError('Hotel ID required');
        await LosDiscountService.deleteRule(user.hotelId, parseInt(params.id));
        return createResponse(null, 'LOS discount deleted');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.UPDATE,
        detail: { summary: 'Delete LOS discount', tags: ['Discounts'] }
    });
