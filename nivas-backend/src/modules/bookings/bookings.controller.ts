import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { BookingsService } from './bookings.service';
import { CheckoutService } from '../finance/checkout.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

export const bookingsController = new Elysia({ prefix: '/bookings' })
    .use(authMiddleware)
    .post('/', async ({ body, user, request }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }

        const ipAddress = request.headers.get('x-forwarded-for') || undefined;

        const booking = await BookingsService.createBooking(
            user.hotelId,
            user.id,
            body,
            ipAddress
        );

        return createResponse(booking, 'Booking created successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.BOOKINGS.CREATE,
        body: t.Object({
            roomId: t.Number(),
            guestId: t.Optional(t.String()),
            guestName: t.String(),
            guestPhone: t.String(),
            guestEmail: t.Optional(t.String()),
            guestCount: t.Number(),
            checkIn: t.String(),
            checkOut: t.String(),
            totalAmount: t.Number(),
            advancePayment: t.Optional(t.Number()),
            source: t.Optional(t.Union([
                t.Literal('WALK_IN'),
                t.Literal('PHONE'),
                t.Literal('WEBSITE'),
                t.Literal('OTA'),
                t.Literal('TRAVEL_AGENT'),
                t.Literal('CORPORATE')
            ])),
            nationality: t.Optional(t.String()),
            idNumber: t.Optional(t.String()),
            idType: t.Optional(t.String()),
            panNumber: t.Optional(t.String()),
            vatNumber: t.Optional(t.String()),
            corporateAccountId: t.Optional(t.Number()),
            travelAgentId: t.Optional(t.Number())
        }),
        detail: {
            summary: 'Create a new booking',
            tags: ['Bookings']
        }
    })
    .post('/group', async ({ body, user, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const ip = request.headers.get('x-forwarded-for') || undefined;
        const result = await BookingsService.createGroupBooking(user.hotelId, user.id, body, ip);
        return createResponse(result, `Group booking created (${result.count} rooms)`);
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.BOOKINGS.CREATE,
        body: t.Object({
            roomIds: t.Array(t.Number(), { minItems: 1 }),
            guestName: t.String({ minLength: 1 }),
            guestPhone: t.String({ minLength: 5 }),
            guestEmail: t.Optional(t.String()),
            guestCount: t.Optional(t.Number()),
            checkIn: t.String(),
            checkOut: t.String(),
            corporateAccountId: t.Optional(t.Number()),
            source: t.Optional(t.String()),
        }),
        detail: { summary: 'Create a group / block booking (multiple rooms)', tags: ['Bookings'] }
    })
    .get('/', async ({ user, query }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }

        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 20;

        const result = await BookingsService.getBookings(user.hotelId, page, limit, query.segment || 'all', query.search || '');

        return createResponse(result.data, 'Bookings fetched successfully', result.meta);
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.BOOKINGS.READ,
        query: t.Object({
            page: t.Optional(t.String()),
            limit: t.Optional(t.String()),
            segment: t.Optional(t.Union([
                t.Literal('all'),
                t.Literal('active'),
                t.Literal('arrivals'),
                t.Literal('reservations'),
                t.Literal('inhouse'),
                t.Literal('departures')
            ])),
            search: t.Optional(t.String()),
        }),
        detail: {
            summary: 'Get all bookings',
            tags: ['Bookings']
        }
    })
    .get('/:id', async ({ params, user }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }

        const booking = await BookingsService.getBookingById(user.hotelId, params.id);
        return createResponse(booking, 'Booking fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.BOOKINGS.READ,
        detail: {
            summary: 'Get a single booking by ID',
            tags: ['Bookings']
        }
    })
    .patch('/:id', async ({ params, body, user, request }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }

        const ipAddress = request.headers.get('x-forwarded-for') || undefined;
        const booking = await BookingsService.updateBooking(
            user.hotelId, user.id, params.id, body, ipAddress
        );
        return createResponse(booking, 'Booking updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.BOOKINGS.UPDATE,
        body: t.Object({
            roomId: t.Optional(t.Number()),
            guestName: t.Optional(t.String()),
            guestPhone: t.Optional(t.String()),
            guestEmail: t.Optional(t.String()),
            guestCount: t.Optional(t.Number()),
            checkIn: t.Optional(t.String()),
            checkOut: t.Optional(t.String()),
            totalAmount: t.Optional(t.Number()),
            advancePayment: t.Optional(t.Number()),
            source: t.Optional(t.Union([
                t.Literal('WALK_IN'),
                t.Literal('PHONE'),
                t.Literal('WEBSITE'),
                t.Literal('OTA'),
                t.Literal('TRAVEL_AGENT'),
                t.Literal('CORPORATE')
            ]))
        }),
        detail: {
            summary: 'Update a booking',
            tags: ['Bookings']
        }
    })
    .post('/:id/cancel', async ({ params, body, user, request }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }

        const ipAddress = request.headers.get('x-forwarded-for') || undefined;
        const booking = await BookingsService.cancelBooking(
            user.hotelId, user.id, params.id, body.reason, body.cancellationFee, ipAddress
        );
        return createResponse(booking, 'Booking cancelled successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.BOOKINGS.DELETE,
        body: t.Object({
            reason: t.Optional(t.String()),
            cancellationFee: t.Optional(t.Number())
        }),
        detail: {
            summary: 'Cancel a booking',
            tags: ['Bookings']
        }
    })
    .patch('/:id/extend', async ({ params, body, user, request }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }

        const ipAddress = request.headers.get('x-forwarded-for') || undefined;
        const booking = await BookingsService.extendStay(
            user.hotelId, user.id, params.id, body.newCheckOut, body.newTotalAmount, ipAddress
        );
        return createResponse(booking, 'Stay extended successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.BOOKINGS.UPDATE,
        body: t.Object({
            newCheckOut: t.String(),
            newTotalAmount: t.Optional(t.Number())
        }),
        detail: {
            summary: 'Extend a booking stay',
            tags: ['Bookings']
        }
    })
    .patch('/:id/change-room', async ({ params, body, user, request }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }

        const ipAddress = request.headers.get('x-forwarded-for') || undefined;
        const booking = await BookingsService.changeRoom(
            user.hotelId, user.id, params.id, body.newRoomId, ipAddress
        );
        return createResponse(booking, 'Room changed successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.BOOKINGS.UPDATE,
        body: t.Object({
            newRoomId: t.Number()
        }),
        detail: {
            summary: 'Change room for a booking',
            tags: ['Bookings']
        }
    })
    .patch('/:id/check-in', async ({ params, user, request }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }

        const ipAddress = request.headers.get('x-forwarded-for') || undefined;

        const result = await BookingsService.checkIn(
            user.hotelId,
            user.id,
            params.id,
            ipAddress
        );

        return createResponse({
            booking: result.updatedBooking,
            guestPin: result.guestPin
        }, 'Guest checked in successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.BOOKINGS.CREATE,
        detail: {
            summary: 'Check-in a guest',
            tags: ['Bookings']
        }
    })
    .patch('/:id/check-out', async ({ params, user, request }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }

        const ipAddress = request.headers.get('x-forwarded-for') || undefined;

        // Legacy checkout now routes through proper checkout service to ensure invoice + GL
        const result = await CheckoutService.process(
            user.hotelId,
            user.id,
            params.id,
            { payments: [], payLater: true, creditReason: 'Legacy checkout' }
        );

        return createResponse(result, 'Guest checked out successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.GUESTS.CHECK_OUT,
        detail: {
            summary: 'Check-out a guest (legacy → routes to full checkout)',
            tags: ['Bookings']
        }
    })
    /**
     * Preview checkout bill before processing
     */
    .get('/:id/checkout-preview', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const preview = await CheckoutService.preview(user.hotelId, params.id);
        return createResponse(preview, 'Checkout preview generated');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.GUESTS.CHECK_OUT,
        detail: {
            summary: 'Preview checkout bill',
            tags: ['Bookings', 'Finance']
        }
    })
    /**
     * Process full checkout with payments and credit handling
     */
    .post('/:id/checkout', async ({ params, user, body, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const ipAddress = request.headers.get('x-forwarded-for') || undefined;
        const result = await CheckoutService.process(user.hotelId, user.id, params.id, body);
        return createResponse(result, 'Checkout completed successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.GUESTS.CHECK_OUT,
        body: t.Object({
            payments: t.Array(t.Object({
                method: t.Union([
                    t.Literal('CASH'), t.Literal('CARD'), t.Literal('ESEWA'),
                    t.Literal('KHALTI'), t.Literal('CONNECT_IPS'), t.Literal('FONEPAY'),
                    t.Literal('BANK_TRANSFER'), t.Literal('OTHER'),
                ]),
                amount: t.Number({ minimum: 0 }),
                transactionId: t.Optional(t.String()),
                notes: t.Optional(t.String()),
            })),
            discount: t.Optional(t.Number()),
            couponId: t.Optional(t.Number()),
            guestPan: t.Optional(t.String()),
            payLater: t.Optional(t.Boolean()),
            creditReason: t.Optional(t.String()),
        }),
        detail: {
            summary: 'Process checkout with payments',
            tags: ['Bookings', 'Finance']
        }
    });
