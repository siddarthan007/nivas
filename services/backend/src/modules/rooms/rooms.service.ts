import { db } from '../../db';
import { rooms } from '../../db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { NotFoundError } from '../../utils/errors';
import { PlanLimitsService } from '../saas/plan-limits.service';

export const RoomsService = {
    async getRooms(hotelId: number) {
        return db.query.rooms.findMany({
            where: eq(rooms.hotelId, hotelId),
            orderBy: [asc(rooms.floorNumber), asc(rooms.number)],
        });
    },

    async getRoomById(hotelId: number, roomId: number) {
        const room = await db.query.rooms.findFirst({
            where: and(eq(rooms.id, roomId), eq(rooms.hotelId, hotelId)),
        });
        if (!room) throw new NotFoundError('Room');
        return room;
    },

    async createRoom(hotelId: number, data: {
        number: number;
        name?: string;
        type?: string;
        rate?: number;
        floorId?: number;
        floorNumber?: number;
        capacity?: number;
        imageUrl?: string;
    }) {
        await PlanLimitsService.assertCanAddRooms(hotelId, 1);
        const [room] = await db.insert(rooms).values({
            hotelId,
            number: data.number,
            name: data.name,
            type: data.type ?? 'STANDARD',
            rate: (data.rate ?? 0).toString(),
            floorId: data.floorId,
            floorNumber: data.floorNumber,
            capacity: data.capacity ?? 2,
            imageUrl: data.imageUrl,
            status: 'AVAILABLE',
        }).returning();
        return room;
    },

    async bulkCreateRooms(hotelId: number, items: { number: number; name?: string; type?: string; rate?: number }[]) {
        await PlanLimitsService.assertCanAddRooms(hotelId, items.length);
        const created = await db.insert(rooms).values(
            items.map(item => ({
                hotelId,
                number: item.number,
                name: item.name,
                type: item.type ?? 'STANDARD',
                rate: (item.rate ?? 0).toString(),
                status: 'AVAILABLE',
            }))
        ).returning();
        return created;
    },

    async updateRoom(hotelId: number, roomId: number, data: Record<string, unknown>) {
        const allowed = ['number', 'name', 'type', 'rate', 'status', 'floorId', 'floorNumber', 'capacity', 'imageUrl'];
        const patch: Record<string, unknown> = { updatedAt: new Date() };
        for (const key of allowed) {
            if (data[key] !== undefined) {
                patch[key] = key === 'rate' ? String(data[key]) : data[key];
            }
        }
        const [updated] = await db.update(rooms)
            .set(patch)
            .where(and(eq(rooms.id, roomId), eq(rooms.hotelId, hotelId)))
            .returning();
        if (!updated) throw new NotFoundError('Room');
        return updated;
    },

    async deleteRoom(hotelId: number, roomId: number) {
        const [deleted] = await db.delete(rooms)
            .where(and(eq(rooms.id, roomId), eq(rooms.hotelId, hotelId)))
            .returning();
        if (!deleted) throw new NotFoundError('Room');
        return deleted;
    },
};
