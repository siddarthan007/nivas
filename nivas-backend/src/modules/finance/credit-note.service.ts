import { db } from '../../db';
import { invoices, creditNotes } from '../../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { NotFoundError, BusinessLogicError, ValidationError } from '../../utils/errors';
import { InvoiceService } from './invoice.service';
import { CbmsService } from './cbms.service';
import { logAction } from '../system/audit.service';
import { GLService } from './gl.service';

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
        if (!data.reason?.trim()) throw new ValidationError('A reason is required for a credit note');

        const result = await db.transaction(async (tx) => {
            // Serialize against other credit notes / invoices for this hotel.
            await tx.execute(sql`SELECT pg_advisory_xact_lock(${hotelId})`);

            // Credit notes have their OWN sequence — they must NOT consume an
            // invoice sequence number (that caused the next invoice to collide).
            const { fiscalYear } = await InvoiceService.getNextInvoiceNumber(hotelId, tx);
            const lastCn = await tx.query.creditNotes.findFirst({
                where: and(eq(creditNotes.hotelId, hotelId), eq(creditNotes.fiscalYear, fiscalYear)),
                orderBy: [desc(creditNotes.sequenceNumber)],
            });
            const cnSeq = (lastCn?.sequenceNumber ?? 0) + 1;
            const cnNumber = `CN-${fiscalYear.replace('/', '')}-${String(cnSeq).padStart(4, '0')}`;

            const [cn] = await tx.insert(creditNotes).values({
                hotelId,
                originalInvoiceId: data.invoiceId,
                creditNoteNumber: cnNumber,
                fiscalYear,
                sequenceNumber: cnSeq,
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

            // Post GL reversal: reverse the original invoice entry
            const arAccount = await GLService.getOrCreateControlAccount(hotelId, '1100', 'Accounts Receivable', 'ASSET', tx);
            const roomRevAccount = await GLService.getOrCreateControlAccount(hotelId, '4000', 'Room Revenue', 'REVENUE', tx);
            const fbRevAccount = await GLService.getOrCreateControlAccount(hotelId, '4100', 'F&B Revenue', 'REVENUE', tx);
            const taxAccount = await GLService.getOrCreateControlAccount(hotelId, '2100', 'Sales Tax Payable', 'LIABILITY', tx);
            const discountAccount = await GLService.getOrCreateControlAccount(hotelId, '4900', 'Sales Discounts', 'EXPENSE', tx);

            const grandTotal = parseFloat(invoice.grandTotal);
            const roomRev = parseFloat(invoice.roomRevenue || '0');
            const fbRev = parseFloat(invoice.fbRevenue || '0');
            const vatAmount = parseFloat(invoice.vatAmount || '0');
            const discountAmount = parseFloat(invoice.discountAmount || '0');

            const reversalLines: { accountId: number; debit: number; credit: number; description: string }[] = [];
            // Credit AR (reverse original debit)
            reversalLines.push({ accountId: arAccount!.id, debit: 0, credit: grandTotal, description: `CN reversal - AR` });
            // If discount was applied, Credit Discount Account (reverse original debit)
            if (discountAmount > 0) {
                reversalLines.push({ accountId: discountAccount!.id, debit: 0, credit: discountAmount, description: `CN reversal - Discount` });
            }
            // Debit Room Revenue (reverse original credit)
            if (roomRev > 0) {
                reversalLines.push({ accountId: roomRevAccount!.id, debit: roomRev, credit: 0, description: `CN reversal - Room Revenue` });
            }
            // Debit F&B Revenue (reverse original credit)
            if (fbRev > 0) {
                reversalLines.push({ accountId: fbRevAccount!.id, debit: fbRev, credit: 0, description: `CN reversal - F&B Revenue` });
            }
            // Debit Tax (reverse original credit)
            if (vatAmount > 0) {
                reversalLines.push({ accountId: taxAccount!.id, debit: vatAmount, credit: 0, description: `CN reversal - VAT` });
            }

            await GLService.postJournalEntry(
                hotelId,
                userId,
                new Date().toISOString().split('T')[0] as string,
                `Credit Note ${cnNumber} - Void ${invoice.invoiceNumber}`,
                cnNumber,
                reversalLines,
                tx
            );

            return cn;
        });

        if (!result) throw new BusinessLogicError('Failed to create credit note');

        await logAction(
            hotelId, userId,
            'CREATE_CREDIT_NOTE', 'CREDIT_NOTE', result.id,
            { cnNumber: result.creditNoteNumber, invoiceId: data.invoiceId, reason: data.reason },
            ipAddress
        );

        // Sync the return/credit note to IRD CBMS (no-op unless CBMS enabled).
        CbmsService.enqueue(hotelId, 'RETURN', result.id, result.creditNoteNumber).catch(() => { /* non-fatal */ });

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
