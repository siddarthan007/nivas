import { db } from '../../db';
import { parkingSpaces, bookings } from '../../db/schema';
import { eq, and } from 'drizzle-orm';

export const ParkingService = {
    async getAssignableBookings(hotelId: number) {
        const rows = await db.query.bookings.findMany({
            where: and(
                eq(bookings.hotelId, hotelId),
                eq(bookings.status, 'CHECKED_IN'),
            ),
            columns: {
                id: true,
                guestName: true,
                roomId: true,
                checkIn: true,
                checkOut: true,
            },
            with: {
                room: { columns: { id: true, number: true } },
            },
            orderBy: (b, { asc }) => [asc(b.guestName)],
        });

        return rows
            .filter(b => b.roomId != null)
            .map(b => ({
                bookingId: b.id,
                roomId: b.roomId!,
                roomNumber: (b as { room?: { number?: number } }).room?.number ?? null,
                guestName: b.guestName,
                checkIn: b.checkIn,
                checkOut: b.checkOut,
            }));
    },

    async releaseByRoomId(hotelId: number, roomId: number, tx?: typeof db) {
        const runner = tx || db;
        await runner.update(parkingSpaces)
            .set({
                status: 'AVAILABLE',
                assignedToRoomId: null,
                updatedAt: new Date(),
            })
            .where(and(
                eq(parkingSpaces.hotelId, hotelId),
                eq(parkingSpaces.assignedToRoomId, roomId),
            ));
    },
};
