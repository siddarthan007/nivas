import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { FinanceService } from './finance.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

export const paymentsController = new Elysia({ prefix: '/finance' })
    .use(authMiddleware)
    .post('/payments', async ({ body, user, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');

        const newPayment = await FinanceService.recordPayment(
            user.hotelId,
            user.id,
            body,
            request.headers.get('x-forwarded-for') || undefined
        );

        return createResponse(newPayment, 'Payment recorded successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.RECORD_PAYMENT,
        body: t.Object({
            bookingId: t.Optional(t.String()),
            orderId: t.Optional(t.String()),
            amount: t.Number(),
            paymentMethod: t.Union([
                t.Literal('CASH'),
                t.Literal('CARD'),
                t.Literal('ESEWA'),
                t.Literal('KHALTI'),
                t.Literal('CONNECT_IPS'),
                t.Literal('UPI'),
                t.Literal('BANK_TRANSFER'),
                t.Literal('OTHER')
            ]),
            transactionId: t.Optional(t.String()),
            notes: t.Optional(t.String())
        }),
        detail: {
            summary: 'Record a manual payment',
            tags: ['Finance']
        }
    })
    .get('/payments', async ({ user, query }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const limit = query.limit ? parseInt(query.limit) : 50;
        const paymentsList = await FinanceService.getPayments(user.hotelId, limit);
        return createResponse(paymentsList, 'Payment history fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.VIEW_RECORDS,
        query: t.Object({
            limit: t.Optional(t.String())
        }),
        detail: {
            summary: 'View payment history',
            tags: ['Finance']
        }
    })
    .get('/payments/:id', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const payment = await FinanceService.getPaymentById(user.hotelId, params.id);
        return createResponse(payment, 'Payment fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.VIEW_RECORDS,
        detail: {
            summary: 'Get a single payment',
            tags: ['Finance']
        }
    })
    .post('/payments/:id/void', async ({ params, body, user, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const ipAddress = request.headers.get('x-forwarded-for') || undefined;
        const voided = await FinanceService.voidPayment(user.hotelId, user.id, params.id, body.reason, ipAddress);
        return createResponse(voided, 'Payment voided successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.VOID_INVOICE,
        body: t.Object({
            reason: t.Optional(t.String())
        }),
        detail: {
            summary: 'Void a payment',
            tags: ['Finance']
        }
    });