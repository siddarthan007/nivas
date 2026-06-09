import { db } from '../../db';
import { payments, bookings, orders, folioCharges, invoices } from '../../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { BusinessLogicError, NotFoundError } from '../../utils/errors';
import { AuditService } from '../system/audit.service';
import { GLService } from './gl.service';
import { syncTableStatus } from '../operations/table-status.service';

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

            // Smart isPaid: only mark paid if cumulative payments cover totalAmount
            if (data.bookingId) {
                const booking = await tx.query.bookings.findFirst({
                    where: and(eq(bookings.id, data.bookingId), eq(bookings.hotelId, hotelId)),
                    columns: { totalAmount: true }
                });
                const [payResult] = await tx.select({ total: sql<string>`COALESCE(SUM(${payments.amount}),0)` })
                    .from(payments)
                    .where(and(eq(payments.bookingId, data.bookingId), eq(payments.hotelId, hotelId)));
                const cumulative = parseFloat(payResult?.total || '0');
                const totalAmt = parseFloat(booking?.totalAmount || '0');
                if (cumulative >= totalAmt && totalAmt > 0) {
                    await tx.update(bookings)
                        .set({ isPaid: true, updatedAt: new Date() })
                        .where(and(eq(bookings.id, data.bookingId), eq(bookings.hotelId, hotelId)));
                    // Settle the booking's outstanding (CREDIT) invoice → PAID.
                    await tx.update(invoices)
                        .set({ paymentStatus: 'PAID' })
                        .where(and(
                            eq(invoices.bookingId, data.bookingId),
                            eq(invoices.hotelId, hotelId),
                            eq(invoices.paymentStatus, 'CREDIT'),
                        ));
                }
            }

            // Auto-post to GL
            const cashAccount = await GLService.getOrCreateControlAccount(hotelId, '1000', 'Cash', 'ASSET', tx);
            const bankAccount = await GLService.getOrCreateControlAccount(hotelId, '1010', 'Bank', 'ASSET', tx);
            const isCash = (data.paymentMethod as string).toLowerCase() === 'cash';
            const debitAccount = isCash ? cashAccount : bankAccount;

            let lines: { accountId: number; debit: number; credit: number; description: string }[];
            if (data.orderId) {
                // Order payment: Debit Cash/Bank, Credit F&B Revenue
                const revAccount = await GLService.getOrCreateControlAccount(hotelId, '4100', 'F&B Revenue', 'REVENUE', tx);
                lines = [
                    { accountId: debitAccount!.id, debit: data.amount, credit: 0, description: `Order payment via ${data.paymentMethod}` },
                    { accountId: revAccount!.id, debit: 0, credit: data.amount, description: 'F&B Revenue' }
                ];
            } else {
                // Booking payment: Debit Cash/Bank, Credit AR
                const arAccount = await GLService.getOrCreateControlAccount(hotelId, '1100', 'Accounts Receivable', 'ASSET', tx);
                lines = [
                    { accountId: debitAccount!.id, debit: data.amount, credit: 0, description: `Payment via ${data.paymentMethod}` },
                    { accountId: arAccount!.id, debit: 0, credit: data.amount, description: 'AR Credit' }
                ];
            }

            await GLService.postJournalEntry(
                hotelId,
                userId,
                new Date().toISOString().split('T')[0] as string,
                `Payment Received via ${data.paymentMethod}`,
                payment!.id,
                lines,
                tx
            );

            // Paying off an order marks it PAID (+ may free its dine-in table).
            if (data.orderId) {
                const ord = await tx.query.orders.findFirst({
                    where: and(eq(orders.id, data.orderId), eq(orders.hotelId, hotelId)),
                    columns: { restaurantTableId: true },
                });
                await tx.update(orders).set({ paymentStatus: 'PAID' }).where(and(eq(orders.id, data.orderId), eq(orders.hotelId, hotelId)));
                if (ord?.restaurantTableId) {
                    await syncTableStatus(tx, hotelId, ord.restaurantTableId);
                }
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
        const reversalPayment = await db.transaction(async (tx) => {
            const existing = await tx.query.payments.findFirst({
                where: and(eq(payments.id, paymentId), eq(payments.hotelId, hotelId))
            });

            if (!existing) throw new NotFoundError('Payment');

            const originalAmount = parseFloat(existing.amount);
            // Can't void a reversal / non-positive payment.
            if (originalAmount <= 0) {
                throw new BusinessLogicError('This payment cannot be voided (it is a reversal or has no value)');
            }
            // Idempotency: a payment can only be voided once.
            const alreadyVoided = await tx.query.payments.findFirst({
                where: and(eq(payments.hotelId, hotelId), eq(payments.transactionId, `VOID-${existing.id}`))
            });
            if (alreadyVoided) {
                throw new BusinessLogicError('This payment has already been voided');
            }

            const [reversal] = await tx.insert(payments).values({
                hotelId,
                bookingId: existing.bookingId,
                orderId: existing.orderId,
                amount: (-originalAmount).toString(),
                paymentMethod: existing.paymentMethod,
                transactionId: `VOID-${existing.id}`,
                notes: `Void of payment ${existing.id}${reason ? ': ' + reason : ''}`,
                recordedById: userId
            }).returning();

            if (!reversal) {
                throw new BusinessLogicError('Failed to create reversal payment');
            }

            // Reverse GL: swap debits and credits (atomic with the reversal payment)
            const cashAccount = await GLService.getOrCreateControlAccount(hotelId, '1000', 'Cash', 'ASSET', tx);
            const bankAccount = await GLService.getOrCreateControlAccount(hotelId, '1010', 'Bank', 'ASSET', tx);
            const arAccount = await GLService.getOrCreateControlAccount(hotelId, '1100', 'Accounts Receivable', 'ASSET', tx);
            const revAccount = await GLService.getOrCreateControlAccount(hotelId, '4100', 'F&B Revenue', 'REVENUE', tx);
            const isCash = (existing.paymentMethod as string).toLowerCase() === 'cash';
            const debitAccount = isCash ? cashAccount : bankAccount;
            const creditAccount = existing.orderId ? revAccount : arAccount;

            await GLService.postJournalEntry(
                hotelId,
                userId,
                new Date().toISOString().split('T')[0] as string,
                `Void Payment ${existing.id}${reason ? ': ' + reason : ''}`,
                `VOID-${existing.id}`,
                [
                    { accountId: debitAccount!.id, debit: 0, credit: originalAmount, description: 'Reverse cash/bank' },
                    { accountId: creditAccount!.id, debit: originalAmount, credit: 0, description: 'Reverse revenue/AR' }
                ],
                tx
            );

            await AuditService.log(hotelId, userId, 'VOID_PAYMENT', 'PAYMENT', paymentId, {
                originalAmount: existing.amount,
                reason: reason || 'No reason provided',
                reversalId: reversal.id
            }, ipAddress);

            return reversal;
        });

        return reversalPayment;
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
                where: and(eq(folioCharges.hotelId, hotelId), sql`${folioCharges.bookingId} IN ${bookingIds}`)
            });
        }

        // Get payments using proper query
        let guestPayments: any[] = [];
        if (bookingIds.length > 0 || orderIds.length > 0) {
            guestPayments = await db.query.payments.findMany({
                where: and(
                    eq(payments.hotelId, hotelId),
                    sql`${payments.bookingId} IN ${bookingIds} OR ${payments.orderId} IN ${orderIds}`
                ),
                orderBy: (p, { desc }) => [desc(p.createdAt)]
            });
        }

        const totalCharges = folioList.reduce((sum, c) => sum + parseFloat(c.amount || '0'), 0)
                           + guestOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount || '0'), 0);
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

