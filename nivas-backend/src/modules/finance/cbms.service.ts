import { db } from '../../db';
import { hotels, invoices, creditNotes } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import NepaliDate from 'nepali-date-converter';

const CBMS_BILL_URL = process.env.CBMS_BILL_URL || 'https://cbapi.ird.gov.np/api/bill';
const CBMS_RETURN_URL = process.env.CBMS_RETURN_URL || 'https://cbapi.ird.gov.np/api/billreturn';

export const CbmsService = {
    buildInvoicePayload(invoice: any, hotel: any) {
        const invoiceDate = invoice.createdAt ?? new Date();
        const nepaliDate = new NepaliDate(invoiceDate);

        return {
            username: hotel.cbmsUsername,
            password: hotel.cbmsPassword,
            seller_pan: hotel.panNumber,
            buyer_pan: invoice.guestPan || '',
            buyer_name: invoice.guestName,
            fiscal_year: invoice.fiscalYear,
            invoice_number: invoice.invoiceNumber,
            invoice_date: nepaliDate.format('YYYY-MM-DD'),
            total_sales: parseFloat(invoice.subTotal),
            taxable_sales_vat: parseFloat(invoice.subTotal) + parseFloat(invoice.serviceCharge ?? '0'),
            vat: parseFloat(invoice.vatAmount ?? '0'),
            excisable_amount: 0,
            excise: 0,
            taxable_sales_hst: 0,
            hst: 0,
            amount_for_esf: 0,
            esf: 0,
            export_sales: 0,
            tax_exempted_sales: 0,
            isrealtime: true,
            datetimeClient: new Date().toISOString()
        };
    },

    parseResponseCode(code: number): { success: boolean; message: string } {
        switch (code) {
            case 200: return { success: true, message: 'Synced successfully' };
            case 100: return { success: false, message: 'CBMS credentials do not match' };
            case 101: return { success: false, message: 'Bill already exists in CBMS' };
            case 102: return { success: false, message: 'Error saving bill - check field values' };
            case 103: return { success: false, message: 'Unknown error - check API model' };
            case 104: return { success: false, message: 'Invalid model - check required fields' };
            default: return { success: false, message: `Unknown response code: ${code}` };
        }
    },

    async syncInvoice(invoiceId: string, hotelId: number) {
        const hotel = await db.query.hotels.findFirst({
            where: eq(hotels.id, hotelId)
        });

        if (!hotel?.isCbmsEnabled) {
            return { status: 'skipped', message: 'CBMS not enabled for this hotel' };
        }

        if (!hotel.cbmsUsername || !hotel.cbmsPassword || !hotel.panNumber) {
            return { status: 'error', message: 'CBMS credentials or PAN not configured' };
        }

        const invoice = await db.query.invoices.findFirst({
            where: and(eq(invoices.id, invoiceId), eq(invoices.hotelId, hotelId))
        });

        if (!invoice) {
            return { status: 'error', message: 'Invoice not found' };
        }

        const payload = this.buildInvoicePayload(invoice, hotel);

        try {
            const response = await fetch(CBMS_BILL_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json() as { status?: number; message?: string };
            const parsed = this.parseResponseCode(result.status ?? 0);

            if (parsed.success) {
                await db.update(invoices)
                    .set({ syncedToCbms: true })
                    .where(eq(invoices.id, invoiceId));

                return { status: 'success', message: parsed.message };
            } else {
                console.error('[CBMS] Sync failed:', result);
                return { status: 'error', message: parsed.message, code: result.status };
            }
        } catch (error) {
            console.error('[CBMS] Network error:', error);
            return { status: 'error', message: 'Failed to connect to CBMS server' };
        }
    },

    async syncCreditNote(creditNoteId: string, hotelId: number) {
        const hotel = await db.query.hotels.findFirst({
            where: eq(hotels.id, hotelId)
        });

        if (!hotel?.isCbmsEnabled) {
            return { status: 'skipped', message: 'CBMS not enabled' };
        }

        const creditNote = await db.query.creditNotes.findFirst({
            where: and(eq(creditNotes.id, creditNoteId), eq(creditNotes.hotelId, hotelId)),
            with: { originalInvoice: true }
        });

        if (!creditNote) {
            return { status: 'error', message: 'Credit note not found' };
        }

        try {
            const payload = {
                username: hotel.cbmsUsername,
                password: hotel.cbmsPassword,
                seller_pan: hotel.panNumber,
                fiscal_year: creditNote.fiscalYear,
                credit_note_number: creditNote.creditNoteNumber,
                ref_invoice_number: creditNote.originalInvoice?.invoiceNumber,
                credit_note_date: new NepaliDate(creditNote.createdAt ?? new Date()).format('YYYY-MM-DD'),
                reason: creditNote.reason,
                amount: parseFloat(creditNote.amount),
                isrealtime: true,
                datetimeClient: new Date().toISOString()
            };

            const response = await fetch(CBMS_RETURN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json() as { status?: number; message?: string };
            const parsed = this.parseResponseCode(result.status ?? 0);

            if (parsed.success) {
                await db.update(creditNotes)
                    .set({ syncedToCbms: true })
                    .where(eq(creditNotes.id, creditNoteId));

                return { status: 'success', message: 'Credit note synced to CBMS' };
            }
            return { status: 'error', message: parsed.message, code: result.status };
        } catch (error) {
            console.error('[CBMS] Credit note sync error:', error);
            return { status: 'error', message: 'Failed to connect to CBMS server' };
        }
    },

    async retryFailedSyncs(hotelId: number) {
        const unsynced = await db.query.invoices.findMany({
            where: and(eq(invoices.syncedToCbms, false), eq(invoices.hotelId, hotelId))
        });

        const results = [];
        for (const inv of unsynced) {
            const result = await this.syncInvoice(inv.id, hotelId);
            results.push({ invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, ...result });
        }

        return results;
    }
};