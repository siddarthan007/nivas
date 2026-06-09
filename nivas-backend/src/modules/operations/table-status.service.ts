import { db } from '../../db';
import { restaurantTables, orders, payments } from '../../db/schema';
import { eq, and, ne, sql } from 'drizzle-orm';

/**
 * Automatic restaurant-table occupancy, driven by the order lifecycle.
 *
 * A table is OCCUPIED while it has at least one non-cancelled order that isn't
 * fully paid. It frees (AVAILABLE) once every order on it is paid or cancelled.
 * Using payment (not "SERVED") as the free-trigger matches reality: a served
 * but unpaid table is still occupied by the diners.
 *
 * All helpers accept a tx so they run inside the caller's transaction.
 */

type Tx = typeof db | any;

export async function occupyTable(tx: Tx, hotelId: number, tableId?: number | null) {
    if (!tableId) return;
    await tx.update(restaurantTables)
        .set({ status: 'OCCUPIED', updatedAt: new Date() })
        .where(and(eq(restaurantTables.id, tableId), eq(restaurantTables.hotelId, hotelId)));
}

/** Recompute a table's status from its outstanding orders. */
export async function syncTableStatus(tx: Tx, hotelId: number, tableId?: number | null) {
    if (!tableId) return;

    const liveOrders = await tx.query.orders.findMany({
        where: and(
            eq(orders.restaurantTableId, tableId),
            eq(orders.hotelId, hotelId),
            ne(orders.status, 'CANCELLED'),
        ),
        columns: { id: true, totalAmount: true },
    });

    let busy = false;
    for (const o of liveOrders) {
        const [paid] = await tx.select({ total: sql<string>`COALESCE(SUM(${payments.amount}),0)` })
            .from(payments)
            .where(eq(payments.orderId, o.id));
        if (parseFloat(paid?.total || '0') < parseFloat(o.totalAmount || '0')) {
            busy = true;
            break;
        }
    }

    await tx.update(restaurantTables)
        .set({ status: busy ? 'OCCUPIED' : 'AVAILABLE', updatedAt: new Date() })
        .where(and(eq(restaurantTables.id, tableId), eq(restaurantTables.hotelId, hotelId)));
}
