import { db } from '../../db';
import { folioCharges, payments, bookings, orders } from '../../db/schema';
import { eq, and, desc, sql, inArray, or } from 'drizzle-orm';
import { NotFoundError, BusinessLogicError } from '../../utils/errors';
import { AuditService } from '../system/audit.service';

const todayIsoDate = () => new Date().toISOString().slice(0, 10);

export class FolioService {
    static async createCharge(hotelId: number, userId: string, data: {
        bookingId: string;
        description: string;
        amount: number;
        type?: string;
        date?: string;
    }, ipAddress?: string) {
        const booking = await db.query.bookings.findFirst({
            where: and(eq(bookings.id, data.bookingId), eq(bookings.hotelId, hotelId)),
        });
        if (!booking) throw new NotFoundError('Booking');
        // Don't add charges to a closed booking — they'd never make it onto the
        // (already generated) invoice and would orphan on the folio.
        if (booking.status === 'CHECKED_OUT' || booking.status === 'CANCELLED') {
            throw new BusinessLogicError(`Cannot add charges to a ${booking.status.toLowerCase()} booking`);
        }
        if (!data.amount || data.amount === 0) {
            throw new BusinessLogicError('Charge amount cannot be zero');
        }

        const [charge] = await db.insert(folioCharges).values({
            hotelId,
            bookingId: data.bookingId,
            description: data.description,
            amount: data.amount.toString(),
            type: data.type || 'MISCELLANEOUS',
            date: data.date || todayIsoDate(),
        }).returning();

        if (!charge) {
            throw new BusinessLogicError('Failed to create folio charge');
        }

        await AuditService.log(hotelId, userId, 'CREATE_FOLIO_CHARGE', 'FOLIO', charge.id.toString(), {
            bookingId: data.bookingId,
            description: data.description,
            amount: data.amount,
        }, ipAddress);

        return charge;
    }

    static async getBookingFolio(hotelId: number, bookingId: string) {
        const booking = await db.query.bookings.findFirst({
            where: and(eq(bookings.id, bookingId), eq(bookings.hotelId, hotelId)),
            with: { room: true, guest: true },
        });
        if (!booking) throw new NotFoundError('Booking');

        const charges = await db.query.folioCharges.findMany({
            where: and(eq(folioCharges.bookingId, bookingId), eq(folioCharges.hotelId, hotelId)),
            orderBy: (folioChargeTable, { asc }) => [asc(folioChargeTable.date)],
        });

        const bookingPayments = await db.query.payments.findMany({
            where: and(eq(payments.bookingId, bookingId), eq(payments.hotelId, hotelId)),
            with: {
                recordedBy: { columns: { fullName: true } },
            },
            orderBy: (paymentTable, { desc }) => [desc(paymentTable.createdAt)],
        });

        // Include orders linked to this booking (room service, restaurant, etc.)
        const bookingOrders = await db.query.orders.findMany({
            where: and(
                eq(orders.hotelId, hotelId),
                eq(orders.bookingId, bookingId)
            ),
            with: { items: true },
            orderBy: (o, { desc }) => [desc(o.createdAt)]
        });

        // Avoid double-counting: an order already posted as a folio charge
        // (folioCharges.orderId) must not be added again. Cancelled orders are
        // never billed.
        const chargedOrderIds = new Set(charges.filter(c => c.orderId).map(c => c.orderId as string));
        const billableOrders = bookingOrders.filter(
            o => o.status !== 'CANCELLED' && !chargedOrderIds.has(o.id)
        );

        const folioTotal = charges.reduce((sum, charge) => sum + parseFloat(charge.amount), 0);
        const ordersTotal = billableOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount || '0'), 0);
        const totalPayments = bookingPayments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);

        return {
            booking,
            charges,
            payments: bookingPayments,
            orders: bookingOrders,
            summary: {
                folioTotal,
                ordersTotal,
                totalCharges: folioTotal + ordersTotal,
                totalPayments,
                balance: folioTotal + ordersTotal - totalPayments,
            },
        };
    }

    static async updateCharge(hotelId: number, chargeId: number, data: {
        description?: string;
        amount?: number;
        type?: string;
    }) {
        const existing = await db.query.folioCharges.findFirst({
            where: and(eq(folioCharges.id, chargeId), eq(folioCharges.hotelId, hotelId)),
        });
        if (!existing) throw new NotFoundError('Folio charge');
        // Immutability: a charge already attached to an invoice can't change.
        if (existing.invoiceId) {
            throw new BusinessLogicError('This charge is already on an invoice and cannot be edited');
        }
        if (data.amount !== undefined && data.amount === 0) {
            throw new BusinessLogicError('Charge amount cannot be zero');
        }

        const updateData: Record<string, any> = {};
        if (data.description !== undefined) updateData.description = data.description;
        if (data.amount !== undefined) updateData.amount = data.amount.toString();
        if (data.type !== undefined) updateData.type = data.type;

        const [updated] = await db.update(folioCharges)
            .set(updateData)
            .where(and(eq(folioCharges.id, chargeId), eq(folioCharges.hotelId, hotelId)))
            .returning();

        if (!updated) throw new NotFoundError('Folio charge');
        return updated;
    }

    static async voidCharge(hotelId: number, userId: string, chargeId: number, ipAddress?: string) {
        const existing = await db.query.folioCharges.findFirst({
            where: and(eq(folioCharges.id, chargeId), eq(folioCharges.hotelId, hotelId)),
        });
        if (!existing) throw new NotFoundError('Folio charge');
        // Immutability: never delete a charge already billed on an invoice.
        if (existing.invoiceId) {
            throw new BusinessLogicError('This charge is already on an invoice and cannot be voided. Issue a credit note instead.');
        }

        await db.delete(folioCharges)
            .where(and(eq(folioCharges.id, chargeId), eq(folioCharges.hotelId, hotelId)));

        await AuditService.log(hotelId, userId, 'VOID_FOLIO_CHARGE', 'FOLIO', chargeId.toString(), {
            description: existing.description,
            amount: existing.amount,
        }, ipAddress);
    }

    /**
     * Move a folio charge to another booking — the primitive for splitting a bill
     * across guests (transfer specific charges to each payer's folio) and for
     * room transfers. Blocked once the charge is on an invoice.
     */
    static async moveCharge(hotelId: number, userId: string, chargeId: number, targetBookingId: string, ipAddress?: string) {
        const charge = await db.query.folioCharges.findFirst({
            where: and(eq(folioCharges.id, chargeId), eq(folioCharges.hotelId, hotelId)),
        });
        if (!charge) throw new NotFoundError('Folio charge');
        if (charge.invoiceId) {
            throw new BusinessLogicError('This charge is already on an invoice and cannot be moved');
        }
        if (charge.bookingId === targetBookingId) return charge;

        const target = await db.query.bookings.findFirst({
            where: and(eq(bookings.id, targetBookingId), eq(bookings.hotelId, hotelId)),
            columns: { id: true, status: true, guestName: true },
        });
        if (!target) throw new NotFoundError('Target booking');
        if (target.status === 'CHECKED_OUT' || target.status === 'CANCELLED') {
            throw new BusinessLogicError(`Cannot move a charge to a ${target.status.toLowerCase()} booking`);
        }

        const [updated] = await db.update(folioCharges)
            .set({ bookingId: targetBookingId })
            .where(and(eq(folioCharges.id, chargeId), eq(folioCharges.hotelId, hotelId)))
            .returning();

        await AuditService.log(hotelId, userId, 'MOVE_FOLIO_CHARGE', 'FOLIO', chargeId.toString(), {
            from: charge.bookingId, to: targetBookingId, amount: charge.amount, description: charge.description,
        }, ipAddress);
        return updated;
    }

    static async getCustomerFolio(hotelId: number, guestId: string) {
        // Fetch bookings linked to this guest
        const guestBookings = await db.query.bookings.findMany({
            where: and(eq(bookings.hotelId, hotelId), eq(bookings.guestId, guestId)),
            orderBy: (b, { desc }) => [desc(b.createdAt)]
        });

        // Fetch orders linked to this guest
        const guestOrders = await db.query.orders.findMany({
            where: and(eq(orders.hotelId, hotelId), eq(orders.guestId, guestId)),
            with: { items: true },
            orderBy: (o, { desc }) => [desc(o.createdAt)]
        });

        const bookingIds = guestBookings.map(b => b.id);
        const orderIds = guestOrders.map(o => o.id);

        // Get actual folio charges for all bookings
        let folioList: any[] = [];
        if (bookingIds.length > 0) {
            folioList = await db.query.folioCharges.findMany({
                where: and(eq(folioCharges.hotelId, hotelId), inArray(folioCharges.bookingId, bookingIds))
            });
        }

        // Get payments using proper query
        let guestPayments: any[] = [];
        if (bookingIds.length > 0 || orderIds.length > 0) {
            // inArray with an empty array yields invalid `IN ()` SQL — only add a
            // clause for the non-empty id sets.
            const idConds = [];
            if (bookingIds.length > 0) idConds.push(inArray(payments.bookingId, bookingIds));
            if (orderIds.length > 0) idConds.push(inArray(payments.orderId, orderIds));
            guestPayments = await db.query.payments.findMany({
                where: and(eq(payments.hotelId, hotelId), or(...idConds)),
                orderBy: (p, { desc }) => [desc(p.createdAt)]
            });
        }

        // An order can also be posted as a folio charge (folioCharges.orderId).
        // Count it once — exclude such orders from the order total to avoid
        // double-counting. Cancelled orders are never billed.
        const chargedOrderIds = new Set(
            folioList.filter(c => c.orderId).map(c => c.orderId as string)
        );
        const billableOrders = guestOrders.filter(
            o => o.status !== 'CANCELLED' && !chargedOrderIds.has(o.id)
        );

        const totalCharges = folioList.reduce((sum, c) => sum + parseFloat(c.amount || '0'), 0)
                           + billableOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount || '0'), 0);
        const totalPaid = guestPayments.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);

        return {
            bookings: guestBookings,
            orders: guestOrders,
            folioCharges: folioList,
            payments: guestPayments,
            summary: {
                totalCharges,
                totalPaid,
                balanceDue: totalCharges - totalPaid
            }
        };
    }
}
