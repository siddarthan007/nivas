import { db } from '../../db';
import { rooms, bookings } from '../../db/schema';
import { eq, and, inArray, gte, lt, count } from 'drizzle-orm';

const MS = 86400000;
const dayStart = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

/**
 * Demand / occupancy forecast — PURE STATISTICS, no LLM.
 *
 * "On-the-books" (OTB) = rooms already sold for each future night (deterministic
 * from confirmed/checked-in bookings). We then add a "pickup" projection: the
 * historical average extra room-nights still booked per remaining lead day, so
 * near-term dates (less time to fill) get a smaller lift than far-out dates.
 */
export const ForecastService = {
    async getForecast(hotelId: number, horizonDays = 90) {
        const today = dayStart(new Date());
        const horizonEnd = new Date(today.getTime() + horizonDays * MS);

        const [roomCountRow] = await db.select({ c: count() }).from(rooms).where(eq(rooms.hotelId, hotelId));
        const totalRooms = roomCountRow?.c || 0;

        // Future + recent-past bookings that consume inventory.
        const histStart = new Date(today.getTime() - 120 * MS);
        const live = await db.query.bookings.findMany({
            where: and(
                eq(bookings.hotelId, hotelId),
                inArray(bookings.status, ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT']),
                lt(bookings.checkIn, horizonEnd),
                gte(bookings.checkOut, histStart),
            ),
            columns: { checkIn: true, checkOut: true, totalAmount: true, createdAt: true, status: true },
        });

        // ADR — average nightly rate from bookings in the last 90 days.
        let adrNights = 0, adrRevenue = 0;
        for (const b of live) {
            const ci = dayStart(new Date(b.checkIn)), co = dayStart(new Date(b.checkOut));
            const nights = Math.max(1, Math.round((co.getTime() - ci.getTime()) / MS));
            if (ci >= histStart && ci < today) { adrNights += nights; adrRevenue += parseFloat(b.totalAmount || '0'); }
        }
        const adr = adrNights > 0 ? adrRevenue / adrNights : 0;

        // Historical pickup: of bookings that have arrived, what fraction were
        // created within their last K lead-days? → avg extra room-nights/lead-day.
        // Simplified: average lead time (booked→arrival). Shorter avg lead ⇒ more
        // last-minute pickup still to come for near dates.
        let leadSum = 0, leadN = 0;
        for (const b of live) {
            const ci = dayStart(new Date(b.checkIn));
            if (b.createdAt) {
                const lead = Math.max(0, Math.round((ci.getTime() - dayStart(new Date(b.createdAt)).getTime()) / MS));
                leadSum += lead; leadN += 1;
            }
        }
        const avgLead = leadN > 0 ? leadSum / leadN : 14;

        // Per-day OTB occupancy + revenue.
        const daily: { date: string; otbRooms: number; otbOccupancy: number; projectedOccupancy: number; otbRevenue: number }[] = [];
        for (let i = 0; i < horizonDays; i++) {
            const day = new Date(today.getTime() + i * MS);
            const dayEnd = new Date(day.getTime() + MS);
            let otbRooms = 0, otbRevenue = 0;
            for (const b of live) {
                const ci = new Date(b.checkIn), co = new Date(b.checkOut);
                if (ci < dayEnd && co > day) {
                    otbRooms += 1;
                    const nights = Math.max(1, Math.round((dayStart(co).getTime() - dayStart(ci).getTime()) / MS));
                    otbRevenue += parseFloat(b.totalAmount || '0') / nights;
                }
            }
            const otbOcc = totalRooms > 0 ? otbRooms / totalRooms : 0;
            // Pickup factor: dates within ~avgLead days still fill up; fades to ~0
            // beyond it. Cap projected occupancy at 100%.
            const leadDays = i;
            const remainingFill = avgLead > 0 ? Math.min(1, Math.max(0, leadDays / avgLead)) : 0;
            const headroom = Math.max(0, 1 - otbOcc);
            const projectedOcc = Math.min(1, otbOcc + headroom * remainingFill * 0.6);
            daily.push({
                date: day.toISOString().slice(0, 10),
                otbRooms,
                otbOccupancy: Math.round(otbOcc * 1000) / 10,
                projectedOccupancy: Math.round(projectedOcc * 1000) / 10,
                otbRevenue: Math.round(otbRevenue),
            });
        }

        const windowStats = (days: number) => {
            const slice = daily.slice(0, days);
            const otbRoomNights = slice.reduce((s, d) => s + d.otbRooms, 0);
            const capacity = totalRooms * days;
            const otbRevenue = slice.reduce((s, d) => s + d.otbRevenue, 0);
            const avgOtbOcc = capacity > 0 ? (otbRoomNights / capacity) * 100 : 0;
            const avgProjOcc = slice.length ? slice.reduce((s, d) => s + d.projectedOccupancy, 0) / slice.length : 0;
            // Projected revenue = OTB + (projected extra room-nights × ADR).
            const projRoomNights = capacity * (avgProjOcc / 100);
            const projectedRevenue = otbRevenue + Math.max(0, projRoomNights - otbRoomNights) * adr;
            return {
                days,
                otbOccupancy: Math.round(avgOtbOcc * 10) / 10,
                projectedOccupancy: Math.round(avgProjOcc * 10) / 10,
                otbRevenue: Math.round(otbRevenue),
                projectedRevenue: Math.round(projectedRevenue),
                otbRoomNights,
            };
        };

        return {
            totalRooms,
            adr: Math.round(adr),
            avgLeadDays: Math.round(avgLead),
            windows: { d30: windowStats(30), d60: windowStats(60), d90: windowStats(90) },
            daily,
        };
    },
};
