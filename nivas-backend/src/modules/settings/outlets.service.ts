import { db } from '../../db';
import { outlets } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { NotFoundError } from '../../utils/errors';

export const OutletsService = {
    async getOutlets(hotelId: number) {
        return await db.query.outlets.findMany({
            where: eq(outlets.hotelId, hotelId)
        });
    },

    async createOutlet(hotelId: number, data: { name: string; type: any }) {
        const [newOutlet] = await db.insert(outlets).values({
            hotelId,
            name: data.name,
            type: data.type,
            isActive: true
        }).returning();
        return newOutlet;
    },

    async updateOutlet(hotelId: number, outletId: number, data: { name?: string; type?: any; isActive?: boolean }) {
        const updateData: Record<string, any> = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.type !== undefined) updateData.type = data.type;
        if (data.isActive !== undefined) updateData.isActive = data.isActive;

        const [updated] = await db.update(outlets)
            .set(updateData)
            .where(and(eq(outlets.id, outletId), eq(outlets.hotelId, hotelId)))
            .returning();
        if (!updated) throw new NotFoundError('Outlet');
        return updated;
    },

    async deleteOutlet(hotelId: number, outletId: number) {
        const [deleted] = await db.delete(outlets)
            .where(and(eq(outlets.id, outletId), eq(outlets.hotelId, hotelId)))
            .returning();
        if (!deleted) throw new NotFoundError('Outlet');
        return deleted;
    }
};
