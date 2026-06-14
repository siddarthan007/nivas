import { db } from '../../db';
import { roomTypes } from '../../db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { NotFoundError } from '../../utils/errors';

const DEFAULT_ROOM_TYPES = [
    { name: 'Standard', code: 'STANDARD', description: 'Standard room', baseRate: '0', sortOrder: 0 },
    { name: 'Deluxe', code: 'DELUXE', description: 'Deluxe room', baseRate: '0', sortOrder: 1 },
    { name: 'Suite', code: 'SUITE', description: 'Suite', baseRate: '0', sortOrder: 2 },
];

export const RoomTypesService = {
    async getByHotel(hotelId: number) {
        return db.query.roomTypes.findMany({
            where: eq(roomTypes.hotelId, hotelId),
            orderBy: [asc(roomTypes.sortOrder)],
        });
    },

    async seedDefaults(hotelId: number) {
        const existing = await db.query.roomTypes.findMany({
            where: eq(roomTypes.hotelId, hotelId),
        });
        if (existing.length > 0) return existing;

        const inserted: Awaited<ReturnType<typeof db.query.roomTypes.findMany>> = [];
        for (const roomType of DEFAULT_ROOM_TYPES) {
            const [row] = await db.insert(roomTypes).values({ hotelId, ...roomType }).returning();
            if (row) {
                inserted.push(row);
            }
        }
        return inserted;
    },

    async create(hotelId: number, data: { name: string; code: string; description?: string; baseRate?: string }) {
        const [row] = await db.insert(roomTypes).values({
            hotelId,
            name: data.name,
            code: data.code.toUpperCase().replace(/\s+/g, '_'),
            description: data.description,
            baseRate: data.baseRate || '0',
        }).returning();
        return row;
    },

    async update(hotelId: number, id: number, data: { name?: string; code?: string; description?: string; baseRate?: string; isActive?: boolean; sortOrder?: number }) {
        const existing = await db.query.roomTypes.findFirst({
            where: and(eq(roomTypes.id, id), eq(roomTypes.hotelId, hotelId))
        });
        if (!existing) throw new NotFoundError('Room Type');

        const updatePayload: Record<string, any> = { updatedAt: new Date() };
        if (data.name !== undefined) updatePayload.name = data.name;
        if (data.code !== undefined) updatePayload.code = data.code.toUpperCase().replace(/\s+/g, '_');
        if (data.description !== undefined) updatePayload.description = data.description;
        if (data.baseRate !== undefined) updatePayload.baseRate = data.baseRate;
        if (data.isActive !== undefined) updatePayload.isActive = data.isActive;
        if (data.sortOrder !== undefined) updatePayload.sortOrder = data.sortOrder;

        const [updated] = await db.update(roomTypes)
            .set(updatePayload)
            .where(and(eq(roomTypes.id, id), eq(roomTypes.hotelId, hotelId)))
            .returning();
        return updated;
    },

    async remove(hotelId: number, id: number) {
        const existing = await db.query.roomTypes.findFirst({
            where: and(eq(roomTypes.id, id), eq(roomTypes.hotelId, hotelId))
        });
        if (!existing) throw new NotFoundError('Room Type');

        await db.delete(roomTypes).where(and(eq(roomTypes.id, id), eq(roomTypes.hotelId, hotelId)));
        return true;
    },
};

