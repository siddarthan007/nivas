import { db } from '../../db';
import { bookings, rooms, folioCharges, nightAudits, orders, hotels } from '../../db/schema';
import { eq, and, lte, gte, sql, sum, count } from 'drizzle-orm';
import { WSService as NotificationService } from '../notifications/ws.service';

export const NightAuditService = {
    async runAuditForHotel(hotelId: number) {
        console.log(`Starting Night Audit for Hotel ${hotelId}...`);

        const auditDate = new Date();
        auditDate.setDate(auditDate.getDate() - 1);
        const auditDateStr: string = auditDate.toISOString().split('T')[0] ?? '';

        const existing = await db.query.nightAudits.findFirst({
            where: and(
                eq(nightAudits.hotelId, hotelId),
                sql`${nightAudits.auditDate} = ${auditDateStr}`
            )
        });

        if (existing) {
            console.log(`Audit already completed for ${auditDateStr}`);
            return { status: 'skipped', message: 'Audit already completed' };
        }

        const result = await db.transaction(async (tx) => {
            const activeBookings = await tx.query.bookings.findMany({
                where: and(
                    eq(bookings.hotelId, hotelId),
                    eq(bookings.status, 'CHECKED_IN'),
                    lte(bookings.checkIn, new Date(`${auditDateStr}T23:59:59`)),
                    gte(bookings.checkOut, new Date())
                ),
                with: { room: true }
            });

            let totalRoomRevenue = 0;

            for (const booking of activeBookings) {
                const nightlyRate = parseFloat(booking.room.rate || '0');

                if (nightlyRate > 0) {
                    await tx.insert(folioCharges).values({
                        hotelId,
                        bookingId: booking.id,
                        date: auditDateStr,
                        description: `Room Charge - Night of ${auditDateStr}`,
                        amount: nightlyRate.toString(),
                        type: 'ROOM_CHARGE'
                    });
                    totalRoomRevenue += nightlyRate;
                }
            }

            const fnbResult = await tx.select({ total: sum(orders.totalAmount) })
                .from(orders)
                .where(and(
                    eq(orders.hotelId, hotelId),
                    sql`DATE(${orders.createdAt}) = ${auditDateStr}`
                ));

            const totalFnbRevenue = parseFloat(fnbResult[0]?.total || '0');

            const [totalRoomsResult] = await tx.select({ count: count() })
                .from(rooms)
                .where(eq(rooms.hotelId, hotelId));

            const totalRooms = totalRoomsResult?.count ?? 0;
            const occupancyPct = totalRooms > 0 ? (activeBookings.length / totalRooms) * 100 : 0;

            const [auditRecord] = await tx.insert(nightAudits).values({
                hotelId,
                auditDate: auditDateStr,
                status: 'SUCCESS',
                totalRoomRevenue: totalRoomRevenue.toString(),
                totalFnbRevenue: totalFnbRevenue.toString(),
                occupancyPercentage: occupancyPct.toFixed(2),
                notes: `Processed ${activeBookings.length} active bookings`
            }).returning();

            return {
                auditRecord,
                roomRevenue: totalRoomRevenue,
                fnbRevenue: totalFnbRevenue,
                occupancy: occupancyPct,
                bookingsProcessed: activeBookings.length
            };
        });

        NotificationService.broadcastToRole(
            hotelId,
            ['Manager', 'Owner'],
            'NIGHT_AUDIT_COMPLETED',
            {
                date: auditDateStr,
                roomRevenue: result.roomRevenue,
                fnbRevenue: result.fnbRevenue,
                occupancy: result.occupancy,
                bookingsProcessed: result.bookingsProcessed
            }
        );

        return { status: 'success', data: result };
    },

    async runGlobalAudit() {
        console.log('Starting Global Night Audit...');

        const activeHotels = await db.query.hotels.findMany({
            where: eq(hotels.isActive, true)
        });

        const results = [];
        for (const hotel of activeHotels) {
            try {
                const result = await this.runAuditForHotel(hotel.id);
                results.push({ hotelId: hotel.id, hotelName: hotel.name, ...result });
            } catch (err) {
                console.error(`Failed audit for Hotel ${hotel.name}:`, err);
                results.push({ hotelId: hotel.id, hotelName: hotel.name, status: 'error', error: String(err) });
            }
        }

        console.log(`Global Night Audit Complete. Processed ${activeHotels.length} hotels.`);
        return results;
    }
};