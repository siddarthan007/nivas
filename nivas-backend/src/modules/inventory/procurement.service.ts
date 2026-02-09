import { db } from '../../db';
import { purchaseRequests, purchaseOrders } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { NotFoundError } from '../../utils/errors';

export const ProcurementService = {
    async getAllRequests(hotelId: number) {
        return await db.query.purchaseRequests.findMany({
            where: eq(purchaseRequests.hotelId, hotelId)
        });
    },

    async createRequest(hotelId: number, userId: string, data: { itemId: number; quantity: number; reason: string | null; priority: any }) {
        const [request] = await db.insert(purchaseRequests).values({
            hotelId,
            requesterId: userId,
            ...data,
            status: 'PENDING'
        }).returning();
        return request;
    },

    async updateRequestStatus(hotelId: number, requestId: number, status: any) {
        const [updated] = await db.update(purchaseRequests)
            .set({ status, updatedAt: new Date() })
            .where(eq(purchaseRequests.id, requestId))
            .returning();

        if (!updated) throw new NotFoundError('Purchase Request');
        return updated;
    },

    async createOrder(hotelId: number, data: { supplierId: number; items: any; totalAmount: number; expectedDeliveryDate: string }) {
        const [order] = await db.insert(purchaseOrders).values({
            hotelId,
            ...data,
            status: 'DRAFT',
            items: JSON.stringify(data.items)
        }).returning();
        return order;
    }
};
