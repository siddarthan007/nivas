import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { BanquetsService } from './banquets.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';
import { logAction } from '../system/audit.service';

/**
 * Banquets Controller
 * Manages event/function venues and bookings
 */
export const banquetsController = new Elysia({ prefix: '/banquets' })
    .use(authMiddleware)
    /**
     * Create banquet venue
     */
    .post('/venues', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const venue = await BanquetsService.createVenue(user.hotelId, body);

        await logAction(
            user.hotelId,
            user.id,
            'CREATE_BANQUET_VENUE',
            'BANQUET',
            venue?.id?.toString() ?? '',
            { name: body.name, capacity: body.capacity }
        );

        return createResponse(venue, 'Venue created successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.BANQUETS.CREATE,
        body: t.Object({
            name: t.String(),
            capacity: t.Number(),
            area: t.Optional(t.String()),
            amenities: t.Optional(t.Array(t.String())),
            baseRateHalf: t.Optional(t.Number()),
            baseRateFull: t.Optional(t.Number()),
            imageUrls: t.Optional(t.Array(t.String()))
        }),
        detail: { summary: 'Create banquet venue', tags: ['Events'] }
    })
    /**
     * Get all venues
     */
    .get('/venues', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const venues = await BanquetsService.getAllVenues(user.hotelId);
        return createResponse(venues, 'Venues fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.BANQUETS.VIEW,
        detail: { summary: 'Get all banquet venues', tags: ['Events'] }
    })
    /**
     * Update venue
     */
    .patch('/venues/:id', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updated = await BanquetsService.updateVenue(user.hotelId, parseInt(params.id), body);
        return createResponse(updated, 'Venue updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.BANQUETS.UPDATE,
        body: t.Partial(t.Object({
            name: t.String(),
            capacity: t.Number(),
            area: t.String(),
            amenities: t.Array(t.String()),
            baseRateHalf: t.Number(),
            baseRateFull: t.Number(),
            imageUrls: t.Array(t.String()),
            isActive: t.Boolean()
        })),
        detail: { summary: 'Update banquet venue', tags: ['Events'] }
    })
    /**
     * Create banquet booking
     */
    .post('/bookings', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const booking = await BanquetsService.createBooking(user.hotelId, user.id, body);
        return createResponse(booking, 'Booking created successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.BANQUETS.CREATE,
        body: t.Object({
            banquetId: t.Number(),
            eventName: t.String(),
            eventType: t.Optional(t.Union([
                t.Literal('WEDDING'),
                t.Literal('CONFERENCE'),
                t.Literal('BIRTHDAY'),
                t.Literal('CORPORATE'),
                t.Literal('OTHER')
            ])),
            organizerName: t.Optional(t.String()),
            organizerPhone: t.Optional(t.String()),
            organizerEmail: t.Optional(t.String()),
            contactName: t.Optional(t.String()),
            contactPhone: t.Optional(t.String()),
            guestId: t.Optional(t.String()),
            eventDate: t.String(),
            endDate: t.Optional(t.String()),
            startTime: t.String(),
            endTime: t.String(),
            expectedGuests: t.Number(),
            setupType: t.Optional(t.Union([
                t.Literal('THEATER'),
                t.Literal('CLASSROOM'),
                t.Literal('U_SHAPE'),
                t.Literal('BANQUET'),
                t.Literal('COCKTAIL')
            ])),
            cateringRequired: t.Optional(t.Boolean()),
            cateringPackage: t.Optional(t.String()),
            cateringPax: t.Optional(t.Number()),
            decorationRequired: t.Optional(t.Boolean()),
            decorationNotes: t.Optional(t.String()),
            avEquipment: t.Optional(t.Array(t.String())),
            specialRequirements: t.Optional(t.String()),
            totalAmount: t.Optional(t.Number()),
            advanceAmount: t.Optional(t.Number())
        }),
        detail: { summary: 'Create banquet booking', tags: ['Events'] }
    })
    /**
     * Get all bookings
     */
    .get('/bookings', async ({ user, query }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const bookingsList = await BanquetsService.getAllBookings(user.hotelId, query.upcoming === 'true');
        return createResponse(bookingsList, 'Bookings fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.BANQUETS.VIEW,
        query: t.Object({
            upcoming: t.Optional(t.String())
        }),
        detail: { summary: 'Get banquet bookings', tags: ['Events'] }
    })
    /**
     * Get booking by ID
     */
    .get('/bookings/:id', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const booking = await BanquetsService.getBookingById(user.hotelId, params.id);
        return createResponse(booking, 'Booking checked successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.BANQUETS.VIEW,
        detail: { summary: 'Get banquet booking details', tags: ['Events'] }
    })
    /**
     * Update booking status
     */
    .patch('/bookings/:id/status', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updated = await BanquetsService.updateBooking(user.hotelId, user.id, params.id, body);
        return createResponse(updated, 'Booking status updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.BANQUETS.UPDATE,
        body: t.Object({
            status: t.Union([
                t.Literal('PENDING'),
                t.Literal('CONFIRMED'),
                t.Literal('COMPLETED'),
                t.Literal('CANCELLED')
            ])
        }),
        detail: { summary: 'Update banquet booking status', tags: ['Events'] }
    })
    /**
     * Generate invoice for a banquet booking
     */
    .post('/bookings/:id/invoice', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updated = await BanquetsService.generateBookingInvoice(user.hotelId, user.id, params.id);
        return createResponse(updated, 'Event invoice generated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.GENERATE_INVOICE,
        detail: { summary: 'Generate invoice for banquet booking', tags: ['Events'] }
    })
    /**
     * Update booking details
     */
    .patch('/bookings/:id', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updated = await BanquetsService.updateBooking(user.hotelId, user.id, params.id, body);
        return createResponse(updated, 'Booking details updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.BANQUETS.UPDATE,
        body: t.Partial(t.Object({
            eventName: t.String(),
            eventDate: t.String(),
            endDate: t.String(),
            startTime: t.String(),
            endTime: t.String(),
            expectedGuests: t.Number(),
            setupType: t.String(),
            cateringRequired: t.Boolean(),
            cateringPackage: t.String(),
            cateringPax: t.Number(),
            decorationRequired: t.Boolean(),
            decorationNotes: t.String(),
            avEquipment: t.Array(t.String()),
            specialRequirements: t.String(),
            totalAmount: t.Number(),
            advanceAmount: t.Number(),
            guestId: t.String(),
            invoiceId: t.String()
        })),
        detail: { summary: 'Update banquet booking', tags: ['Events'] }
    })
    /**
     * Check venue availability
     */
    .delete('/venues/:id', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        await BanquetsService.deleteVenue(user.hotelId, parseInt(params.id));
        return createResponse(null, 'Venue deleted successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.BANQUETS.DELETE,
        detail: { summary: 'Delete banquet venue', tags: ['Events'] }
    })
    .delete('/bookings/:id', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        await BanquetsService.deleteBooking(user.hotelId, user.id, params.id);
        return createResponse(null, 'Booking deleted successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.BANQUETS.DELETE,
        detail: { summary: 'Delete banquet booking', tags: ['Events'] }
    })
    .get('/venues/:id/availability', async ({ params, query, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const availability = await BanquetsService.checkAvailability(
            user.hotelId,
            parseInt(params.id),
            query.date,
            query.startTime,
            query.endTime
        );
        return createResponse(availability, 'Availability checked successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.BANQUETS.VIEW,
        query: t.Object({
            date: t.String(),
            startTime: t.String(),
            endTime: t.String()
        }),
        detail: { summary: 'Check venue availability', tags: ['Events'] }
    });
