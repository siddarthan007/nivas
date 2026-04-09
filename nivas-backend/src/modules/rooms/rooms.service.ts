import { db } from '../../db';
import { rooms } from '../../db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { NotFoundError } from '../../utils/errors';
import { logger } from '../../shared/logger';

export class RoomsService {
    static async getRooms(hotelId: number) {
        return await db.query.rooms.findMany({
            where: eq(rooms.hotelId, hotelId),
            orderBy: (rooms, { asc }) => [asc(rooms.number)]
        });
    }

    static async getRoomById(hotelId: number, roomId: number) {
        const room = await db.query.rooms.findFirst({
            where: and(eq(rooms.id, roomId), eq(rooms.hotelId, hotelId))
        });
        if (!room) throw new NotFoundError('Room');
        return room;
    }

    static async createRoom(hotelId: number, data: {
        number: number;
        name?: string;
        type: string;
        rate: number;
    }) {
        const [newRoom] = await db.insert(rooms).values({
            hotelId,
            number: data.number,
            name: data.name,
            type: data.type,
            rate: data.rate.toString(),
            status: 'AVAILABLE'
        }).returning();

        return newRoom;
    }

    static async bulkCreateRooms(hotelId: number, data: {
        number: number;
        name?: string;
        type: string;
        rate: number;
    }[]) {
        if (data.length === 0) return { count: 0, ids: [] };

        const roomsToInsert = data.map(r => ({
            hotelId,
            number: r.number,
            name: r.name,
            type: r.type,
            rate: r.rate.toString(),
            status: 'AVAILABLE'
        }));

        const inserted = await db.insert(rooms).values(roomsToInsert).returning();

        return {
            count: inserted.length,
            ids: inserted.map(r => r.id)
        };
    }

    static async updateRoom(hotelId: number, roomId: number, data: {
        number?: number;
        name?: string;
        type?: string;
        rate?: number;
        status?: string;
    }) {
        const [updated] = await db.update(rooms)
            .set({
                number: data.number,
                name: data.name,
                type: data.type,
                rate: data.rate?.toString(),
                status: data.status,
                updatedAt: new Date()
            })
            .where(and(
                eq(rooms.id, roomId),
                eq(rooms.hotelId, hotelId)
            ))
            .returning();

        if (!updated) throw new NotFoundError('Room');

        return updated;
    }

    static async deleteRoom(hotelId: number, roomId: number) {
        const [deleted] = await db.delete(rooms)
            .where(and(
                eq(rooms.id, roomId),
                eq(rooms.hotelId, hotelId)
            ))
            .returning();

        if (!deleted) throw new NotFoundError('Room');

        return deleted;
    }
}
