import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { AmenitiesService } from './amenities.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

export const amenitiesController = new Elysia({ prefix: '/amenities' })
    .use(authMiddleware)
    .get('/', async ({ user, query }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        return createResponse(await AmenitiesService.list(user.hotelId, query.active === 'true'), 'Amenities fetched');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ORDERS.READ, // readable by POS/front-desk
        query: t.Object({ active: t.Optional(t.String()) }),
        detail: { summary: 'List amenities / extra charges', tags: ['Amenities'] }
    })
    .post('/', async ({ user, body }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        return createResponse(await AmenitiesService.create(user.hotelId, body), 'Amenity created');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        body: t.Object({
            name: t.String({ minLength: 1 }),
            category: t.Optional(t.String()),
            price: t.Number({ minimum: 0 }),
            taxable: t.Optional(t.Boolean()),
            isActive: t.Optional(t.Boolean()),
        }),
        detail: { summary: 'Create amenity', tags: ['Amenities'] }
    })
    .patch('/:id', async ({ user, params, body }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        return createResponse(await AmenitiesService.update(user.hotelId, parseInt(params.id), body), 'Amenity updated');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        params: t.Object({ id: t.String() }),
        body: t.Object({
            name: t.Optional(t.String({ minLength: 1 })),
            category: t.Optional(t.String()),
            price: t.Optional(t.Number({ minimum: 0 })),
            taxable: t.Optional(t.Boolean()),
            isActive: t.Optional(t.Boolean()),
        }),
        detail: { summary: 'Update amenity', tags: ['Amenities'] }
    })
    .delete('/:id', async ({ user, params }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        return createResponse(await AmenitiesService.remove(user.hotelId, parseInt(params.id)), 'Amenity deleted');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        params: t.Object({ id: t.String() }),
        detail: { summary: 'Delete amenity', tags: ['Amenities'] }
    })
    // Post an amenity charge onto a booking's folio (front desk).
    .post('/charge', async ({ user, body, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const ip = request.headers.get('x-forwarded-for') || undefined;
        return createResponse(await AmenitiesService.chargeToBooking(user.hotelId, user.id, body, ip), 'Charge added to folio');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.GENERATE_INVOICE,
        body: t.Object({
            bookingId: t.String(),
            amenityId: t.Number(),
            quantity: t.Optional(t.Number({ minimum: 1 })),
            notes: t.Optional(t.String({ maxLength: 300 })),
        }),
        detail: { summary: 'Charge an amenity to a booking folio', tags: ['Amenities'] }
    });
