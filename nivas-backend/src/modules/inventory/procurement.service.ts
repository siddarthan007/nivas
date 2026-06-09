import { db } from '../../db';
import { purchaseRequests, purchaseOrders } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { NotFoundError } from '../../utils/errors';

export const ProcurementService = {
    async getAllRequests(hotelId: number) {
        return await db.query.purchaseRequests.findMany({
            where: eq(purchaseRequests.hotelId, hotelId),
        });
    },

    async createRequest(hotelId: number, userId: string, data: { itemId: number; quantity: number; reason: string | null; priority: any }) {
        const [request] = await db.insert(purchaseRequests).values({
            ...data,
            hotelId,
            requesterId: userId,
            status: 'PENDING',
        }).returning();
        return request;
    },

    async updateRequestStatus(hotelId: number, requestId: number, status: any) {
        const [updated] = await db.update(purchaseRequests)
            .set({ status, updatedAt: new Date() })
            .where(and(eq(purchaseRequests.id, requestId), eq(purchaseRequests.hotelId, hotelId)))
            .returning();

        if (!updated) throw new NotFoundError('Purchase Request');
        return updated;
    },

    async createOrder(hotelId: number, data: { supplierName: string; items: unknown; totalCost?: number; notes?: string }) {
        const [order] = await db.insert(purchaseOrders).values({
            hotelId,
            poNumber: `PO-${Date.now()}`,
            supplierName: data.supplierName,
            totalCost: (data.totalCost ?? 0).toString(),
            status: 'DRAFT',
            notes: data.notes,
            items: data.items,
        }).returning();

        return order;
    },
};
