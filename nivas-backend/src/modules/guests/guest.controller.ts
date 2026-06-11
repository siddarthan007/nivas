import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { GuestService } from './guest.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

export const guestController = new Elysia({ prefix: '/guests' })
    .use(authMiddleware)

    .get('/search', async ({ query, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');

        const filters = {
            query: query.q,
            isVip: query.isVip ? query.isVip === 'true' : undefined,
            isBanned: query.isBanned ? query.isBanned === 'true' : undefined,
            nationality: query.nationality,
            roomNumber: query.roomNumber,
            dateOfStay: query.dateOfStay,
            customerType: query.customerType
        };

        const results = await GuestService.findGuests(user.hotelId, filters);
        return createResponse(results, 'Guests found');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.GUESTS.VIEW_DETAILS,
        query: t.Object({
            q: t.Optional(t.String()),
            isVip: t.Optional(t.String()),
            isBanned: t.Optional(t.String()),
            nationality: t.Optional(t.String()),
            roomNumber: t.Optional(t.String()),
            dateOfStay: t.Optional(t.String()),
            customerType: t.Optional(t.String())
        })
    })

    .get('/:id/financials', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const financials = await GuestService.getGuestFinancials(user.hotelId, params.id);
        return createResponse(financials, 'Guest financials fetched');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.GUESTS.VIEW_DETAILS
    })

    .get('/:id', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const guest = await GuestService.getGuestById(user.hotelId, params.id);
        return createResponse(guest, 'Guest fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.GUESTS.VIEW_DETAILS,
    })

    .post('/', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const guest = await GuestService.createGuest(user.hotelId, body);
        return createResponse(guest, 'Guest created successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.GUESTS.MANAGE_PROFILES,
        body: t.Object({
            firstName: t.Optional(t.String()),
            lastName: t.Optional(t.String()),
            fullName: t.String(),
            uniqueId: t.Optional(t.String()),
            phone: t.Optional(t.String()),
            email: t.Optional(t.String()),
            fatherName: t.Optional(t.String()),
            dob: t.Optional(t.String()),
            occupation: t.Optional(t.String()),
            nationality: t.Optional(t.String()),
            address: t.Optional(t.String()),
            city: t.Optional(t.String()),
            country: t.Optional(t.String()),
            idType: t.Optional(t.String()),
            idNumber: t.Optional(t.String()),
            panNumber: t.Optional(t.String()),
            vatNumber: t.Optional(t.String()),
            openingDueAmount: t.Optional(t.String()),
            photoUrl: t.Optional(t.String()),
            signatureUrl: t.Optional(t.String()),
            customerType: t.Optional(t.Union([t.Literal('HOTEL_GUEST'), t.Literal('RESTAURANT_CUSTOMER'), t.Literal('BOTH')])),
            notes: t.Optional(t.String())
        })
    })

    .patch('/:id', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updated = await GuestService.updateGuest(user.hotelId, params.id, body);
        return createResponse(updated, 'Guest updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.GUESTS.MANAGE_PROFILES,
        body: t.Partial(t.Object({
            firstName: t.String(),
            lastName: t.String(),
            fullName: t.String(),
            uniqueId: t.String(),
            phone: t.String(),
            email: t.String(),
            fatherName: t.String(),
            dob: t.String(),
            occupation: t.String(),
            nationality: t.String(),
            address: t.String(),
            city: t.String(),
            country: t.String(),
            idType: t.String(),
            idNumber: t.String(),
            panNumber: t.String(),
            vatNumber: t.String(),
            openingDueAmount: t.String(),
            photoUrl: t.String(),
            signatureUrl: t.String(),
            customerType: t.Union([t.Literal('HOTEL_GUEST'), t.Literal('RESTAURANT_CUSTOMER'), t.Literal('BOTH')]),
            notes: t.String(),
            isVip: t.Boolean(),
            isBanned: t.Boolean()
        }))
    })

    .delete('/:id', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        await GuestService.deleteGuest(user.hotelId, params.id);
        return createResponse(null, 'Guest deleted successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.GUESTS.MANAGE_PROFILES
    });
