import { db } from '../../db';
import { invoices, creditNotes } from '../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { NotFoundError, BusinessLogicError } from '../../utils/errors';
import { InvoiceService } from './invoice.service';
import { CbmsService } from './cbms.service';
import { logAction } from '../system/audit.service';

export const CreditNoteService = {
    async create(hotelId: number, userId: string, data: { invoiceId: string; reason: string }, ipAddress?: string) {
        const invoice = await db.query.invoices.findFirst({
            where: and(
                eq(invoices.id, data.invoiceId),
                eq(invoices.hotelId, hotelId)
            )
        });

        if (!invoice) throw new NotFoundError('Invoice');
        if (invoice.isVoided) throw new BusinessLogicError('Invoice is already voided');

        const { number, sequence, fiscalYear } = await InvoiceService.getNextInvoiceNumber(hotelId);
        const cnNumber = number.replace('INV', 'CN');

        const result = await db.transaction(async (tx) => {
            const [cn] = await tx.insert(creditNotes).values({
                hotelId,
                originalInvoiceId: data.invoiceId,
                creditNoteNumber: cnNumber,
                fiscalYear,
                sequenceNumber: sequence,
                reason: data.reason,
                amount: invoice.grandTotal,
                createdById: userId
            }).returning();

            await tx.update(invoices)
                .set({
                    isVoided: true,
                    voidReason: data.reason,
                    voidedAt: new Date()
                })
                .where(eq(invoices.id, data.invoiceId));

            return cn;
        });

        if (!result) throw new BusinessLogicError('Failed to create credit note');

        CbmsService.syncCreditNote(result.id, hotelId).catch(console.error);

        await logAction(
            hotelId, userId,
            'CREATE_CREDIT_NOTE', 'CREDIT_NOTE', result.id,
            { cnNumber, invoiceId: data.invoiceId, reason: data.reason },
            ipAddress
        );

        return result;
    },

    async list(hotelId: number, limit: number = 50) {
        return db.query.creditNotes.findMany({
            where: eq(creditNotes.hotelId, hotelId),
            with: {
                originalInvoice: { columns: { invoiceNumber: true, guestName: true } },
                createdBy: { columns: { fullName: true } }
            },
            orderBy: [desc(creditNotes.createdAt)],
            limit
        });
    }
};
