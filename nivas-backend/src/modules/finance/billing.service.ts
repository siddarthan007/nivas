import { db } from '../../db';
import { bookings, orders, payments, hotels, folioCharges } from '../../db/schema';
import { eq, and, sum } from 'drizzle-orm';

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

        if (!hotel) throw new Error('Hotel not found');

        const serviceChargeRate = parseFloat(hotel.serviceChargeRate ?? '0.10');
        const taxRate = parseFloat(hotel.taxRate ?? '0.13');

        // Get booking
        const booking = await db.query.bookings.findFirst({
            where: eq(bookings.id, bookingId)
        });

        if (!booking) throw new Error('Booking not found');

        // Get room charges from folio (Night Audit + Manual Charges)
        const [chargesResult] = await db.select({ total: sum(folioCharges.amount) })
            .from(folioCharges)
            .where(eq(folioCharges.bookingId, bookingId));

        // Fallback to booking total if no folio charges exist (e.g. before first night audit)
        let roomCharge = parseFloat(chargesResult?.total ?? '0');
        if (roomCharge === 0 && booking.totalAmount) {
            roomCharge = parseFloat(booking.totalAmount);
        }

        // Get orders for this booking (Served only)
        const [ordersResult] = await db.select({ total: sum(orders.totalAmount) })
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
        const dueAmount = grandTotal - paidAmount;

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
            dueAmount
        };
    },

    /**
     * Calculate billing summary for a room (finds active booking)
     */
    async calculateRoomBillingSummary(hotelId: number, roomId: number): Promise<BillingSummary & { bookingId: string }> {
        const currentBooking = await db.query.bookings.findFirst({
            where: and(
                eq(bookings.roomId, roomId),
                eq(bookings.hotelId, hotelId),
                eq(bookings.status, 'CHECKED_IN')
            )
        });

        if (!currentBooking) throw new Error('No active booking found for this room');

        const summary = await this.calculateBillingSummary(hotelId, currentBooking.id);
        return { ...summary, bookingId: currentBooking.id };
    }
};
