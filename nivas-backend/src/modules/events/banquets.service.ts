import { db } from '../../db';
import { banquets, banquetBookings } from '../../db/schema';
import { eq, and, gte, asc } from 'drizzle-orm';
import { NotFoundError } from '../../utils/errors';
import { AuditService } from '../system/audit.service';

export const BanquetsService = {
    async createVenue(hotelId: number, data: any) {
        const [venue] = await db.insert(banquets).values({
            hotelId,
            ...data,
            baseRateHalf: data.baseRateHalf?.toString(),
            baseRateFull: data.baseRateFull?.toString(),
            isActive: true
        }).returning();
        return venue;
    },

    async getAllVenues(hotelId: number) {
        return await db.query.banquets.findMany({
            where: eq(banquets.hotelId, hotelId)
        });
    },

    async updateVenue(hotelId: number, venueId: number, data: any) {
        const [updated] = await db.update(banquets)
            .set({
                ...data,
                baseRateHalf: data.baseRateHalf?.toString(),
                baseRateFull: data.baseRateFull?.toString()
            })
            .where(and(
                eq(banquets.id, venueId),
                eq(banquets.hotelId, hotelId)
            ))
            .returning();

        if (!updated) throw new NotFoundError('Venue');
        return updated;
    },

    async createBooking(hotelId: number, userId: string, data: any) {
        // Map frontend field names to backend column names
        const organizerName = data.organizerName || data.contactName || '';
        const organizerPhone = data.organizerPhone || data.contactPhone || '';
        const { contactName, contactPhone, ...rest } = data;

        const [booking] = await db.insert(banquetBookings).values({
            hotelId,
            ...rest,
            organizerName,
            organizerPhone,
            totalAmount: data.totalAmount?.toString(),
            advanceAmount: data.advanceAmount?.toString(),
            status: 'PENDING',
            createdById: userId
        }).returning();

        if (!booking) throw new Error('Failed to create booking');

        await AuditService.log(
            hotelId,
            userId,
            'CREATE_BANQUET_BOOKING',
            'BANQUET_BOOKING',
            booking.id.toString(),
            { eventName: data.eventName, eventDate: data.eventDate, expectedGuests: data.expectedGuests }
        );

        return booking;
    },

    async getAllBookings(hotelId: number, upcomingOnly: boolean = false) {
        const today = new Date().toISOString().split('T')[0] || '';
        const whereClause = upcomingOnly
            ? and(eq(banquetBookings.hotelId, hotelId), gte(banquetBookings.eventDate, today))
            : eq(banquetBookings.hotelId, hotelId);

        return await db.query.banquetBookings.findMany({
            where: whereClause,
            with: { banquet: true },
            orderBy: (b, { asc }) => [asc(b.eventDate)]
        });
    },

    async getBookingById(hotelId: number, bookingId: string) {
        const booking = await db.query.banquetBookings.findFirst({
            where: and(
                eq(banquetBookings.id, bookingId),
                eq(banquetBookings.hotelId, hotelId)
            ),
            with: { banquet: true }
        });

        if (!booking) throw new NotFoundError('Booking');
        return booking;
    },

    async updateBooking(hotelId: number, userId: string, bookingId: string, data: any) {
        // Separate status update logic if needed, but for general update:
        // If updating status, log it.
        if (data.status) {
            await AuditService.log(
                hotelId,
                userId,
                'UPDATE_BANQUET_BOOKING_STATUS',
                'BANQUET_BOOKING',
                bookingId,
                { newStatus: data.status }
            );
        }

        const [updated] = await db.update(banquetBookings)
            .set({
                ...data,
                totalAmount: data.totalAmount?.toString(),
                advanceAmount: data.advanceAmount?.toString(),
                updatedAt: new Date()
            })
            .where(and(
                eq(banquetBookings.id, bookingId),
                eq(banquetBookings.hotelId, hotelId)
            ))
            .returning();

        if (!updated) throw new NotFoundError('Booking');
        return updated;
    },

    async deleteVenue(hotelId: number, venueId: number) {
        const [deleted] = await db.delete(banquets)
            .where(and(eq(banquets.id, venueId), eq(banquets.hotelId, hotelId)))
            .returning();
        if (!deleted) throw new NotFoundError('Venue');
        return deleted;
    },

    async deleteBooking(hotelId: number, userId: string, bookingId: string) {
        const [deleted] = await db.delete(banquetBookings)
            .where(and(eq(banquetBookings.id, bookingId), eq(banquetBookings.hotelId, hotelId)))
            .returning();
        if (!deleted) throw new NotFoundError('Booking');

        await AuditService.log(hotelId, userId, 'DELETE_BANQUET_BOOKING', 'BANQUET_BOOKING', bookingId, {});
        return deleted;
    },

    async checkAvailability(hotelId: number, venueId: number, date: string, startTime: string, endTime: string) {
        const existingBookings = await db.query.banquetBookings.findMany({
            where: and(
                eq(banquetBookings.hotelId, hotelId),
                eq(banquetBookings.banquetId, venueId),
                eq(banquetBookings.eventDate, date)
            )
        });

        const hasConflict = existingBookings.some(b =>
            b.status !== 'CANCELLED' && (
                (startTime >= b.startTime && startTime < b.endTime) ||
                (endTime > b.startTime && endTime <= b.endTime) ||
                (startTime <= b.startTime && endTime >= b.endTime)
            )
        );

        return {
            date,
            isAvailable: !hasConflict,
            existingBookings: existingBookings
                .filter(b => b.status !== 'CANCELLED')
                .map(b => ({
                    eventName: b.eventName,
                    startTime: b.startTime,
                    endTime: b.endTime
                }))
        };
    }
};
