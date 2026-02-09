import { Elysia, t } from 'elysia';
import { db } from '../../db';
import { invoices, creditNotes, hotels } from '../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { CbmsService } from './cbms.service';
import { InvoiceService } from './invoice.service';
import { logAction } from '../system/audit.service';

export const creditNotesController = new Elysia({ prefix: '/credit-notes' })
    .use(authMiddleware)
    .post('/', async ({ body, user, request }) => {
        const invoice = await db.query.invoices.findFirst({
            where: and(
                eq(invoices.id, body.invoiceId),
                eq(invoices.hotelId, user!.hotelId!)
            )
        });

        if (!invoice) throw new Error('Invoice not found');
        if (invoice.isVoided) throw new Error('Invoice is already voided');

        const { number, sequence, fiscalYear } = await InvoiceService.getNextInvoiceNumber(user!.hotelId!);
        const cnNumber = number.replace('INV', 'CN');

        const result = await db.transaction(async (tx) => {
            const [cn] = await tx.insert(creditNotes).values({
                hotelId: user!.hotelId!,
                originalInvoiceId: body.invoiceId,
                creditNoteNumber: cnNumber,
                fiscalYear: fiscalYear,
                sequenceNumber: sequence,
                reason: body.reason,
                amount: invoice.grandTotal,
                createdById: user!.id
            }).returning();

            await tx.update(invoices)
                .set({
                    isVoided: true,
                    voidReason: body.reason,
                    voidedAt: new Date()
                })
                .where(eq(invoices.id, body.invoiceId));

            return cn;
        });

        CbmsService.syncCreditNote(result!.id, user!.hotelId!);

        await logAction(
            user!.hotelId!,
            user!.id,
            'CREATE_CREDIT_NOTE',
            'CREDIT_NOTE',
            result!.id,
            { cnNumber, invoiceId: body.invoiceId, reason: body.reason },
            request.headers.get('x-forwarded-for') || undefined
        );

        return {
            status: 'success',
            data: result,
            message: 'Credit note created and invoice voided.'
        };
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.CREATE_CREDIT_NOTE,
        body: t.Object({
            invoiceId: t.String(),
            reason: t.String()
        }),
        detail: { summary: 'Void invoice via Credit Note', tags: ['Finance'] }
    })
    .get('/', async ({ user, query }) => {
        const list = await db.query.creditNotes.findMany({
            where: eq(creditNotes.hotelId, user!.hotelId!),
            with: {
                originalInvoice: {
                    columns: { invoiceNumber: true, guestName: true }
                },
                createdBy: {
                    columns: { fullName: true }
                }
            },
            orderBy: [desc(creditNotes.createdAt)],
            limit: query.limit ? parseInt(query.limit) : 50
        });

        return { status: 'success', data: list };
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.VIEW_INVOICES,
        query: t.Object({
            limit: t.Optional(t.String())
        }),
        detail: { summary: 'List Credit Notes', tags: ['Finance'] }
    });