import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../db';
import { orders, payments } from '../../db/schema';

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Reconcile order.paymentStatus from cumulative payments vs tax-inclusive total. */
export async function syncOrderPaymentStatus(tx: DbTx, hotelId: number, orderId: string) {
    const order = await tx.query.orders.findFirst({
        where: and(eq(orders.id, orderId), eq(orders.hotelId, hotelId)),
        columns: { totalAmount: true, paymentStatus: true },
    });
    if (!order) return;

    const [payResult] = await tx
        .select({ total: sql<string>`COALESCE(SUM(${payments.amount}), 0)` })
        .from(payments)
        .where(and(eq(payments.orderId, orderId), eq(payments.hotelId, hotelId)));

    const paid = parseFloat(payResult?.total || '0');
    const due = parseFloat(order.totalAmount || '0');

    let nextStatus: 'UNPAID' | 'PARTIAL' | 'PAID' = 'UNPAID';
    if (due <= 0.01) {
        nextStatus = 'PAID';
    } else if (paid >= due - 0.01) {
        nextStatus = 'PAID';
    } else if (paid > 0.01) {
        nextStatus = 'PARTIAL';
    }

    if (nextStatus !== order.paymentStatus) {
        await tx
            .update(orders)
            .set({ paymentStatus: nextStatus, updatedAt: new Date() })
            .where(and(eq(orders.id, orderId), eq(orders.hotelId, hotelId)));
    }
}
