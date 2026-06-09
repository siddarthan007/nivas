import { db } from '../../db';
import { bookings, rooms, orders, folioCharges, payments, invoices, guests, hotels } from '../../db/schema';
import { NotificationChannelService } from '../notifications/notification-channel.service';
import { CbmsService } from './cbms.service';
import { eq, and, sum, desc, sql, inArray } from 'drizzle-orm';
import { NotFoundError, ValidationError, BusinessLogicError } from '../../utils/errors';
import { BookingsService } from '../bookings/bookings.service';
import { BillingService } from './billing.service';
import { InvoiceService } from './invoice.service';
import { FinanceService } from './finance.service';
import { GLService } from './gl.service';
import { CouponsService } from '../coupons/coupons.service';
import { AuditService } from '../system/audit.service';
import { logAction } from '../system/audit.service';

export interface CheckoutPreview {
    bookingId: string;
    guestName: string;
    guestId: string | null;
    roomNumber: string;
    roomType: string;
    checkIn: Date;
    checkOut: Date;
    charges: {
        roomCharges: number;
        foodBeverage: number;
        extras: number;
        subTotal: number;
        serviceCharge: number;
        vat: number;
        discount: number;
        grandTotal: number;
    };
    payments: {
        totalPaid: number;
        paymentList: Array<{
            id: string;
            method: string;
            amount: number;
            date: Date;
        }>;
    };
    balanceDue: number;
    itemized: Array<{
        description: string;
        category: 'ROOM' | 'F&B' | 'EXTRA';
        quantity: number;
        rate: number;
        amount: number;
        date: Date;
    }>;
}

export interface CheckoutData {
    payments: Array<{
        method: string;
        amount: number;
        transactionId?: string;
        notes?: string;
    }>;
    discount?: number;
    couponId?: number;
    guestPan?: string;
    payLater?: boolean;
    creditReason?: string;
}

export interface CheckoutResult {
    booking: any;
    invoice: any;
    paymentsRecorded: any[];
    balanceDue: number;
    isCredit: boolean;
}

/**
 * Checkout Service - Handles the complete guest checkout workflow
 * Includes bill preview, payment recording, credit management, and invoice generation
 */
export const CheckoutService = {
    /**
     * Preview the checkout bill for a booking before processing
     */
    async preview(hotelId: number, bookingId: string): Promise<CheckoutPreview> {
        const booking = await BookingsService.getBookingById(hotelId, bookingId);

        if (booking.status !== 'CHECKED_IN' && booking.status !== 'CONFIRMED') {
            throw new BusinessLogicError(`Cannot checkout a booking with status: ${booking.status}`);
        }

        const billingSummary = await BillingService.calculateBillingSummary(hotelId, bookingId);

        // Get all folio charges with details
        const folio = await db.query.folioCharges.findMany({
            where: and(
                eq(folioCharges.bookingId, bookingId),
                eq(folioCharges.hotelId, hotelId)
            ),
            orderBy: [folioCharges.date]
        });

        // Get all orders linked to this booking (served only)
        const orderList = await db.query.orders.findMany({
            where: and(
                eq(orders.bookingId, bookingId),
                eq(orders.hotelId, hotelId),
                eq(orders.status, 'SERVED')
            ),
            with: { items: { with: { menuItem: true } } },
            orderBy: [desc(orders.createdAt)]
        });

        // Get all existing payments
        const paymentList = await db.query.payments.findMany({
            where: and(
                eq(payments.bookingId, bookingId),
                eq(payments.hotelId, hotelId)
            ),
            orderBy: [desc(payments.createdAt)]
        });

        // Build itemized list
        const itemized: CheckoutPreview['itemized'] = [];

        // Room charges from folio
        folio.forEach(charge => {
            itemized.push({
                description: charge.description,
                category: charge.type === 'ROOM_CHARGE' ? 'ROOM' : 'EXTRA',
                quantity: 1,
                rate: parseFloat(charge.amount),
                amount: parseFloat(charge.amount),
                date: charge.date ? new Date(charge.date) : new Date(),
            });
        });

        // F&B from orders
        orderList.forEach(order => {
            order.items?.forEach(item => {
                itemized.push({
                    description: `${order.orderNumber} - ${item.menuItem?.name || 'Item'}`,
                    category: 'F&B',
                    quantity: item.quantity,
                    rate: parseFloat(item.price),
                    amount: item.quantity * parseFloat(item.price),
                    date: order.createdAt ? new Date(order.createdAt) : new Date(),
                });
            });
        });

        // Sort by date
        itemized.sort((a, b) => a.date.getTime() - b.date.getTime());

        return {
            bookingId: booking.id,
            guestName: booking.guestName,
            guestId: booking.guestId || null,
            roomNumber: `${booking.room?.number || ''}`,
            roomType: booking.room?.type || '',
            checkIn: new Date(booking.checkIn),
            checkOut: new Date(booking.checkOut),
            charges: {
                roomCharges: billingSummary.roomCharge,
                foodBeverage: billingSummary.ordersTotal,
                extras: 0,
                subTotal: billingSummary.subTotal,
                serviceCharge: billingSummary.serviceCharge,
                vat: billingSummary.vat,
                discount: 0,
                grandTotal: billingSummary.grandTotal,
            },
            payments: {
                totalPaid: billingSummary.paidAmount,
                paymentList: paymentList.map(p => ({
                    id: p.id,
                    method: p.paymentMethod,
                    amount: parseFloat(p.amount),
                    date: p.createdAt ? new Date(p.createdAt) : new Date(),
                }))
            },
            balanceDue: billingSummary.dueAmount,
            itemized,
        };
    },

    /**
     * Process a complete checkout
     * Records payments, generates invoice, handles credits, marks checkout
     */
    async process(hotelId: number, userId: string, bookingId: string, data: CheckoutData): Promise<CheckoutResult> {
        const preview = await this.preview(hotelId, bookingId);
        const balanceDue = preview.balanceDue;
        const discount = data.discount || 0;
        const finalBalance = Math.max(0, balanceDue - discount);

        let totalPaymentAmount = 0;
        const paymentsRecorded: any[] = [];
        let isCredit = false;

        const result = await db.transaction(async (tx) => {
            // Serialize checkouts per hotel so a double-click / concurrent request
            // can't produce duplicate invoices, payments and GL entries. The lock
            // is held until the transaction commits.
            await tx.execute(sql`SELECT pg_advisory_xact_lock(${hotelId})`);

            const bookingData = await tx.query.bookings.findFirst({
                where: and(eq(bookings.id, bookingId), eq(bookings.hotelId, hotelId)),
                with: { room: true }
            });

            if (!bookingData) throw new NotFoundError('Booking');

            // Guard re-read under the lock: never check out twice or check out a
            // cancelled booking.
            if (bookingData.status === 'CHECKED_OUT') {
                throw new BusinessLogicError('This booking has already been checked out');
            }
            if (bookingData.status === 'CANCELLED') {
                throw new BusinessLogicError('Cannot check out a cancelled booking');
            }

            // 1. Record all payments
            for (const pay of data.payments) {
                if (pay.amount <= 0) continue;
                const [payment] = await tx.insert(payments).values({
                    hotelId,
                    bookingId,
                    amount: pay.amount.toFixed(2),
                    paymentMethod: pay.method as any,
                    transactionId: pay.transactionId || `TXN-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
                    notes: pay.notes || 'Checkout payment',
                    recordedById: userId,
                }).returning();
                paymentsRecorded.push(payment);
                totalPaymentAmount += pay.amount;
            }

            // 2. Calculate final balance after payments and discount
            const remainingBalance = Math.max(0, finalBalance - totalPaymentAmount);

            // 3. Generate invoice (reuse checkout tx for atomicity)
            const { invoice: inv } = await InvoiceService.generateInvoice(
                hotelId,
                userId,
                {
                    bookingId,
                    discount,
                    guestPan: data.guestPan,
                    doCheckout: false, // We'll handle checkout manually for credit tracking
                },
                tx
            );

            // 4. Update invoice payment status & post payment GL entries
            const arAccount = await GLService.getOrCreateControlAccount(hotelId, '1100', 'Accounts Receivable', 'ASSET', tx);
            const cashAccount = await GLService.getOrCreateControlAccount(hotelId, '1000', 'Cash', 'ASSET', tx);
            const bankAccount = await GLService.getOrCreateControlAccount(hotelId, '1010', 'Bank', 'ASSET', tx);

            if (data.payLater || remainingBalance > 0.01) {
                isCredit = true;
                await tx.update(invoices)
                    .set({
                        paymentStatus: 'CREDIT',
                        voidReason: `Credit: ${data.creditReason || 'Guest opted to pay later'}. Balance due: ${remainingBalance.toFixed(2)}`,
                    })
                    .where(eq(invoices.id, inv.id));
            } else {
                await tx.update(invoices)
                    .set({ paymentStatus: 'PAID' })
                    .where(eq(invoices.id, inv.id));
            }

            // Post payment GL entries: Debit Cash/Bank, Credit AR
            const paymentLines: { accountId: number; debit: number; credit: number; description: string }[] = [];
            for (const pay of data.payments) {
                if (pay.amount <= 0) continue;
                const methodLower = pay.method.toLowerCase();
                const isCash = methodLower === 'cash';
                const payAccount = isCash ? cashAccount : bankAccount;
                paymentLines.push({
                    accountId: payAccount!.id,
                    debit: pay.amount,
                    credit: 0,
                    description: `${pay.method} payment - ${pay.transactionId || 'TXN'}`
                });
            }
            if (paymentLines.length > 0) {
                const totalPayments = paymentLines.reduce((s, l) => s + l.debit, 0);
                paymentLines.push({
                    accountId: arAccount!.id,
                    debit: 0,
                    credit: totalPayments,
                    description: `Payment received - Invoice ${inv.invoiceNumber}`
                });
                await GLService.postJournalEntry(
                    hotelId,
                    userId,
                    new Date().toISOString().split('T')[0] as string,
                    `Checkout payments - ${bookingData.guestName} - Invoice ${inv.invoiceNumber}`,
                    inv.invoiceNumber,
                    paymentLines,
                    tx
                );
            }

            // 5. Mark booking as checked out
            await tx.update(bookings)
                .set({
                    status: 'CHECKED_OUT',
                    isPaid: !isCredit,
                    updatedAt: new Date(),
                })
                .where(eq(bookings.id, bookingId));

            // 6. Mark room as cleaning
            await tx.update(rooms)
                .set({
                    status: 'CLEANING',
                    currentGuestPin: null,
                    updatedAt: new Date(),
                })
                .where(eq(rooms.id, bookingData.roomId));

            // 7. Log audit action
            await logAction(
                hotelId,
                userId,
                'CHECKOUT',
                'BOOKING',
                bookingId,
                {
                    guestName: bookingData.guestName,
                    roomNumber: bookingData.room?.number,
                    totalPaid: totalPaymentAmount,
                    discount,
                    balanceDue: remainingBalance,
                    isCredit,
                    invoiceNumber: inv.invoiceNumber,
                }
            );

            return { booking: bookingData, invoice: inv, remainingBalance };
        });

        // Consume the coupon once checkout is committed.
        if (data.couponId && discount > 0) {
            await CouponsService.redeem(hotelId, data.couponId).catch(() => { /* non-fatal */ });
        }

        // Queue the invoice for IRD CBMS sync (no-op unless CBMS is configured).
        CbmsService.enqueue(hotelId, 'BILL', result.invoice.id, result.invoice.invoiceNumber).catch(() => { /* non-fatal */ });

        // Send the guest their checkout confirmation + a link to view/print the
        // invoice (the invoice id is the unguessable public token).
        const bk: any = result.booking;
        if (bk?.guestPhone || bk?.guestEmail) {
            const base = (process.env.GUEST_PORTAL_URL || 'http://localhost:5173').replace(/\/guest.*$/, '').replace(/\/$/, '');
            const invoiceUrl = `${base}/invoice?id=${result.invoice.id}`;
            const hotel = await db.query.hotels.findFirst({ where: eq(hotels.id, hotelId), columns: { name: true } });
            NotificationChannelService.sendCheckoutNotification(hotelId, bk.guestPhone || '', bk.guestEmail || undefined, {
                hotelName: hotel?.name || 'Hotel',
                invoiceNumber: result.invoice.invoiceNumber,
                invoiceUrl,
            }).catch(() => { /* non-fatal */ });
        }

        return {
            booking: result.booking,
            invoice: result.invoice,
            paymentsRecorded,
            balanceDue: result.remainingBalance,
            isCredit,
        };
    },

    /**
     * Get checkout history / folio for a guest
     * Shows all bookings, orders, payments, and outstanding balances
     */
    async getGuestFolio(hotelId: number, guestId: string) {
        const guest = await db.query.guests.findFirst({
            where: and(eq(guests.id, guestId), eq(guests.hotelId, hotelId)),
        });

        if (!guest) throw new NotFoundError('Guest');

        // Get all bookings for this guest
        const guestBookings = await db.query.bookings.findMany({
            where: and(eq(bookings.guestId, guestId), eq(bookings.hotelId, hotelId)),
            orderBy: [desc(bookings.createdAt)],
            with: { room: { columns: { number: true, type: true } } }
        });

        // Get all orders for this guest
        const guestOrders = await db.query.orders.findMany({
            where: and(eq(orders.guestId, guestId), eq(orders.hotelId, hotelId)),
            orderBy: [desc(orders.createdAt)],
            with: { items: { with: { menuItem: { columns: { name: true } } } } }
        });

        // Get all payments for this guest's bookings
        const bookingIds = guestBookings.map(b => b.id);
        let guestPayments: any[] = [];
        if (bookingIds.length > 0) {
            guestPayments = await db.query.payments.findMany({
                where: and(
                    eq(payments.hotelId, hotelId),
                    inArray(payments.bookingId, bookingIds)
                ),
                orderBy: [desc(payments.createdAt)]
            });
        }

        // Get all invoices for this guest's bookings
        let guestInvoices: any[] = [];
        if (bookingIds.length > 0) {
            guestInvoices = await db.query.invoices.findMany({
                where: and(
                    eq(invoices.hotelId, hotelId),
                    sql`${invoices.bookingId} IN ${bookingIds}`
                ),
                orderBy: [desc(invoices.createdAt)]
            });
        }

        // Calculate totals
        const totalCharges = guestInvoices.reduce((sum, inv) =>
            sum + parseFloat(inv.grandTotal), 0);
        const totalPaid = guestPayments.reduce((sum, p) =>
            sum + parseFloat(p.amount), 0);
        const totalCredits = guestInvoices
            .filter(inv => inv.paymentStatus === 'CREDIT')
            .reduce((sum, inv) => sum + parseFloat(inv.grandTotal), 0);

        return {
            guest,
            bookings: guestBookings,
            orders: guestOrders,
            payments: guestPayments,
            invoices: guestInvoices,
            summary: {
                totalCharges,
                totalPaid,
                totalCredits,
                balanceDue: totalCharges - totalPaid,
                stayCount: guestBookings.length,
                orderCount: guestOrders.length,
            }
        };
    }
};
