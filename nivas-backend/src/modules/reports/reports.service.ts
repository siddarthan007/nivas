import { db } from '../../db';
import { payments, bookings, housekeepingTasks, guestProfiles } from '../../db/schema';
import { eq, and, sql, gte, lte, sum, count, desc, inArray } from 'drizzle-orm';

export const ReportsService = {
    async getDailySalesReport(hotelId: number, dateStr: string) {
        const startDate = new Date(dateStr);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(dateStr);
        endDate.setHours(23, 59, 59, 999);

        const revenueByMethod = await db.select({
            method: payments.paymentMethod,
            total: sum(payments.amount)
        })
            .from(payments)
            .where(and(
                eq(payments.hotelId, hotelId),
                gte(payments.createdAt, startDate),
                lte(payments.createdAt, endDate)
            ))
            .groupBy(payments.paymentMethod);

        const totalRevenue = revenueByMethod.reduce((acc, curr) => acc + parseFloat(curr.total || '0'), 0);

        const [roomsOccupied] = await db.select({ count: count() })
            .from(bookings)
            .where(and(
                eq(bookings.hotelId, hotelId),
                lte(bookings.checkIn, endDate),
                gte(bookings.checkOut, startDate)
            ));

        return {
            date: dateStr,
            totalRevenue,
            breakdown: revenueByMethod,
            occupancy: roomsOccupied?.count || 0
        };
    },

    async getHousekeepingEfficiency(hotelId: number, days: number) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        return await db.select({
            staffId: housekeepingTasks.assignedToId,
            taskType: housekeepingTasks.taskType,
            tasksCount: count(),
            avgDurationMinutes: sql<number>`AVG(EXTRACT(EPOCH FROM (${housekeepingTasks.completedAt} - ${housekeepingTasks.startedAt})) / 60)`
        })
            .from(housekeepingTasks)
            .where(and(
                eq(housekeepingTasks.hotelId, hotelId),
                gte(housekeepingTasks.createdAt, startDate),
                eq(housekeepingTasks.status, 'COMPLETED')
            ))
            .groupBy(housekeepingTasks.assignedToId, housekeepingTasks.taskType);
    },

    async getArrivalsReport(hotelId: number, dateStr: string) {
        const startDate = new Date(dateStr);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(dateStr);
        endDate.setHours(23, 59, 59, 999);

        const arrivals = await db.query.bookings.findMany({
            where: and(
                eq(bookings.hotelId, hotelId),
                gte(bookings.checkIn, startDate),
                lte(bookings.checkIn, endDate),
                inArray(bookings.status, ['CONFIRMED', 'PENDING'])
            ),
            with: { room: { columns: { number: true, type: true } } },
            orderBy: [desc(bookings.checkIn)]
        });

        return arrivals.map(b => ({
            bookingId: b.id,
            guestName: b.guestName,
            guestPhone: b.guestPhone,
            roomNumber: b.room?.number,
            roomType: b.room?.type,
            checkIn: b.checkIn,
            checkOut: b.checkOut,
            status: b.status,
            source: b.source
        }));
    },

    async getDeparturesReport(hotelId: number, dateStr: string) {
        const startDate = new Date(dateStr);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(dateStr);
        endDate.setHours(23, 59, 59, 999);

        const departures = await db.query.bookings.findMany({
            where: and(
                eq(bookings.hotelId, hotelId),
                gte(bookings.checkOut, startDate),
                lte(bookings.checkOut, endDate),
                eq(bookings.status, 'CHECKED_IN')
            ),
            with: { room: { columns: { number: true, type: true } } },
            orderBy: [desc(bookings.checkOut)]
        });

        return departures.map(b => ({
            bookingId: b.id,
            guestName: b.guestName,
            guestPhone: b.guestPhone,
            roomNumber: b.room?.number,
            roomType: b.room?.type,
            checkIn: b.checkIn,
            checkOut: b.checkOut,
            totalAmount: b.totalAmount,
            isPaid: b.isPaid
        }));
    },

    async getCancellationsAndNoShows(hotelId: number, days: number) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const cancellations = await db.query.bookings.findMany({
            where: and(
                eq(bookings.hotelId, hotelId),
                gte(bookings.createdAt, startDate),
                eq(bookings.status, 'CANCELLED')
            ),
            with: { room: { columns: { number: true, type: true } } },
            orderBy: [desc(bookings.updatedAt)]
        });

        // No-shows: bookings where checkIn has passed but still PENDING/CONFIRMED
        const now = new Date();
        const noShows = await db.query.bookings.findMany({
            where: and(
                eq(bookings.hotelId, hotelId),
                lte(bookings.checkIn, now),
                gte(bookings.checkIn, startDate),
                inArray(bookings.status, ['PENDING', 'CONFIRMED'])
            ),
            with: { room: { columns: { number: true, type: true } } }
        });

        const cancellationData = cancellations.map(b => ({
            bookingId: b.id,
            guestName: b.guestName,
            guestPhone: b.guestPhone,
            roomNumber: b.room?.number,
            checkIn: b.checkIn,
            checkOut: b.checkOut,
            type: 'CANCELLED',
            lostRevenue: b.totalAmount
        }));

        const noShowData = noShows.map(b => ({
            bookingId: b.id,
            guestName: b.guestName,
            guestPhone: b.guestPhone,
            roomNumber: b.room?.number,
            checkIn: b.checkIn,
            checkOut: b.checkOut,
            type: 'NO_SHOW',
            lostRevenue: b.totalAmount
        }));

        return { cancellationData, noShowData };
    },

    async getNationalitiesReport(hotelId: number, days: number) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const bookingsWithGuests = await db.query.bookings.findMany({
            where: and(
                eq(bookings.hotelId, hotelId),
                gte(bookings.checkIn, startDate),
                inArray(bookings.status, ['CHECKED_IN', 'CHECKED_OUT'])
            ),
            columns: { guestPhone: true, guestName: true }
        });

        const phones = bookingsWithGuests.map(b => b.guestPhone);

        const profiles = phones.length > 0 ? await db.query.guestProfiles.findMany({
            where: and(
                eq(guestProfiles.hotelId, hotelId),
                inArray(guestProfiles.phone, phones)
            ),
            columns: { phone: true, nationality: true, fullName: true }
        }) : [];

        const phoneToNationality = new Map(profiles.map(p => [p.phone, p.nationality || 'Unknown']));

        const nationalityCounts: Record<string, number> = {};
        for (const booking of bookingsWithGuests) {
            const nat = phoneToNationality.get(booking.guestPhone) || 'Unknown';
            nationalityCounts[nat] = (nationalityCounts[nat] || 0) + 1;
        }

        const data = Object.entries(nationalityCounts)
            .map(([nationality, guestCount]) => ({ nationality, guestCount }))
            .sort((a, b) => b.guestCount - a.guestCount);

        return { data, totalGuests: bookingsWithGuests.length, startDate: startDate.toISOString().split('T')[0] };
    },

    async getInHouseGuests(hotelId: number) {
        const now = new Date();
        const inHouse = await db.query.bookings.findMany({
            where: and(
                eq(bookings.hotelId, hotelId),
                eq(bookings.status, 'CHECKED_IN'),
                lte(bookings.checkIn, now),
                gte(bookings.checkOut, now)
            ),
            with: { room: { columns: { number: true, type: true } } },
            orderBy: [desc(bookings.checkIn)]
        });

        return inHouse.map(b => ({
            bookingId: b.id,
            guestName: b.guestName,
            guestPhone: b.guestPhone,
            guestEmail: b.guestEmail,
            roomNumber: b.room?.number,
            roomType: b.room?.type,
            checkIn: b.checkIn,
            checkOut: b.checkOut,
            guestCount: b.guestCount
        }));
    }
};
