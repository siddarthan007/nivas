import { Elysia, t } from 'elysia';
import { s } from '../../lib/schema';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { GuestActionsService } from './guest-actions.service';
import { ReviewsService } from '../reviews/reviews.service';
import { AiConciergeService } from './ai-concierge.service';
import { createResponse } from '../../utils/response.helper';
import { db } from '../../db';
import { bookings, rooms } from '../../db/schema';
import { eq, and } from 'drizzle-orm';

export const guestActionsController = new Elysia({ prefix: '/guest/actions' })
    .use(authMiddleware)
    .onBeforeHandle(({ user, set }) => {
        if (!user) {
            set.status = 401;
            return { status: 'error', message: 'Unauthorized: Please login first.' };
        }
    })
    .get('/session', async ({ user }) => {
        const { hotelId, roomId } = await GuestActionsService.validateGuestAccess(user);
        const booking = await db.query.bookings.findFirst({
            where: and(
                eq(bookings.roomId, roomId),
                eq(bookings.hotelId, hotelId),
                eq(bookings.status, 'CHECKED_IN'),
            ),
            columns: { id: true, guestName: true, checkIn: true, checkOut: true },
        });
        const room = await db.query.rooms.findFirst({
            where: and(eq(rooms.id, roomId), eq(rooms.hotelId, hotelId)),
            columns: { number: true },
        });
        return createResponse({
            roomNumber: room?.number,
            guestName: booking?.guestName ?? 'Guest',
            checkInDate: booking?.checkIn?.toISOString() ?? null,
            checkOutDate: booking?.checkOut?.toISOString() ?? null,
            bookingId: booking?.id ?? null,
        }, 'Guest session active');
    }, {
        isSignedIn: true,
        detail: { summary: 'Validate guest portal session', tags: ['Guest Portal'] }
    })
    .patch('/dnd', async ({ body, user }) => {
        const { hotelId, roomId } = await GuestActionsService.validateGuestAccess(user);
        await GuestActionsService.toggleDnd(hotelId, roomId, body.enabled);
        return createResponse(null, `DND turned ${body.enabled ? 'ON' : 'OFF'}`);
    }, {
        isSignedIn: true,
        body: t.Object({ enabled: t.Boolean() }),
        detail: { summary: 'Toggle Do Not Disturb', tags: ['Guest Portal'] }
    })
    .post('/request-checkout', async ({ user }) => {
        const { hotelId, roomId } = await GuestActionsService.validateGuestAccess(user);
        await GuestActionsService.requestCheckout(hotelId, roomId);
        return createResponse(null, 'Checkout requested. Front desk has been notified.');
    }, {
        isSignedIn: true,
        detail: { summary: 'Request checkout', tags: ['Guest Portal'] }
    })
    .get('/menu', async ({ user }) => {
        const { hotelId } = await GuestActionsService.validateGuestAccess(user);
        const menu = await GuestActionsService.getMenu(hotelId);
        return createResponse(menu, 'Menu fetched successfully');
    }, {
        isSignedIn: true,
        detail: { summary: 'Get room service menu', tags: ['Guest Portal'] }
    })
    .post('/order', async ({ body, user }) => {
        const { hotelId, roomId, userId } = await GuestActionsService.validateGuestAccess(user);
        const result = await GuestActionsService.placeOrder(hotelId, roomId, userId, body.items, body.deliveryTo, body.notes);
        return createResponse(result, 'Order placed! Kitchen has been notified.');
    }, {
        isSignedIn: true,
        body: t.Object({
            items: t.Array(t.Object({
                menuItemId: t.Number(),
                quantity: t.Number({ minimum: 1, maximum: 99 }),
                notes: t.Optional(s.string({ maxLength: 500 }))
            }), { minItems: 1, maxItems: 50 }),
            deliveryTo: t.Optional(t.Union([t.Literal('ROOM'), t.Literal('RESTAURANT')])),
            notes: t.Optional(s.string({ maxLength: 500 })),
        }),
        detail: { summary: 'Place room service order', tags: ['Guest Portal'] }
    })
    .get('/orders', async ({ user }) => {
        const { hotelId, roomId } = await GuestActionsService.validateGuestAccess(user);
        const orders = await GuestActionsService.getOrderHistory(hotelId, roomId);
        return createResponse(orders, 'Order history fetched successfully');
    }, {
        isSignedIn: true,
        detail: { summary: 'View order history', tags: ['Guest Portal'] }
    })
    .get('/activity', async ({ user }) => {
        const { hotelId, roomId } = await GuestActionsService.validateGuestAccess(user);
        const activity = await GuestActionsService.getActivity(hotelId, roomId);
        return createResponse(activity, 'Activity fetched successfully');
    }, {
        isSignedIn: true,
        detail: { summary: 'Unified activity feed (orders + service requests)', tags: ['Guest Portal'] }
    })
    .get('/portal-config', async ({ user }) => {
        const { hotelId, roomId } = await GuestActionsService.validateGuestAccess(user);
        const config = await GuestActionsService.getPortalConfig(hotelId, roomId);
        return createResponse(config, 'Portal config fetched');
    }, {
        isSignedIn: true,
        detail: { summary: 'Guest portal dynamic content (WiFi, contacts, welcome)', tags: ['Guest Portal'] }
    })
    .post('/request-housekeeping', async ({ body, user }) => {
        const { hotelId, roomId } = await GuestActionsService.validateGuestAccess(user);
        await GuestActionsService.requestHousekeeping(hotelId, roomId, body.taskType, body.notes);
        return createResponse(null, 'Housekeeping has been notified.');
    }, {
        isSignedIn: true,
        body: t.Object({
            taskType: t.Optional(t.Union([
                t.Literal('CLEANING'),
                t.Literal('TOWELS'),
                t.Literal('AMENITIES'),
                t.Literal('MAINTENANCE')
            ])),
            notes: t.Optional(t.String())
        }),
        detail: { summary: 'Request housekeeping service', tags: ['Guest Portal'] }
    })
    .post('/feedback', async ({ body, user }) => {
        const { hotelId, roomId } = await GuestActionsService.validateGuestAccess(user);
        const activeBooking = await db.query.bookings.findFirst({
            where: and(
                eq(bookings.roomId, roomId),
                eq(bookings.hotelId, hotelId),
                eq(bookings.status, 'CHECKED_IN')
            ),
        });
        const review = await ReviewsService.create(hotelId, {
            guestName: activeBooking?.guestName ?? 'Guest',
            bookingId: activeBooking?.id,
            rating: body.rating,
            comment: body.comment,
            source: 'INTERNAL',
        });
        return createResponse(review, 'Thank you for your feedback!');
    }, {
        isSignedIn: true,
        body: t.Object({
            rating: t.Number({ minimum: 1, maximum: 5 }),
            comment: t.Optional(s.string({ maxLength: 2000 })),
        }),
        detail: { summary: 'Submit guest review/feedback', tags: ['Guest Portal'] }
    })
    .post('/concierge', async ({ body, user }) => {
        const { hotelId } = await GuestActionsService.validateGuestAccess(user);
        const result = await AiConciergeService.chat(hotelId, body.message, body.history || []);
        return createResponse(result, 'Concierge reply');
    }, {
        isSignedIn: true,
        body: t.Object({
            message: s.string({ minLength: 1, maxLength: 500 }),
            history: t.Optional(t.Array(t.Object({ role: t.String(), content: t.String() }), { maxItems: 8 })),
        }),
        detail: { summary: 'AI concierge chat (menu/FAQ/requests, Nepali+English)', tags: ['Guest Portal'] }
    });
