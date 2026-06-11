import { db } from '../../db';
import { rooms, bookings } from '../../db/schema';
import { eq, and, asc, inArray } from 'drizzle-orm';
import { NotFoundError, BusinessLogicError } from '../../utils/errors';
import { logger } from '../../shared/logger';
import { StorageService } from '../storage/storage.service';

export class RoomsService {
    static async getRooms(hotelId: number) {
        const roomList = await db.query.rooms.findMany({
            where: eq(rooms.hotelId, hotelId),
            orderBy: (rooms, { asc }) => [asc(rooms.number)]
        });

        // Fetch active bookings for all rooms in one query.
        // A room with a CHECKED_IN guest is occupied regardless of its status
        // column (handles data-consistency edge cases and mid-stay cleaning).
        const allRoomIds = roomList.map(r => r.id);
        if (allRoomIds.length === 0) return roomList;

        const activeBookings = await db.query.bookings.findMany({
            where: and(
                eq(bookings.hotelId, hotelId),
                inArray(bookings.roomId, allRoomIds),
                eq(bookings.status, 'CHECKED_IN')
            ),
            columns: {
                id: true,
                roomId: true,
                guestName: true,
                guestPhone: true,
                checkIn: true,
                checkOut: true,
            }
        });

        const bookingByRoom = new Map(activeBookings.map(b => [b.roomId, b]));

        return roomList.map(room => {
            const booking = bookingByRoom.get(room.id);
            if (!booking) return room;
            return {
                ...room,
                currentBooking: {
                    id: booking.id,
                    guestName: booking.guestName,
                    checkIn: booking.checkIn,
                    checkOut: booking.checkOut,
                }
            };
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
        floorId?: number;
        floorNumber?: number;
        capacity?: number;
        amenities?: string[];
        imageUrl?: string;
    }) {
        const [newRoom] = await db.insert(rooms).values({
            hotelId,
            number: data.number,
            name: data.name,
            type: data.type,
            rate: data.rate.toString(),
            status: 'AVAILABLE',
            floorId: data.floorId,
            floorNumber: data.floorNumber,
            capacity: data.capacity,
            amenities: data.amenities || [],
            imageUrl: data.imageUrl || null,
        }).returning();

        return newRoom;
    }

    static async bulkCreateRooms(hotelId: number, data: {
        number: number;
        name?: string;
        type: string;
        rate: number;
        capacity?: number;
        floorNumber?: number;
    }[]) {
        if (data.length === 0) return { count: 0, ids: [] };

        const roomsToInsert = data.map(r => ({
            hotelId,
            number: r.number,
            name: r.name,
            type: r.type,
            rate: r.rate.toString(),
            capacity: r.capacity,
            floorNumber: r.floorNumber,
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
        floorId?: number;
        floorNumber?: number;
        capacity?: number;
        imageUrl?: string;
    }) {
        const updateData: Record<string, any> = { updatedAt: new Date() };
        if (data.number !== undefined) updateData.number = data.number;
        if (data.name !== undefined) updateData.name = data.name;
        if (data.type !== undefined) updateData.type = data.type;
        if (data.rate !== undefined) updateData.rate = data.rate.toString();
        if (data.status !== undefined) updateData.status = data.status;
        if (data.floorId !== undefined) updateData.floorId = data.floorId;
        if (data.floorNumber !== undefined) updateData.floorNumber = data.floorNumber;
        if (data.capacity !== undefined) updateData.capacity = data.capacity;
        if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl || null;

        const [updated] = await db.update(rooms)
            .set(updateData)
            .where(and(
                eq(rooms.id, roomId),
                eq(rooms.hotelId, hotelId)
            ))
            .returning();

        if (!updated) throw new NotFoundError('Room');

        return updated;
    }

    static async deleteRoom(hotelId: number, roomId: number) {
        // Block deletion while the room has live bookings (would orphan them / hit FK).
        const active = await db.query.bookings.findFirst({
            where: and(
                eq(bookings.roomId, roomId),
                eq(bookings.hotelId, hotelId),
                inArray(bookings.status, ['PENDING', 'CONFIRMED', 'CHECKED_IN'])
            ),
            columns: { id: true },
        });
        if (active) throw new BusinessLogicError('Cannot delete a room with active or upcoming bookings');

        const [deleted] = await db.delete(rooms)
            .where(and(
                eq(rooms.id, roomId),
                eq(rooms.hotelId, hotelId)
            ))
            .returning();

        if (!deleted) throw new NotFoundError('Room');

        // Hard-deleted → remove its image from object storage (best-effort).
        await StorageService.deleteByUrl(deleted.imageUrl);
        return deleted;
    }
}
