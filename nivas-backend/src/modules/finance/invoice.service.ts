import { BillingService } from './billing.service';
import { AuditService } from '../system/audit.service';
import { sql, eq, and, desc } from 'drizzle-orm';
import { db } from '../../db';
import { invoices, bookings, rooms, hotels, folioCharges, orders } from '../../db/schema';
import NepaliDate from 'nepali-date-converter';
import { PdfService } from '../../utils/pdf.service';
import { NotFoundError } from '../../utils/errors';
import { BookingsService } from '../bookings/bookings.service';
import { GLService } from './gl.service';

/**
 * Invoice Service - Handles invoice number generation, creation, and data preparation
 */
export const InvoiceService = {
    /**
     * Get the next sequential invoice number for a hotel
     */
    async getNextInvoiceNumber(hotelId: number, tx: any = db): Promise<{ number: string; sequence: number; fiscalYear: string }> {
        // Get hotel settings using tx
        const hotel = await tx.query.hotels.findFirst({
            where: eq(hotels.id, hotelId)
        });

        const invoicePrefix = hotel?.invoicePrefix ?? 'INV';

        const now = new Date();
        const nepaliDate = new NepaliDate(now);
        const bsYear = nepaliDate.getYear();
        const bsMonth = nepaliDate.getMonth();

        // Fiscal year runs from Shrawan (month 4 in BS, index 3) to Ashad (month 3 in BS, index 2)
        const fiscalYearStart = bsMonth >= 3 ? bsYear : bsYear - 1;
        const fiscalYear = `${(fiscalYearStart % 100).toString().padStart(2, '0')}/${((fiscalYearStart + 1) % 100).toString().padStart(2, '0')}`;

        const lastInvoice = await tx.query.invoices.findFirst({
            where: and(
                eq(invoices.hotelId, hotelId),
                eq(invoices.fiscalYear, fiscalYear)
            ),
            orderBy: [desc(invoices.sequenceNumber)]
        });

        const nextSeq = (lastInvoice?.sequenceNumber ?? 0) + 1;
        const nextNum = `${invoicePrefix}-${fiscalYear}-${nextSeq.toString().padStart(4, '0')}`;

        return { number: nextNum, sequence: nextSeq, fiscalYear };
    },

    /**
     * Generate an invoice (Transaction)
     */
    async generateInvoice(hotelId: number, userId: string, data: { bookingId: string; discount?: number; guestPan?: string; doCheckout?: boolean }, dbTx?: any) {
        // 1. Calculate Billing (Pre-lock)
        const billingSummary = await BillingService.calculateBillingSummary(hotelId, data.bookingId);
        // Cap discount to the bill so the invoice total / AR can never go negative.
        const discountAmount = Math.min(Math.max(0, data.discount ?? 0), billingSummary.grandTotal);
        const finalGrandTotal = billingSummary.grandTotal - discountAmount;

        const booking = await BookingsService.getBookingById(hotelId, data.bookingId);

        const core = async (tx: any) => {
            // Acquire advisory lock
            await tx.execute(sql`SELECT pg_advisory_xact_lock(${hotelId})`);

            const hotel = await tx.query.hotels.findFirst({
                where: eq(hotels.id, hotelId),
                columns: { currency: true }
            });
            const currency = hotel?.currency ?? 'NPR';

            const { number, sequence, fiscalYear } = await this.getNextInvoiceNumber(hotelId, tx);

            // Revenue split for proper GL credit-note reversal later.
            const { roomCharge, ordersTotal, subTotal, serviceCharge, vat } = billingSummary;
            let roomRev = roomCharge;
            let fbRev = ordersTotal;
            if (subTotal > 0 && serviceCharge > 0) {
                roomRev += serviceCharge * (roomCharge / subTotal);
                fbRev += serviceCharge * (ordersTotal / subTotal);
            }

            const [inv] = await tx.insert(invoices).values({
                hotelId,
                bookingId: data.bookingId,
                invoiceNumber: number,
                sequenceNumber: sequence,
                fiscalYear: fiscalYear,
                guestName: booking.guestName,
                guestPan: data.guestPan,
                subTotal: billingSummary.subTotal.toFixed(2),
                serviceCharge: billingSummary.serviceCharge.toFixed(2),
                vatAmount: billingSummary.vat.toFixed(2),
                discountAmount: discountAmount.toFixed(2),
                roomRevenue: roomRev.toFixed(2),
                fbRevenue: fbRev.toFixed(2),
                grandTotal: finalGrandTotal.toFixed(2),
                currency: currency,
                createdById: userId
            }).returning();

            if (!inv) throw new Error('Failed to create invoice');

            // Enforce immutability: Attach this invoice ID to all pending folio charges for this booking
            await tx.update(folioCharges)
                .set({ invoiceId: inv.id })
                .where(and(
                    eq(folioCharges.bookingId, data.bookingId),
                    sql`${folioCharges.invoiceId} IS NULL`
                ));

            if (data.doCheckout) {
                await tx.update(bookings)
                    .set({ status: 'CHECKED_OUT', isPaid: true, updatedAt: new Date() })
                    .where(eq(bookings.id, data.bookingId));

                await tx.update(rooms)
                    .set({ status: 'CLEANING', currentGuestPin: null, updatedAt: new Date() })
                    .where(eq(rooms.id, booking.roomId));
            }

            // Auto-post to GL — split revenue by source so Room Revenue and F&B
            // Revenue are tracked separately (proportional service-charge split).
            const arAccount = await GLService.getOrCreateControlAccount(hotelId, '1100', 'Accounts Receivable', 'ASSET', tx);
            const roomRevAccount = await GLService.getOrCreateControlAccount(hotelId, '4000', 'Room Revenue', 'REVENUE', tx);
            const fbRevAccount = await GLService.getOrCreateControlAccount(hotelId, '4100', 'F&B Revenue', 'REVENUE', tx);
            const taxAccount = await GLService.getOrCreateControlAccount(hotelId, '2100', 'Sales Tax Payable', 'LIABILITY', tx);
            const discountAccount = await GLService.getOrCreateControlAccount(hotelId, '4900', 'Sales Discounts', 'EXPENSE', tx);

            const lines = [];
            // Debit AR
            lines.push({ accountId: arAccount!.id, debit: finalGrandTotal, credit: 0, description: `Invoice ${number}` });

            // If discount, Debit Discount Account
            if (discountAmount > 0) {
                lines.push({ accountId: discountAccount!.id, debit: discountAmount, credit: 0, description: 'Discount' });
            }

            // Credit Room Revenue (room charges + their share of service charge)
            if (roomRev > 0) {
                lines.push({ accountId: roomRevAccount!.id, debit: 0, credit: Math.round(roomRev * 100) / 100, description: 'Room Revenue' });
            }
            if (fbRev > 0) {
                lines.push({ accountId: fbRevAccount!.id, debit: 0, credit: Math.round(fbRev * 100) / 100, description: 'F&B Revenue' });
            }

            // Credit Tax (VAT)
            if (billingSummary.vat > 0) {
                lines.push({ accountId: taxAccount!.id, debit: 0, credit: billingSummary.vat, description: 'VAT' });
            }

            await GLService.postJournalEntry(
                hotelId,
                userId,
                new Date().toISOString().split('T')[0] as string,
                `Generated Invoice ${number} for ${booking.guestName}`,
                number,
                lines,
                tx
            );

            return inv;
        };

        const newInvoice = dbTx ? await core(dbTx) : await db.transaction(async (tx) => core(tx));

        return { invoice: newInvoice, grandTotal: finalGrandTotal };
    },

    /**
     * Get invoice data with hotel branding
     */
    async getInvoiceData(invoiceId: string, hotelId?: number) {
        const invoice = await db.query.invoices.findFirst({
            where: hotelId
                ? and(eq(invoices.id, invoiceId), eq(invoices.hotelId, hotelId))
                : eq(invoices.id, invoiceId),
            with: {
                hotel: true,
                booking: {
                    with: { room: true }
                }
            }
        });

        if (!invoice) throw new NotFoundError('Invoice');

        const hotel = (invoice as any).hotel;
        const booking = (invoice as any).booking;

        // Get folio charges
        const charges = await db.query.folioCharges.findMany({
            where: sql`${folioCharges.invoiceId} = ${invoice.id} OR (${folioCharges.invoiceId} IS NULL AND ${folioCharges.bookingId} = ${invoice.bookingId})`
        });

        // Get room service orders
        const roomOrders = await db.query.orders.findMany({
            where: and(
                eq(orders.bookingId, invoice.bookingId),
                eq(orders.status, 'SERVED')
            ),
            with: { items: { with: { menuItem: true } } }
        });

        const dateAd = invoice.createdAt ?? new Date();
        const dateBs = new NepaliDate(dateAd).format('YYYY-MM-DD');

        // Build line items
        const lineItems: Array<{ description: string; quantity: number; rate: number; amount: number }> = [
            ...charges.map(c => ({
                description: c.description,
                quantity: 1,
                rate: parseFloat(c.amount ?? '0'),
                amount: parseFloat(c.amount ?? '0')
            })),
            ...roomOrders.flatMap(o => o.items.map(i => ({
                description: i.menuItem.name,
                quantity: i.quantity,
                rate: parseFloat(i.price),
                amount: i.quantity * parseFloat(i.price)
            })))
        ];

        // If no folio charges exist (e.g., checkout before night audit), add a synthetic room charge line
        if (charges.length === 0 && booking) {
            const ordersTotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
            const roomCharge = parseFloat(invoice.subTotal) - ordersTotal;
            if (roomCharge > 0) {
                lineItems.unshift({
                    description: `Room Charge - ${booking.room?.number || 'Room'} (${booking.room?.type || ''})`,
                    quantity: 1,
                    rate: roomCharge,
                    amount: roomCharge
                });
            }
        }

        // Extract hotel branding
        const hotelBranding = {
            name: hotel.name,
            logoUrl: hotel.logoUrl ?? '',
            primaryColor: hotel.primaryColor ?? '#1a365d',
            secondaryColor: hotel.secondaryColor ?? '#2b6cb0',
            address: hotel.address ?? '',
            phone: hotel.phone ?? '',
            email: hotel.email ?? '',
            website: hotel.website ?? '',
            panNumber: hotel.panNumber ?? '',
            vatNumber: hotel.vatNumber ?? '',
            currency: hotel.currency ?? 'NPR',
            dateFormat: hotel.dateFormat ?? 'YYYY-MM-DD',
            invoiceFooterText: hotel.invoiceFooterText ?? 'Thank you for staying with us!',
            invoiceTerms: hotel.invoiceTerms ?? '',
            // Bill/receipt template options.
            headerNote: (hotel.invoiceConfig as any)?.headerNote ?? '',
            showTaxBreakdown: (hotel.invoiceConfig as any)?.showTaxBreakdown !== false,
        };

        // Recalculate tax rates from stored values for display consistency
        const subTotal = parseFloat(invoice.subTotal);
        const serviceCharge = parseFloat(invoice.serviceCharge ?? '0');
        const vatAmount = parseFloat(invoice.vatAmount ?? '0');

        // Infer rates if not stored directly
        const serviceChargeRate = subTotal > 0 ? (serviceCharge / subTotal) * 100 : 0;
        const taxable = subTotal + serviceCharge;
        const vatRate = taxable > 0 ? (vatAmount / taxable) * 100 : 0;

        return {
            invoice: {
                id: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                fiscalYear: invoice.fiscalYear,
                dateAd: dateAd.toISOString().split('T')[0],
                dateBs,
                guestName: invoice.guestName,
                guestPan: invoice.guestPan,
                guestPhone: booking?.guestPhone ?? '',
                guestEmail: booking?.guestEmail ?? '',
                checkIn: booking?.checkIn ? new Date(booking.checkIn).toISOString() : null,
                checkOut: booking?.checkOut ? new Date(booking.checkOut).toISOString() : null,
                subTotal,
                serviceCharge,
                vatAmount,
                discountAmount: parseFloat(invoice.discountAmount ?? '0'),
                grandTotal: parseFloat(invoice.grandTotal),
                paymentStatus: invoice.paymentStatus,
                currency: invoice.currency
            },
            hotel: hotelBranding,
            room: {
                number: booking?.room?.number,
                type: booking?.room?.type
            },
            lineItems,
            totals: {
                subTotal,
                serviceCharge,
                serviceChargeRate: Math.round(serviceChargeRate),
                taxableAmount: taxable,
                vat: vatAmount,
                vatRate: Math.round(vatRate),
                discount: parseFloat(invoice.discountAmount ?? '0'),
                grandTotal: parseFloat(invoice.grandTotal)
            }
        };
    },

    /**
     * Get hotel settings for invoice customization
     */
    async getHotelSettings(hotelId: number) {
        const hotel = await db.query.hotels.findFirst({
            where: eq(hotels.id, hotelId)
        });

        if (!hotel) throw new Error('Hotel not found');

        return {
            branding: {
                name: hotel.name,
                logoUrl: hotel.logoUrl,
                primaryColor: hotel.primaryColor,
                secondaryColor: hotel.secondaryColor
            },
            contact: {
                address: hotel.address,
                phone: hotel.phone,
                email: hotel.email,
                website: hotel.website
            },
            tax: {
                panNumber: hotel.panNumber,
                vatNumber: hotel.vatNumber,
                serviceChargeRate: parseFloat(hotel.serviceChargeRate || '0.10') * 100,
                taxRate: parseFloat(hotel.taxRate || '0.13') * 100
            },
            regional: {
                currency: hotel.currency,
                timezone: hotel.timezone,
                dateFormat: hotel.dateFormat,
                fiscalYearStart: hotel.fiscalYearStart
            },
            invoice: {
                prefix: hotel.invoicePrefix,
                footerText: hotel.invoiceFooterText,
                terms: hotel.invoiceTerms
            }
        };
    },

    /**
     * Generate PDF for an invoice
     */
    async generatePdf(invoiceId: string, hotelId?: number): Promise<Buffer> {
        const data = await this.getInvoiceData(invoiceId, hotelId);
        const docDefinition = PdfService.generateInvoiceDefinition(data);
        return await PdfService.generatePdf(docDefinition);
    }
};