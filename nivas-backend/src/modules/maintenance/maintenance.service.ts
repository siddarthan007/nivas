import { db } from '../../db';
import { assets, maintenanceTickets, rooms, bookings } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { NotFoundError } from '../../utils/errors';

export const MaintenanceService = {
    async getAssets(hotelId: number) {
        return db.query.assets.findMany({
            where: eq(assets.hotelId, hotelId)
        });
    },

    async createAsset(hotelId: number, data: any) {
        // Strip client-supplied id/hotelId so an asset can't be planted in another
        // tenant or collide with a serial id.
        const { id: _id, hotelId: _h, ...safe } = data || {};
        const [asset] = await db.insert(assets).values({
            ...safe,
            hotelId,
        }).returning();
        return asset;
    },

    async getMaintenanceTickets(hotelId: number) {
        return db.query.maintenanceTickets.findMany({
            where: eq(maintenanceTickets.hotelId, hotelId),
            with: {
                // room: true,
                // asset: true
            }
        });
    },

    async createTicket(hotelId: number, userId: string, data: any) {
        return db.transaction(async (tx) => {
            if (data.roomId) {
                const room = await tx.query.rooms.findFirst({
                    where: and(eq(rooms.id, data.roomId), eq(rooms.hotelId, hotelId))
                });
                if (!room) throw new NotFoundError('Room');
            }

            const [ticket] = await tx.insert(maintenanceTickets).values({
                hotelId: hotelId,
                title: data.title,
                description: data.description,
                priority: data.priority || 'medium',
                status: 'open',
                roomId: data.roomId,
                assetId: data.assetId,
                assignedToId: data.assignedTo
            }).returning();

            // If it's a high priority issue in a room, optionally block the room
            if (data.blockRoom && data.roomId) {
                await tx.update(rooms)
                    .set({ status: 'MAINTENANCE' })
                    .where(and(eq(rooms.id, data.roomId), eq(rooms.hotelId, hotelId)));
            }

            return ticket;
        });
    },

    async updateTicketStatus(hotelId: number, ticketId: number, status: string) {
        return db.transaction(async (tx) => {
            const ticket = await tx.query.maintenanceTickets.findFirst({
                where: and(
                    eq(maintenanceTickets.id, ticketId),
                    eq(maintenanceTickets.hotelId, hotelId)
                )
            });

            if (!ticket) throw new NotFoundError('Maintenance Ticket');

            const [updated] = await tx.update(maintenanceTickets)
                .set({
                    status,
                    resolvedAt: status === 'resolved' ? new Date() : ticket.resolvedAt
                })
                .where(and(eq(maintenanceTickets.id, ticketId), eq(maintenanceTickets.hotelId, hotelId)))
                .returning();

            // Unblock room if resolved — but never free a room with a guest still
            // in-house, and only flip rooms actually blocked by maintenance (don't
            // override OCCUPIED/CLEANING).
            if (status === 'resolved' && ticket.roomId) {
                const activeStay = await tx.query.bookings.findFirst({
                    where: and(
                        eq(bookings.roomId, ticket.roomId),
                        eq(bookings.hotelId, hotelId),
                        eq(bookings.status, 'CHECKED_IN')
                    )
                });
                if (!activeStay) {
                    await tx.update(rooms)
                        .set({ status: 'AVAILABLE' })
                        .where(and(eq(rooms.id, ticket.roomId), eq(rooms.hotelId, hotelId), eq(rooms.status, 'MAINTENANCE')));
                }
            }

            return updated;
        });
    }
};
