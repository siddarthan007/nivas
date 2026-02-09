import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { GuestService } from './guest.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

export const guestsController = new Elysia({ prefix: '/guests' })
    .use(authMiddleware)
    .get('/', async ({ user, query }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const list = await GuestService.searchGuests(user.hotelId, query.search);
        return createResponse(list, 'Guests fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.GUESTS.VIEW_DETAILS,
        query: t.Object({
            search: t.Optional(t.String())
        }),
        detail: { summary: 'Search guest profiles', tags: ['CRM'] }
    })
    .post('/', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const guest = await GuestService.createGuestProfile(user.hotelId, body);
        return createResponse(guest, 'Guest profile created successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.CRM.MANAGE_GUESTS,
        body: t.Object({
            fullName: t.String(),
            phone: t.String(),
            email: t.Optional(t.String()),
            nationality: t.Optional(t.String()),
            preferences: t.Optional(t.Any()),
            tags: t.Optional(t.Array(t.String())),
            isVip: t.Optional(t.Boolean())
        }),
        detail: { summary: 'Create guest profile', tags: ['CRM'] }
    })
    .get('/:id', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const guest = await GuestService.getGuestById(user.hotelId, params.id);
        return createResponse(guest, 'Guest profile fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.GUESTS.VIEW_DETAILS,
        detail: { summary: 'Get single guest profile', tags: ['CRM'] }
    })
    .get('/:id/history', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const data = await GuestService.getGuestHistory(user.hotelId, params.id);
        return createResponse(data, 'Guest history fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.GUESTS.VIEW_DETAILS,
        detail: { summary: 'Get guest stay history', tags: ['CRM'] }
    })
    .patch('/:id', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updated = await GuestService.updateGuestProfile(user.hotelId, params.id, body);
        return createResponse(updated, 'Guest profile updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.GUESTS.CHECK_IN,
        body: t.Object({
            preferences: t.Optional(t.Any()),
            tags: t.Optional(t.Array(t.String())),
            isVip: t.Optional(t.Boolean())
        }),
        detail: { summary: 'Update guest preferences', tags: ['CRM'] }
    });