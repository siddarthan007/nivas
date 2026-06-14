import { db } from '../../db';
import { orders, payments, hotels, folioCharges } from '../../db/schema';
import { eq, and, or, sum, desc, isNull, sql, ne } from 'drizzle-orm';
import { NotFoundError } from '../../utils/errors';
import { BookingsService } from '../bookings/bookings.service';

export interface GuestBillLineItem {
    id: string;
    category: string;
    description: string;
    amount: number;
    date: string;
    status: 'BILLED' | 'PENDING';
}

export interface BillingSummary {
    roomCharge: number;
    ordersTotal: number;
    subTotal: number;
    serviceChargeRate: number;
    serviceCharge: number;
    taxRate: number;
    vat: number;
    grandTotal: number;
    paidAmount: number;
    creditBalance: number;
    dueAmount: number;
}

/**
 * Billing Service - Centralized billing calculation logic
 * Used by billing controller and guest portal for consistent calculations
 */
export const BillingService = {
    /**
     * Calculate billing summary for a booking
     * Uses folio_charges for room charges to ensure accuracy with night audit
     */
    async calculateBillingSummary(hotelId: number, bookingId: string): Promise<BillingSummary> {
        // Get hotel settings for tax rates
        const hotel = await db.query.hotels.findFirst({
            where: eq(hotels.id, hotelId)
        });

        if (!hotel) throw new NotFoundError('Hotel');

        const serviceChargeRate = parseFloat(hotel.serviceChargeRate || '0.10');
        const taxRate = parseFloat(hotel.taxRate || '0.13');

        const booking = await BookingsService.getBookingById(hotelId, bookingId);

        // Room/misc folio charges only. Exclude order-linked charges — F&B orders
        // are summed separately below, so counting them here too would double-bill.
        // We separate ROOM_CHARGE (posted by night audit) from extras so the base
        // room rate is never lost when staff manually adds a folio charge.
        const [roomFolioResult] = await db.select({ total: sum(folioCharges.amount) })
            .from(folioCharges)
            .where(and(
                eq(folioCharges.bookingId, bookingId),
                eq(folioCharges.type, 'ROOM_CHARGE')
            ));

        const [extraFolioResult] = await db.select({ total: sum(folioCharges.amount) })
            .from(folioCharges)
            .where(and(
                eq(folioCharges.bookingId, bookingId),
                isNull(folioCharges.orderId),
                ne(folioCharges.type, 'ROOM_CHARGE')
            ));

        const roomFolioTotal = parseFloat(roomFolioResult?.total ?? '0');
        const extraFolioTotal = parseFloat(extraFolioResult?.total ?? '0');

        // If night audit posted room charges, use those (they equal booking total).
        // Otherwise use the booking total as the base rate.
        let roomCharge = roomFolioTotal > 0 ? roomFolioTotal : parseFloat(booking.totalAmount || '0');
        roomCharge += extraFolioTotal;

        // Get orders for this booking (Served only) — use subTotal (pre-tax) so
        // hotel-wide service charge + VAT are computed on the raw F&B amount.
        const [ordersResult] = await db.select({ total: sum(orders.subTotal) })
            .from(orders)
            .where(and(
                eq(orders.bookingId, bookingId),
                eq(orders.hotelId, hotelId),
                eq(orders.status, 'SERVED')
            ));

        const ordersTotal = parseFloat(ordersResult?.total ?? '0');

        // Get payments for this booking
        const [paymentsResult] = await db.select({ total: sum(payments.amount) })
            .from(payments)
            .where(and(
                eq(payments.bookingId, bookingId),
                eq(payments.hotelId, hotelId)
            ));

        const paidAmount = parseFloat(paymentsResult?.total ?? '0');

        const subTotal = roomCharge + ordersTotal;
        const serviceCharge = subTotal * serviceChargeRate;
        const vat = (subTotal + serviceCharge) * taxRate;
        const grandTotal = subTotal + serviceCharge + vat;
        const creditBalance = parseFloat(booking.creditBalance || '0');
        const dueAmount = Math.max(0, grandTotal - paidAmount - creditBalance);

        return {
            roomCharge,
            ordersTotal,
            subTotal,
            serviceChargeRate,
            serviceCharge,
            taxRate,
            vat,
            grandTotal,
            paidAmount,
            creditBalance,
            dueAmount
        };
    },

    /**
     * Calculate billing summary for a room (finds active booking)
     */
    async calculateRoomBillingSummary(hotelId: number, roomId: number): Promise<BillingSummary & { bookingId: string }> {
        const currentBooking = await BookingsService.findActiveByRoom(hotelId, roomId);

        const summary = await this.calculateBillingSummary(hotelId, currentBooking.id);
        return { ...summary, bookingId: currentBooking.id };
    },

    /**
     * Guest-facing bill: authoritative summary totals + an itemized breakdown
     * (folio room charges + F&B orders) so the guest can see every charge live,
     * including orders that are placed but not yet served (shown as PENDING).
     */
    async getGuestBill(hotelId: number, roomId: number): Promise<
        BillingSummary & { bookingId: string; lineItems: GuestBillLineItem[]; pendingOrdersTotal: number }
    > {
        const currentBooking = await BookingsService.findActiveByRoom(hotelId, roomId);
        const summary = await this.calculateBillingSummary(hotelId, currentBooking.id);

        const [charges, bookingOrders] = await Promise.all([
            db.query.folioCharges.findMany({
                where: eq(folioCharges.bookingId, currentBooking.id),
                orderBy: [desc(folioCharges.date)],
            }),
            db.query.orders.findMany({
                where: and(
                    eq(orders.bookingId, currentBooking.id),
                    eq(orders.hotelId, hotelId)
                ),
                with: { items: true },
                orderBy: [desc(orders.createdAt)],
            }),
        ]);

        const lineItems: GuestBillLineItem[] = [];
        const chargedOrderIds = new Set(charges.filter(c => c.orderId).map(c => c.orderId as string));

        // Exclude order-linked folio charges — they are represented by the order items below,
        // so including them here would double-bill against the summary totals.
        for (const c of charges) {
            if (c.orderId) continue;
            lineItems.push({
                id: `charge-${c.id}`,
                category: c.type || 'ROOM_CHARGE',
                description: c.description,
                amount: parseFloat(c.amount),
                date: (c.date as any) ?? new Date().toISOString(),
                status: 'BILLED',
            });
        }

        let pendingOrdersTotal = 0;
        for (const o of bookingOrders) {
            if (o.status === 'CANCELLED') continue;
            if (chargedOrderIds.has(o.id)) continue; // already represented as a folio charge
            const isBilled = o.status === 'SERVED';
            const amount = parseFloat(o.totalAmount || o.subTotal || '0');
            if (!isBilled) pendingOrdersTotal += amount;
            lineItems.push({
                id: `order-${o.id}`,
                category: 'FOOD',
                description: `Order #${o.orderNumber} (${o.items.length} item${o.items.length === 1 ? '' : 's'})`,
                amount,
                date: (o.createdAt as any) ?? new Date().toISOString(),
                status: isBilled ? 'BILLED' : 'PENDING',
            });
        }

        return { ...summary, bookingId: currentBooking.id, lineItems, pendingOrdersTotal };
    }
};
