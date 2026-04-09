import { db } from '../../db';
import { folioCharges, payments, bookings } from '../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
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
            with: { room: true },
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

        const totalCharges = charges.reduce((sum, charge) => sum + parseFloat(charge.amount), 0);
        const totalPayments = bookingPayments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);

        return {
            booking,
            charges,
            payments: bookingPayments,
            summary: {
                totalCharges,
                totalPayments,
                balance: totalCharges - totalPayments,
            },
        };
    }

    static async updateCharge(hotelId: number, chargeId: number, data: {
        description?: string;
        amount?: number;
        type?: string;
    }) {
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

        await db.delete(folioCharges)
            .where(and(eq(folioCharges.id, chargeId), eq(folioCharges.hotelId, hotelId)));

        await AuditService.log(hotelId, userId, 'VOID_FOLIO_CHARGE', 'FOLIO', chargeId.toString(), {
            description: existing.description,
            amount: existing.amount,
        }, ipAddress);
    }
}

