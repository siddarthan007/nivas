import { Elysia, t } from 'elysia';
import { db } from '../../db';
import { invoices } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { InvoiceService } from './invoice.service';
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

        await logAction(
            user.hotelId,
            user.id,
            'GENERATE_INVOICE',
            'INVOICE',
            invoice.id,
            {
                invoiceNumber: invoice.invoiceNumber,
                grandTotal: grandTotal,
            },
            request.headers.get('x-forwarded-for') || undefined
        );

        return createResponse(invoice, `Invoice ${invoice.invoiceNumber} generated successfully.`);
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
    .get('/:id', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const data = await InvoiceService.getInvoiceData(params.id, user.hotelId);
        return createResponse(data, 'Invoice data fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.VIEW_INVOICES,
        detail: { summary: 'Get Invoice Data', tags: ['Finance'] }
    })
    /**
     * Download Invoice PDF
     */
    .get('/:id/pdf', async ({ params, set, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const pdfBuffer = await InvoiceService.generatePdf(params.id, user.hotelId);
        set.headers = {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="invoice-${params.id}.pdf"`
        };
        return pdfBuffer;
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.VIEW_INVOICES,
        detail: { summary: 'Download Invoice PDF', tags: ['Finance'] }
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
                booking: { columns: { guestName: true, guestPhone: true, guestEmail: true, checkIn: true, checkOut: true } }
            }
        });

        return createResponse(invoicesList, 'Invoices fetched');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.VIEW_RECORDS,
        query: t.Object({
            limit: t.Optional(t.String())
        }),
        detail: { summary: 'List Invoices', tags: ['Finance'] }
    });