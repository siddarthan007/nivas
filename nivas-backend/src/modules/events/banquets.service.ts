import { db } from '../../db';
import { banquets, banquetBookings } from '../../db/schema';
import { eq, and, gte, asc, sql } from 'drizzle-orm';
import { NotFoundError, ConflictError, BusinessLogicError } from '../../utils/errors';

// "HH:MM" (or "H:MM") → minutes since midnight, for format-safe time comparison.
function toMinutes(t?: string | null): number {
    if (!t) return 0;
    const [h, m] = String(t).split(':');
    return (parseInt(h || '0', 10) || 0) * 60 + (parseInt(m || '0', 10) || 0);
}
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
        const allowed = ['name', 'capacity', 'description', 'amenities', 'isActive'];
        const updateData: any = {};
        for (const key of allowed) {
            if (data[key] !== undefined) updateData[key] = data[key];
        }
        const [updated] = await db.update(banquets)
            .set({
                ...updateData,
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
        const organizerName = data.organizerName || data.contactName || '';
        const organizerPhone = data.organizerPhone || data.contactPhone || '';
        const { contactName, contactPhone, ...rest } = data;

        // Strip client-controlled trust fields; hotelId/status/createdById are set
        // by the server AFTER the spread so the body can't override them.
        const { id: _id, hotelId: _h, status: _s, createdById: _c, ...safeRest } = (rest as any) || {};

        // Lock the venue + check overlap + insert atomically so two concurrent
        // requests can't both pass the check and double-book the same slot.
        const booking = await db.transaction(async (tx) => {
            if (data.banquetId && data.eventDate && data.startTime && data.endTime) {
                await tx.execute(sql`SELECT pg_advisory_xact_lock(${hotelId}, ${data.banquetId})`);
                const sameDay = await tx.query.banquetBookings.findMany({
                    where: and(
                        eq(banquetBookings.hotelId, hotelId),
                        eq(banquetBookings.banquetId, data.banquetId),
                        eq(banquetBookings.eventDate, data.eventDate)
                    )
                });
                // Normalize times to minutes so "9:00" vs "09:00" compare correctly.
                const ns = toMinutes(data.startTime), ne = toMinutes(data.endTime);
                const clash = sameDay.some(b => {
                    if (b.status === 'CANCELLED') return false;
                    const bs = toMinutes(b.startTime), be = toMinutes(b.endTime);
                    return ns < be && ne > bs; // standard interval overlap
                });
                if (clash) throw new ConflictError('This venue is already booked for the selected date and time');
            }

            const [row] = await tx.insert(banquetBookings).values({
                ...safeRest,
                hotelId,
                organizerName,
                organizerPhone,
                guestId: data.guestId || null,
                endDate: data.endDate || null,
                totalAmount: data.totalAmount?.toString(),
                advanceAmount: data.advanceAmount?.toString(),
                status: 'PENDING',
                createdById: userId
            }).returning();
            return row;
        });

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
            with: { banquet: true, guest: true, invoice: true },
            orderBy: (b, { asc }) => [asc(b.eventDate)]
        });
    },

    async getBookingById(hotelId: number, bookingId: string) {
        const booking = await db.query.banquetBookings.findFirst({
            where: and(
                eq(banquetBookings.id, bookingId),
                eq(banquetBookings.hotelId, hotelId)
            ),
            with: { banquet: true, guest: true, invoice: true }
        });

        if (!booking) throw new NotFoundError('Booking');
        return booking;
    },

    async updateBooking(hotelId: number, userId: string, bookingId: string, data: any) {
        // A finalized booking is immutable (no re-opening / silent re-edit).
        const existing = await db.query.banquetBookings.findFirst({
            where: and(eq(banquetBookings.id, bookingId), eq(banquetBookings.hotelId, hotelId)),
            columns: { status: true },
        });
        if (!existing) throw new NotFoundError('Banquet booking');
        if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
            throw new BusinessLogicError(`Cannot edit a ${existing.status.toLowerCase()} booking`);
        }

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

        const allowed = ['eventName', 'eventDate', 'eventType', 'startTime', 'endTime', 'expectedGuests', 'contactName', 'contactPhone', 'organizerName', 'organizerPhone', 'status', 'specialRequests'];
        const updateData: any = {};
        for (const key of allowed) {
            if (data[key] !== undefined) updateData[key] = data[key];
        }
        const [updated] = await db.update(banquetBookings)
            .set({
                ...updateData,
                guestId: data.guestId || null,
                endDate: data.endDate || null,
                invoiceId: data.invoiceId || null,
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
