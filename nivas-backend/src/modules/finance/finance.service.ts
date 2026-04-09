import { db } from '../../db';
import { payments, bookings } from '../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { BusinessLogicError, NotFoundError } from '../../utils/errors';
import { AuditService } from '../system/audit.service';

export class FinanceService {
    static async recordPayment(hotelId: number, userId: string, data: { bookingId?: string; orderId?: string; amount: number; paymentMethod: any; transactionId?: string; notes?: string }, ipAddress?: string) {
        const newPayment = await db.transaction(async (tx) => {
            const [payment] = await tx.insert(payments).values({
                hotelId,
                bookingId: data.bookingId,
                orderId: data.orderId,
                amount: data.amount.toString(),
                paymentMethod: data.paymentMethod,
                transactionId: data.transactionId,
                notes: data.notes,
                recordedById: userId
            }).returning();

            // If payment covers full booking, optionally update booking status
            // This logic might need to be smarter (check totals), but keeping parity for now.
            if (data.bookingId) {
                await tx.update(bookings)
                    .set({ isPaid: true, updatedAt: new Date() })
                    .where(eq(bookings.id, data.bookingId));
            }

            return payment;
        });

        if (newPayment) {
            await AuditService.log(
                hotelId,
                userId,
                'RECORD_PAYMENT',
                'PAYMENT',
                newPayment.id,
                { amount: data.amount, paymentMethod: data.paymentMethod, bookingId: data.bookingId },
                ipAddress
            );
        }

        return newPayment;
    }

    static async getPayments(hotelId: number, limit: number = 50) {
        return await db.query.payments.findMany({
            where: eq(payments.hotelId, hotelId),
            with: {
                recordedBy: {
                    columns: { fullName: true }
                }
            },
            orderBy: (payments, { desc }) => [desc(payments.createdAt)],
            limit
        });
    }

    static async getPaymentById(hotelId: number, paymentId: string) {
        const payment = await db.query.payments.findFirst({
            where: and(
                eq(payments.id, paymentId),
                eq(payments.hotelId, hotelId)
            ),
            with: {
                recordedBy: {
                    columns: { fullName: true }
                }
            }
        });

        if (!payment) throw new NotFoundError('Payment');
        return payment;
    }

    static async voidPayment(hotelId: number, userId: string, paymentId: string, reason?: string, ipAddress?: string) {
        const existing = await db.query.payments.findFirst({
            where: and(eq(payments.id, paymentId), eq(payments.hotelId, hotelId))
        });

        if (!existing) throw new NotFoundError('Payment');

        const [reversalPayment] = await db.insert(payments).values({
            hotelId,
            bookingId: existing.bookingId,
            orderId: existing.orderId,
            amount: (-parseFloat(existing.amount)).toString(),
            paymentMethod: existing.paymentMethod,
            transactionId: `VOID-${existing.id}`,
            notes: `Void of payment ${existing.id}${reason ? ': ' + reason : ''}`,
            recordedById: userId
        }).returning();

        if (!reversalPayment) {
            throw new BusinessLogicError('Failed to create reversal payment');
        }

        await AuditService.log(hotelId, userId, 'VOID_PAYMENT', 'PAYMENT', paymentId, {
            originalAmount: existing.amount,
            reason: reason || 'No reason provided',
            reversalId: reversalPayment.id
        }, ipAddress);

        return reversalPayment;
    }
}

