import { Elysia, t } from 'elysia';
import { db } from '../../db';
import { invoices } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { InvoiceService } from './invoice.service';
import { CbmsService } from './cbms.service';
import { logAction } from '../system/audit.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

export const invoicesController = new Elysia({ prefix: '/invoices' })
    .use(authMiddleware)
    /**
     * Generate a new invoice for a booking
     * Calculates totals using centralized BillingService
     */
    .post('/generate', async ({ body, user, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');

        const { invoice, grandTotal } = await InvoiceService.generateInvoice(user.hotelId, user.id, body);

        // Sync to CBMS (Real-time IRD compliance)
        const cbmsResult = await CbmsService.syncInvoice(invoice.id, user.hotelId);

        // Audit log
        await logAction(
            user.hotelId,
            user.id,
            'GENERATE_INVOICE',
            'INVOICE',
            invoice.id,
            {
                invoiceNumber: invoice.invoiceNumber,
                grandTotal: grandTotal,
                cbmsStatus: cbmsResult.status
            },
            request.headers.get('x-forwarded-for') || undefined
        );

        return createResponse({
            ...invoice,
            cbms: cbmsResult
        }, `Invoice ${invoice.invoiceNumber} generated successfully.`);
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.GENERATE_INVOICE,
        body: t.Object({
            bookingId: t.String(),
            discount: t.Optional(t.Number()),
            guestPan: t.Optional(t.String()),
            doCheckout: t.Optional(t.Boolean())
        }),
        detail: { summary: 'Generate Final Invoice', tags: ['Finance'] }
    })
    /**
     * Get invoice data for display/PDF generation
     */
    .get('/:id', async ({ params }) => {
        const data = await InvoiceService.getInvoiceData(params.id);
        return { status: 'success', data };
    }, {
        isSignedIn: true,
        detail: { summary: 'Get Invoice Data', tags: ['Finance'] }
    })
    /**
     * Download Invoice PDF
     */
    .get('/:id/pdf', async ({ params, set }) => {
        const pdfBuffer = await InvoiceService.generatePdf(params.id);
        set.headers = {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="invoice-${params.id}.pdf"`
        };
        return pdfBuffer;
    }, {
        isSignedIn: true,
        detail: { summary: 'Download Invoice PDF', tags: ['Finance'] }
    })
    /**
     * Manual retry for CBMS sync
     */
    .post('/:id/sync-cbms', async ({ params, user }) => {
        const result = await CbmsService.syncInvoice(params.id, user!.hotelId!);
        return { status: result.status === 'success' ? 'success' : 'error', data: result };
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.GENERATE_INVOICE,
        detail: { summary: 'Retry CBMS Sync', tags: ['Finance'] }
    })
    /**
     * List invoices for the hotel
     */
    .get('/', async ({ user, query }) => {
        const limit = parseInt(query.limit ?? '50');
        const invoicesList = await db.query.invoices.findMany({
            where: eq(invoices.hotelId, user!.hotelId!),
            orderBy: [desc(invoices.createdAt)],
            limit,
            with: {
                booking: { columns: { guestName: true } }
            }
        });

        return { status: 'success', data: invoicesList };
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.VIEW_RECORDS,
        query: t.Object({
            limit: t.Optional(t.String())
        }),
        detail: { summary: 'List Invoices', tags: ['Finance'] }
    });