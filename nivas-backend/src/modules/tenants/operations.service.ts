import { db } from '../../db';
import { floors, rooms } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { NotFoundError } from '../../utils/errors';

export const OperationsService = {
    async createFloor(hotelId: number, data: { name: string; number: number }) {
        const [newFloor] = await db.insert(floors).values({
            hotelId,
            name: data.name,
            number: data.number,
        }).returning();
        return newFloor;
    },

    async getAllFloors(hotelId: number) {
        return await db.query.floors.findMany({
            where: eq(floors.hotelId, hotelId)
        });
    },

    async createRoom(hotelId: number, data: { floorId: number; number: number; name: string; type: string; rate: number; status?: string }) {
        const qrSecret = crypto.randomUUID();

        const [newRoom] = await db.insert(rooms).values({
            hotelId,
            floorId: data.floorId,
            number: data.number,
            name: data.name,
            type: data.type,
            rate: data.rate.toString(),
            status: data.status || 'AVAILABLE',
            qrToken: qrSecret,
        }).returning();

        return {
            room: newRoom,
            qrLink: `${process.env.GUEST_PORTAL_URL || 'https://app.nivaspms.com'}/guest/login?token=${qrSecret}`
        };
    },

    async getAllRooms(hotelId: number, includeBookings: boolean = false) {
        return await db.query.rooms.findMany({
            where: eq(rooms.hotelId, hotelId),
            with: includeBookings ? { bookings: true } : undefined
        });
    },

    async updateRoomStatus(hotelId: number, roomId: number, status: string) {
        const [updatedRoom] = await db.update(rooms)
            .set({
                status,
                updatedAt: new Date()
            })
            .where(and(
                eq(rooms.id, roomId),
                eq(rooms.hotelId, hotelId)
            ))
            .returning();

        if (!updatedRoom) throw new NotFoundError('Room');
        return updatedRoom;
    },

    async updateFloor(hotelId: number, floorId: number, data: { name?: string; number?: number }) {
        const updateData: Record<string, any> = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.number !== undefined) updateData.number = data.number;

        const [updated] = await db.update(floors)
            .set(updateData)
            .where(and(eq(floors.id, floorId), eq(floors.hotelId, hotelId)))
            .returning();
        if (!updated) throw new NotFoundError('Floor');
        return updated;
    },

    async deleteFloor(hotelId: number, floorId: number) {
        const [deleted] = await db.delete(floors)
            .where(and(eq(floors.id, floorId), eq(floors.hotelId, hotelId)))
            .returning();
        if (!deleted) throw new NotFoundError('Floor');
        return deleted;
    },

    async updateGuestPin(roomId: number, pin: string) {
        const [updatedRoom] = await db.update(rooms)
            .set({
                currentGuestPin: pin,
                updatedAt: new Date()
            })
            .where(eq(rooms.id, roomId))
            .returning();

        if (!updatedRoom) throw new NotFoundError('Room');
        return updatedRoom;
    }
};
