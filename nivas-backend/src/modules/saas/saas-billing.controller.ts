import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { BusinessLogicError, UnauthorizedError } from '../../utils/errors';
import { SaasBillingService } from './saas-billing.service';
import { createResponse } from '../../utils/response.helper';

export const saasBillingController = new Elysia({ prefix: '/saas-billing' })
    .use(authMiddleware)
    .get('/packages', async () => {
        const packages = await SaasBillingService.getPackages();
        return createResponse(packages, 'Packages fetched successfully');
    }, {
        detail: { summary: 'List subscription packages', tags: ['SaaS'] }
    })
    .get('/stats', async () => {
        const stats = await SaasBillingService.getBillingStats();
        return createResponse(stats, 'Billing stats fetched');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.VIEW_SAAS_ANALYTICS,
        detail: { summary: 'Get billing stats', tags: ['SaaS'] }
    })
    .get('/my-subscription', async ({ user }) => {
        if (!user?.hotelId) {
            throw new BusinessLogicError('No hotel context');
        }

        const data = await SaasBillingService.getMySubscription(user.hotelId);
        return createResponse(data, 'Subscription fetched successfully');
    }, {
        isSignedIn: true,
        detail: { summary: 'Get current tenant subscription', tags: ['SaaS'] }
    })
    .post('/subscribe', async ({ body, user, request }) => {
        const ip = request.headers.get('x-forwarded-for') || undefined;
        if (!user?.hotelId) throw new BusinessLogicError('No hotel context');

        const result = await SaasBillingService.subscribe(
            user.hotelId,
            user.id,
            body.packageId,
            body.billingCycle,
            ip
        );

        return createResponse(result, 'Subscription request processed');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.MANAGE_SUBSCRIPTIONS,
        body: t.Object({
            packageId: t.Number(),
            billingCycle: t.Union([
                t.Literal('MONTHLY'),
                t.Literal('ANNUAL'),
                t.Literal('2_YEAR'),
                t.Literal('3_YEAR')
            ])
        }),
        detail: { summary: 'Subscribe to a plan', tags: ['SaaS'] }
    })
    .post('/record-payment', async ({ body, user, request }) => {
        const ip = request.headers.get('x-forwarded-for') || undefined;
        const result = await SaasBillingService.recordPayment(body.hotelId, user!.id, body, ip);

        return createResponse(
            result.payment,
            `Payment of ${body.amount} ${body.currency ?? 'USD'} recorded. License active until ${result.periodEnd.toISOString().split('T')[0]}`
        );
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.RECORD_PAYMENTS,
        body: t.Object({
            hotelId: t.Number(),
            amount: t.Number(),
            currency: t.Optional(t.String()),
            paymentMethod: t.Optional(t.String()),
            transactionId: t.Optional(t.String()),
            invoiceNumber: t.Optional(t.String()),
            packageId: t.Optional(t.Number()),
            billingCycle: t.Optional(t.Union([t.Literal('MONTHLY'), t.Literal('ANNUAL')]))
        }),
        detail: { summary: 'Record subscription payment', tags: ['SaaS'] }
    })
    .get('/tenants/:hotelId/payments', async ({ params, query }) => {
        const payments = await SaasBillingService.getTenantPayments(
            parseInt(params.hotelId, 10),
            parseInt(query.limit || '20', 10),
            parseInt(query.offset || '0', 10)
        );
        return createResponse(payments, 'Tenant payments fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.VIEW_PAYMENTS,
        params: t.Object({ hotelId: t.String() }),
        query: t.Object({
            limit: t.Optional(t.String()),
            offset: t.Optional(t.String())
        }),
        detail: { summary: 'List tenant payments', tags: ['SaaS'] }
    })
    .get('/payments/:paymentId', async ({ params }) => {
        const payment = await SaasBillingService.getPayment(params.paymentId);
        return createResponse(payment, 'Payment detail fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.VIEW_PAYMENTS,
        params: t.Object({ paymentId: t.String() }),
        detail: { summary: 'Get payment details', tags: ['SaaS'] }
    })
    .get('/payments', async ({ query }) => {
        const payments = await SaasBillingService.getAllPayments(
            parseInt(query.limit || '50', 10),
            parseInt(query.offset || '0', 10)
        );
        return createResponse(payments, 'All payments fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.VIEW_PAYMENTS,
        query: t.Object({
            limit: t.Optional(t.String()),
            offset: t.Optional(t.String())
        }),
        detail: { summary: 'List all payments', tags: ['SaaS'] }
    })
    .get('/payments/:paymentId/pdf', async ({ params, set, user }) => {
        if (!user) {
            throw new UnauthorizedError('Unauthorized');
        }

        const payment = await SaasBillingService.getPayment(params.paymentId);
        if (user.type !== 'SUPER_ADMIN' && payment.hotel?.id !== user.hotelId) {
            throw new UnauthorizedError('You do not have access to this invoice');
        }

        const pdfBuffer = await SaasBillingService.generateInvoicePdf(params.paymentId);
        set.headers = {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="invoice-${params.paymentId}.pdf"`
        };
        return pdfBuffer;
    }, {
        isSignedIn: true,
        params: t.Object({ paymentId: t.String() }),
        detail: { summary: 'Download invoice PDF', tags: ['SaaS'] }
    });