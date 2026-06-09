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
        layoutProps?: any;
    }>) {
        const updateData: Record<string, any> = { updatedAt: new Date() };
        if (data.tableNumber !== undefined) updateData.tableNumber = data.tableNumber;
        if (data.capacity !== undefined) updateData.capacity = data.capacity;
        if (data.location !== undefined) updateData.location = data.location;
        if (data.status !== undefined) updateData.status = data.status;
        if (data.layoutProps !== undefined) updateData.layoutProps = data.layoutProps;

        const [updated] = await db.update(restaurantTables)
            .set(updateData)
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
    },

    async attachGuest(hotelId: number, tableId: number, data: {
        guestName: string;
        guestId?: string;
        phone?: string;
    }) {
        const table = await db.query.restaurantTables.findFirst({
            where: and(
                eq(restaurantTables.id, tableId),
                eq(restaurantTables.hotelId, hotelId)
            )
        });

        if (!table) throw new NotFoundError('Table');

        const existingProps = (table.layoutProps as any) || {};

        const [updated] = await db.update(restaurantTables)
            .set({
                status: 'OCCUPIED',
                layoutProps: {
                    ...existingProps,
                    guestName: data.guestName,
                    guestId: data.guestId || null,
                    guestPhone: data.phone || null,
                    attachedAt: new Date().toISOString(),
                },
                updatedAt: new Date(),
            })
            .where(and(
                eq(restaurantTables.id, tableId),
                eq(restaurantTables.hotelId, hotelId)
            ))
            .returning();

        return updated;
    },

    async detachGuest(hotelId: number, tableId: number) {
        const table = await db.query.restaurantTables.findFirst({
            where: and(
                eq(restaurantTables.id, tableId),
                eq(restaurantTables.hotelId, hotelId)
            )
        });

        if (!table) throw new NotFoundError('Table');

        const existingProps = (table.layoutProps as any) || {};
        // Remove guest info but keep layout positioning
        const { guestName, guestId, guestPhone, attachedAt, ...layoutOnly } = existingProps;

        const [updated] = await db.update(restaurantTables)
            .set({
                status: 'AVAILABLE',
                layoutProps: layoutOnly,
                updatedAt: new Date(),
            })
            .where(and(
                eq(restaurantTables.id, tableId),
                eq(restaurantTables.hotelId, hotelId)
            ))
            .returning();

        return updated;
    }
};
