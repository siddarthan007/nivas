import { Elysia, t } from 'elysia';
import { db } from '../../db';
import { bookings, orders, payments } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { BillingService } from './billing.service';
import { createResponse } from '../../utils/response.helper';
import { ForbiddenError, UnauthorizedError, ValidationError } from '../../utils/errors';

export const billingController = new Elysia({ prefix: '/billing' })
    .use(authMiddleware)
    .get('/room/:roomId/summary', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');

        const { bookingId, ...summary } = await BillingService.calculateRoomBillingSummary(
            user.hotelId,
            parseInt(params.roomId)
        );

        const currentBooking = await db.query.bookings.findFirst({
            where: and(
                eq(bookings.id, bookingId),
                eq(bookings.hotelId, user.hotelId)
            )
        });

        const roomOrders = await db.query.orders.findMany({
            where: and(
                eq(orders.roomId, parseInt(params.roomId)),
                eq(orders.hotelId, user.hotelId),
                eq(orders.status, 'SERVED')
            ),
            with: { items: { with: { menuItem: true } } }
        });

        const roomPayments = await db.query.payments.findMany({
            where: and(
                eq(payments.bookingId, bookingId),
                eq(payments.hotelId, user.hotelId)
            )
        });

        return createResponse({
            booking: currentBooking ? {
                id: currentBooking.id,
                checkIn: currentBooking.checkIn,
                rate: currentBooking.totalAmount
            } : null,
            orders: roomOrders.map(o => ({
                orderNumber: o.orderNumber,
                amount: o.totalAmount,
                items: o.items.length
            })),
            payments: roomPayments,
            financials: summary
        }, 'Room billing summary fetched');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.GENERATE_INVOICE,
        params: t.Object({ roomId: t.String() }),
        detail: { summary: 'Get room billing summary', tags: ['Finance'] }
    })
    .get('/guest/my-bill', async ({ user }) => {
        if (!user) throw new UnauthorizedError('Please login first');
        const isGuest = user.type === 'GUEST' || user.id.startsWith('guest-');
        if (!isGuest || !user.roomId) {
            throw new ForbiddenError('Guest access required');
        }

        const bill = await BillingService.getGuestBill(
            user.hotelId!,
            user.roomId
        );

        return createResponse(bill, 'Guest bill fetched');
    }, {
        isSignedIn: true,
        detail: { summary: 'Guest view own bill', tags: ['Finance'] }
    });