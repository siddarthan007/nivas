import { db } from '../../db';
import { restaurantTables } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { NotFoundError, BusinessLogicError } from '../../utils/errors';

export const TablesService = {
    async getAllTables(hotelId: number) {
        return await db.query.restaurantTables.findMany({
            where: eq(restaurantTables.hotelId, hotelId),
            orderBy: (t, { asc }) => [asc(t.tableNumber)]
        });
    },

    async createTable(hotelId: number, data: {
        tableNumber: string;
        capacity: number;
        location: string;
        status?: string;
    }) {
        // Check for duplicate table number
        const existing = await db.query.restaurantTables.findFirst({
            where: and(
                eq(restaurantTables.hotelId, hotelId),
                eq(restaurantTables.tableNumber, data.tableNumber)
            )
        });

        if (existing) {
            throw new BusinessLogicError(`Table ${data.tableNumber} already exists`);
        }

        const [newTable] = await db.insert(restaurantTables).values({
            hotelId,
            tableNumber: data.tableNumber,
            capacity: data.capacity,
            location: data.location || 'MAIN_HALL',
            status: data.status || 'AVAILABLE',
            layoutProps: { x: 0, y: 0, w: 100, h: 100 } // Default layout
        }).returning();

        return newTable;
    },

    async updateTable(hotelId: number, id: number, data: Partial<{
        tableNumber: string;
        capacity: number;
        location: string;
        status: string;
    }>) {
        const [updated] = await db.update(restaurantTables)
            .set({
                ...data,
                updatedAt: new Date()
            })
            .where(and(
                eq(restaurantTables.id, id),
                eq(restaurantTables.hotelId, hotelId)
            ))
            .returning();

        if (!updated) throw new NotFoundError('Table');
        return updated;
    },

    async deleteTable(hotelId: number, id: number) {
        const [deleted] = await db.delete(restaurantTables)
            .where(and(
                eq(restaurantTables.id, id),
                eq(restaurantTables.hotelId, hotelId)
            ))
            .returning();

        if (!deleted) throw new NotFoundError('Table');
        return deleted;
    }
};
