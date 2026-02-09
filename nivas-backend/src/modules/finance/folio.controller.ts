import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';
import { FolioService } from './folio.service';

export const folioController = new Elysia({ prefix: '/billing' })
    .use(authMiddleware)
    .post('/folio-charges', async ({ body, user, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');

        const ipAddress = request.headers.get('x-forwarded-for') || undefined;
        const charge = await FolioService.createCharge(user.hotelId, user.id, body, ipAddress);
        return createResponse(charge, 'Folio charge created successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.RECORD_PAYMENT,
        body: t.Object({
            bookingId: t.String(),
            description: t.String(),
            amount: t.Number(),
            type: t.Optional(t.String()),
            date: t.Optional(t.String())
        }),
        detail: {
            summary: 'Create a manual folio charge',
            tags: ['Finance']
        }
    })
    .get('/bookings/:bookingId/folio', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');

        const folio = await FolioService.getBookingFolio(user.hotelId, params.bookingId);
        return createResponse(folio, 'Booking folio fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.VIEW_RECORDS,
        detail: {
            summary: 'Get complete folio for a booking',
            tags: ['Finance']
        }
    })
    .patch('/folio-charges/:id', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');

        const updated = await FolioService.updateCharge(user.hotelId, parseInt(params.id), body);
        return createResponse(updated, 'Folio charge updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.RECORD_PAYMENT,
        body: t.Object({
            description: t.Optional(t.String()),
            amount: t.Optional(t.Number()),
            type: t.Optional(t.String())
        }),
        detail: {
            summary: 'Update a folio charge',
            tags: ['Finance']
        }
    })
    .delete('/folio-charges/:id', async ({ params, user, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');

        const ipAddress = request.headers.get('x-forwarded-for') || undefined;
        await FolioService.voidCharge(user.hotelId, user.id, parseInt(params.id), ipAddress);
        return createResponse(null, 'Folio charge voided successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.VOID_INVOICE,
        detail: {
            summary: 'Void a folio charge',
            tags: ['Finance']
        }
    });
