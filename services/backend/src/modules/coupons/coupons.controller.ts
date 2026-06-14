import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { CouponsService } from './coupons.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

const couponBody = {
    code: t.String(),
    description: t.Optional(t.String()),
    discountType: t.Optional(t.Union([t.Literal('PERCENT'), t.Literal('FIXED')])),
    discountValue: t.Number(),
    maxDiscount: t.Optional(t.Number()),
    minOrderAmount: t.Optional(t.Number()),
    scope: t.Optional(t.Union([t.Literal('ALL'), t.Literal('ROOM'), t.Literal('FNB')])),
    usageLimit: t.Optional(t.Number()),
    validFrom: t.Optional(t.String()),
    validUntil: t.Optional(t.String()),
    isActive: t.Optional(t.Boolean()),
};

export const couponsController = new Elysia({ prefix: '/coupons' })
    .use(authMiddleware)
    .get('/', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        return createResponse(await CouponsService.list(user.hotelId), 'Coupons fetched');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ORDERS.READ,
        detail: { summary: 'List coupons', tags: ['Coupons'] }
    })
    .post('/', async ({ user, body, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const ip = request.headers.get('x-forwarded-for') || undefined;
        return createResponse(await CouponsService.create(user.hotelId, user.id, body, ip), 'Coupon created');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        body: t.Object(couponBody),
        detail: { summary: 'Create coupon', tags: ['Coupons'] }
    })
    .patch('/:id', async ({ user, params, body, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const ip = request.headers.get('x-forwarded-for') || undefined;
        return createResponse(await CouponsService.update(user.hotelId, user.id, parseInt(params.id), body, ip), 'Coupon updated');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        params: t.Object({ id: t.String() }),
        body: t.Partial(t.Object(couponBody)),
        detail: { summary: 'Update coupon', tags: ['Coupons'] }
    })
    .delete('/:id', async ({ user, params, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const ip = request.headers.get('x-forwarded-for') || undefined;
        return createResponse(await CouponsService.remove(user.hotelId, user.id, parseInt(params.id), ip), 'Coupon deleted');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        params: t.Object({ id: t.String() }),
        detail: { summary: 'Delete coupon', tags: ['Coupons'] }
    })
    // Validate a coupon and compute the discount (used by POS / checkout).
    .post('/validate', async ({ user, body }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        return createResponse(
            await CouponsService.validate(user.hotelId, body.code, body.amount, body.scope || 'ALL'),
            'Coupon valid'
        );
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ORDERS.CREATE,
        body: t.Object({
            code: t.String(),
            amount: t.Number(),
            scope: t.Optional(t.Union([t.Literal('ALL'), t.Literal('ROOM'), t.Literal('FNB')])),
        }),
        detail: { summary: 'Validate a coupon', tags: ['Coupons'] }
    });
