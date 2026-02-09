import { db } from '../../db';
import { facilities } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { NotFoundError } from '../../utils/errors';

export const FacilitiesService = {
    async getAllFacilities(hotelId: number) {
        return await db.query.facilities.findMany({
            where: eq(facilities.hotelId, hotelId)
        });
    },

    async createFacility(hotelId: number, data: { name: string; type: string; location: string | null; description: string | null; status: any; openTime: string; closeTime: string }) {
        const [newFacility] = await db.insert(facilities).values({
            hotelId,
            ...data
        }).returning();
        return newFacility;
    },

    async updateFacility(hotelId: number, facilityId: number, data: any) {
        const [updated] = await db.update(facilities)
            .set({ ...data, updatedAt: new Date() })
            .where(and(eq(facilities.id, facilityId), eq(facilities.hotelId, hotelId)))
            .returning();
        if (!updated) throw new NotFoundError('Facility');
        return updated;
    },

    async deleteFacility(hotelId: number, facilityId: number) {
        const [deleted] = await db.delete(facilities)
            .where(and(eq(facilities.id, facilityId), eq(facilities.hotelId, hotelId)))
            .returning();
        if (!deleted) throw new NotFoundError('Facility');
        return deleted;
    }
};
