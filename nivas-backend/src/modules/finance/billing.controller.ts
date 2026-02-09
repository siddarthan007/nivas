import { Elysia, t } from 'elysia';
import { db } from '../../db';
import { bookings, orders, payments, hotels } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { BillingService } from './billing.service';

export const billingController = new Elysia({ prefix: '/billing' })
    .use(authMiddleware)
    .get('/room/:roomId/summary', async ({ params, user }) => {
        const { bookingId, ...summary } = await BillingService.calculateRoomBillingSummary(
            user!.hotelId!,
            parseInt(params.roomId)
        );

        const currentBooking = await db.query.bookings.findFirst({
            where: eq(bookings.id, bookingId)
        });

        // Get orders for display details (calc is done in service)
        const roomOrders = await db.query.orders.findMany({
            where: and(
                eq(orders.roomId, parseInt(params.roomId)),
                eq(orders.hotelId, user!.hotelId!),
                eq(orders.status, 'SERVED')
            ),
            with: {
                items: {
                    with: { menuItem: true }
                }
            }
        });

        const roomPayments = await db.query.payments.findMany({
            where: and(
                eq(payments.bookingId, bookingId),
                eq(payments.hotelId, user!.hotelId!)
            )
        });

        return {
            status: 'success',
            data: {
                booking: {
                    id: currentBooking!.id,
                    checkIn: currentBooking!.checkIn,
                    rate: currentBooking!.totalAmount
                },
                orders: roomOrders.map(o => ({
                    orderNumber: o.orderNumber,
                    amount: o.totalAmount,
                    items: o.items.length
                })),
                payments: roomPayments,
                financials: summary
            }
        };
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.GENERATE_INVOICE,
        detail: {
            summary: 'Get room billing summary',
            tags: ['Finance']
        }
    })
    .get('/guest/my-bill', async ({ user }) => {
        if (user!.type !== 'GUEST' || !user!.roomId) {
            throw new Error('Access denied');
        }

        const summary = await BillingService.calculateRoomBillingSummary(
            user!.hotelId!,
            user!.roomId
        );

        return {
            status: 'success',
            data: summary
        };
    }, {
        isSignedIn: true,
        detail: {
            summary: 'Guest view own bill',
            tags: ['Finance']
        }
    });