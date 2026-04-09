import { BillingService } from './billing.service';
import { AuditService } from '../system/audit.service';
import { sql, eq, and, desc } from 'drizzle-orm';
import { db } from '../../db';
import { invoices, bookings, rooms, hotels, folioCharges, orders } from '../../db/schema';
import NepaliDate from 'nepali-date-converter';
import { PdfService } from '../../utils/pdf.service';
import { NotFoundError } from '../../utils/errors';
import { BookingsService } from '../bookings/bookings.service';

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
    async generateInvoice(hotelId: number, userId: string, data: { bookingId: string; discount?: number; guestPan?: string; doCheckout?: boolean }) {
        // 1. Calculate Billing (Pre-lock)
        const billingSummary = await BillingService.calculateBillingSummary(hotelId, data.bookingId);
        const discountAmount = data.discount ?? 0;
        const finalGrandTotal = billingSummary.grandTotal - discountAmount;

        const booking = await BookingsService.getBookingById(hotelId, data.bookingId);

        // 2. Transaction
        const newInvoice = await db.transaction(async (tx) => {
            // Acquire advisory lock
            await tx.execute(sql`SELECT pg_advisory_xact_lock(${hotelId})`);

            const hotel = await tx.query.hotels.findFirst({
                where: eq(hotels.id, hotelId),
                columns: { currency: true }
            });
            const currency = hotel?.currency ?? 'NPR';

            const { number, sequence, fiscalYear } = await this.getNextInvoiceNumber(hotelId, tx);

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
                grandTotal: finalGrandTotal.toFixed(2),
                currency: currency,
                createdById: userId
            }).returning();

            if (!inv) throw new Error('Failed to create invoice');

            if (data.doCheckout) {
                await tx.update(bookings)
                    .set({ status: 'CHECKED_OUT', isPaid: true, updatedAt: new Date() })
                    .where(eq(bookings.id, data.bookingId));

                await tx.update(rooms)
                    .set({ status: 'CLEANING', currentGuestPin: null, updatedAt: new Date() })
                    .where(eq(rooms.id, booking.roomId));
            }

            return inv;
        });

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

        // Get folio charges
        const charges = await db.query.folioCharges.findMany({
            where: eq(folioCharges.bookingId, invoice.bookingId)
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
        const lineItems = [
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

        // Extract hotel branding
        const hotelBranding = {
            name: invoice.hotel.name,
            logoUrl: invoice.hotel.logoUrl ?? '',
            primaryColor: invoice.hotel.primaryColor ?? '#1a365d',
            secondaryColor: invoice.hotel.secondaryColor ?? '#2b6cb0',
            address: invoice.hotel.address ?? '',
            phone: invoice.hotel.phone ?? '',
            email: invoice.hotel.email ?? '',
            website: invoice.hotel.website ?? '',
            panNumber: invoice.hotel.panNumber ?? '',
            vatNumber: invoice.hotel.vatNumber ?? '',
            currency: invoice.hotel.currency ?? 'NPR',
            dateFormat: invoice.hotel.dateFormat ?? 'YYYY-MM-DD',
            invoiceFooterText: invoice.hotel.invoiceFooterText ?? 'Thank you for staying with us!',
            invoiceTerms: invoice.hotel.invoiceTerms ?? ''
        };

        // Recalculate tax rates from stored values for display consistency
        const subTotal = parseFloat(invoice.subTotal);
        const serviceCharge = parseFloat(invoice.serviceCharge ?? '0');
        const vatAmount = parseFloat(invoice.vatAmount ?? '0');

        // Infer rates if not stored directly
        const serviceChargeRate = serviceCharge / (subTotal || 1) * 100;
        const taxable = subTotal + serviceCharge;
        const vatRate = vatAmount / (taxable || 1) * 100;

        return {
            invoice: {
                id: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                fiscalYear: invoice.fiscalYear,
                dateAd: dateAd.toISOString().split('T')[0],
                dateBs,
                guestName: invoice.guestName,
                guestPan: invoice.guestPan,
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
                number: invoice.booking.room.number,
                type: invoice.booking.room.type
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
                serviceChargeRate: parseFloat(hotel.serviceChargeRate ?? '0.10') * 100,
                taxRate: parseFloat(hotel.taxRate ?? '0.13') * 100
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