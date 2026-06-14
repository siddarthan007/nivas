import { db } from '../../db';
import { bookings, rooms, folioCharges, nightAudits, orders, hotels } from '../../db/schema';
import { eq, and, lte, gte, sql, sum, count } from 'drizzle-orm';
import { EventBus } from '../../shared/event-bus';

export const NightAuditService = {
    async runAuditForHotel(hotelId: number) {

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
                const nights = Math.max(1, Math.ceil(
                    (new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / (1000 * 60 * 60 * 24)
                ));
                const nightlyRate = parseFloat(booking.totalAmount || '0') / nights;

                if (nightlyRate > 0) {
                    const existingCharge = await tx.query.folioCharges.findFirst({
                        where: and(
                            eq(folioCharges.bookingId, booking.id),
                            eq(folioCharges.date, auditDateStr),
                            eq(folioCharges.type, 'ROOM_CHARGE')
                        ),
                    });
                    if (!existingCharge) {
                        await tx.insert(folioCharges).values({
                            hotelId,
                            bookingId: booking.id,
                            date: auditDateStr,
                            description: `Room Charge - Night of ${auditDateStr}`,
                            amount: nightlyRate.toFixed(2),
                            type: 'ROOM_CHARGE'
                        });
                        totalRoomRevenue += nightlyRate;
                    }
                }
            }

            // Only count SERVED orders; use subTotal (pre-tax) to match room revenue basis.
            const fnbResult = await tx.select({ total: sum(orders.subTotal) })
                .from(orders)
                .where(and(
                    eq(orders.hotelId, hotelId),
                    eq(orders.status, 'SERVED'),
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

        EventBus.emit({
            type: 'NightAuditCompleted',
            hotelId,
            source: 'night-audit',
            timestamp: new Date(),
            payload: {
                auditDate: auditDateStr,
                roomRevenue: result.roomRevenue,
                fnbRevenue: result.fnbRevenue,
                occupancy: result.occupancy,
                bookingsProcessed: result.bookingsProcessed,
            },
        }).catch((err) => { console.error('[NightAudit] Event emit failed:', err); });

        return { status: 'success', data: result };
    },

    async runGlobalAudit() {

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

        return results;
    }
};