import { db } from '../../db';
import { kots, kotItems } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { NotFoundError } from '../../utils/errors';

export const KotService = {
    async createKot(hotelId: number, userId: string, data: { orderId: number; type: any; items: any[]; notes: string | null }) {
        return await db.transaction(async (tx) => {
            const [kot] = await tx.insert(kots).values({
                hotelId,
                orderId: data.orderId,
                status: 'PENDING', // Default KOT status
                type: data.type,
                notes: data.notes,
                createdBy: userId
            }).returning();

            if (data.items && data.items.length > 0) {
                await tx.insert(kotItems).values(
                    data.items.map((item: any) => ({
                        kotId: kot.id,
                        menuItemId: item.menuItemId,
                        quantity: item.quantity,
                        notes: item.notes,
                        status: 'PENDING'
                    }))
                );
            }

            return kot;
        });
    },

    async updateKotStatus(hotelId: number, kotId: number, status: any) {
        const [updated] = await db.update(kots)
            .set({ status, updatedAt: new Date() })
            .where(eq(kots.id, kotId))
            .returning();

        if (!updated) throw new NotFoundError('KOT');
        return updated;
    },

    async updateKotItemStatus(hotelId: number, itemId: number, status: any) {
        const [updated] = await db.update(kotItems)
            .set({ status })
            .where(eq(kotItems.id, itemId))
            .returning();

        if (!updated) throw new NotFoundError('KOT Item');
        return updated;
    }
};
