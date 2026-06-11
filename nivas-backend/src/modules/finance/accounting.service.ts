import { db } from '../../db';
import { invoices } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import NepaliDate from 'nepali-date-converter';
import { NotFoundError } from '../../utils/errors';

export const AccountingService = {
    async recordInvoicePrint(hotelId: number, invoiceId: string) {
        const invoice = await db.query.invoices.findFirst({
            where: and(
                eq(invoices.id, invoiceId),
                eq(invoices.hotelId, hotelId)
            ),
            with: { hotel: true, booking: { with: { room: true } } }
        });

        if (!invoice) throw new NotFoundError('Invoice not found');

        const currentPrintCount = invoice.printCount ?? 0;
        const isReprint = currentPrintCount > 0;

        // Increment print count
        await db.update(invoices)
            .set({ printCount: currentPrintCount + 1 })
            .where(and(eq(invoices.id, invoiceId), eq(invoices.hotelId, hotelId)));

        const invoiceDate = invoice.createdAt ?? new Date();
        const dateBs = new NepaliDate(invoiceDate).format('YYYY-MM-DD');
        const dateAd = invoiceDate.toISOString().split('T')[0];

        return {
            invoiceNumber: invoice.invoiceNumber,
            fiscalYear: invoice.fiscalYear,
            isReprint,
            printCount: currentPrintCount + 1,
            watermark: isReprint ? 'COPY OF ORIGINAL' : null,
            copyType: currentPrintCount === 0 ? 'CUSTOMER'
                : currentPrintCount === 1 ? 'ACCOUNTING'
                    : currentPrintCount === 2 ? 'OFFICE'
                        : 'COPY',
            dates: { ad: dateAd, bs: dateBs },
            guest: { name: invoice.guestName, pan: invoice.guestPan },
            totals: {
                subTotal: parseFloat(invoice.subTotal),
                serviceCharge: parseFloat(invoice.serviceCharge ?? '0'),
                vat: parseFloat(invoice.vatAmount ?? '0'),
                discount: parseFloat(invoice.discountAmount ?? '0'),
                grandTotal: parseFloat(invoice.grandTotal)
            },
            hotel: {
                name: invoice.hotel.name,
                address: invoice.hotel.address,
                phone: invoice.hotel.phone,
                panNumber: invoice.hotel.panNumber,
                vatNumber: invoice.hotel.vatNumber
            },
            room: invoice.booking?.room?.number
        };
    }
};
