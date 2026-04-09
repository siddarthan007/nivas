import { db } from '../../db';
import { guests, bookings, orders, invoices, payments, rooms } from '../../db/schema';
import { eq, and, desc, ilike, or, inArray, gte, lte, type SQL } from 'drizzle-orm';
import { NotFoundError, ValidationError } from '../../utils/errors';

export const GuestService = {
    async createGuest(hotelId: number, data: { fullName: string; phone?: string; email?: string; idType?: string; idNumber?: string; address?: string; notes?: string; nationality?: string }) {
        const [newGuest] = await db.insert(guests).values({
            hotelId,
            ...data
        }).returning();
        return newGuest;
    },

    async findGuests(hotelId: number, filters: { query?: string; isVip?: boolean; isBanned?: boolean; nationality?: string; roomNumber?: string; dateOfStay?: string }) {
        const conditions: SQL[] = [eq(guests.hotelId, hotelId)];

        if (filters.query) {
            const search = `%${filters.query}%`;
            conditions.push(or(
                ilike(guests.fullName, search),
                ilike(guests.phone, search),
                ilike(guests.email, search),
                ilike(guests.idNumber, search)
            )!);
        }

        if (filters.isVip !== undefined) {
            conditions.push(eq(guests.isVip, filters.isVip));
        }

        if (filters.isBanned !== undefined) {
            conditions.push(eq(guests.isBanned, filters.isBanned));
        }

        if (filters.nationality) {
            conditions.push(ilike(guests.nationality, `%${filters.nationality}%`));
        }

        // Advanced: filter by room number — find guests who had bookings in a specific room
        if (filters.roomNumber) {
            const roomNum = parseInt(filters.roomNumber, 10);
            if (!isNaN(roomNum)) {
                const matchingBookings = await db.select({ guestId: bookings.guestId })
                    .from(bookings)
                    .innerJoin(rooms, eq(bookings.roomId, rooms.id))
                    .where(and(
                        eq(bookings.hotelId, hotelId),
                        eq(rooms.number, roomNum)
                    ));
                const guestIds = [...new Set(matchingBookings.map(b => b.guestId).filter(Boolean))] as string[];
                if (guestIds.length > 0) {
                    conditions.push(inArray(guests.id, guestIds));
                } else {
                    return []; // no guests found for this room
                }
            }
        }

        // Advanced: filter by date of stay — find guests who had a booking that covers this date
        if (filters.dateOfStay) {
            const stayDate = new Date(filters.dateOfStay);
            if (!isNaN(stayDate.getTime())) {
                const matchingBookings = await db.select({ guestId: bookings.guestId })
                    .from(bookings)
                    .where(and(
                        eq(bookings.hotelId, hotelId),
                        lte(bookings.checkIn, stayDate),
                        gte(bookings.checkOut, stayDate)
                    ));
                const guestIds = [...new Set(matchingBookings.map(b => b.guestId).filter(Boolean))] as string[];
                if (guestIds.length > 0) {
                    conditions.push(inArray(guests.id, guestIds));
                } else {
                    return []; // no guests found for this date
                }
            }
        }

        return await db.query.guests.findMany({
            where: and(...conditions),
            limit: 50,
            orderBy: desc(guests.createdAt)
        });
    },

    async getGuestFinancials(hotelId: number, guestId: string) {
        // Verify guest belongs to hotel
        await this.getGuestById(hotelId, guestId);

        // Get all bookings for this guest
        const guestBookings = await db.query.bookings.findMany({
            where: and(eq(bookings.guestId, guestId), eq(bookings.hotelId, hotelId)),
            columns: { id: true }
        });

        const bookingIds = guestBookings.map(b => b.id);

        let guestInvoices: any[] = [];
        let guestPayments: any[] = [];

        if (bookingIds.length > 0) {
            // Fetch Invoices linked to bookings
            guestInvoices = await db.query.invoices.findMany({
                where: and(
                    eq(invoices.hotelId, hotelId),
                    inArray(invoices.bookingId, bookingIds)
                ),
                orderBy: desc(invoices.createdAt)
            });

            // Fetch Payments linked to bookings
            guestPayments = await db.query.payments.findMany({
                where: and(
                    eq(payments.hotelId, hotelId),
                    inArray(payments.bookingId, bookingIds)
                ),
                orderBy: desc(payments.createdAt)
            });
        }

        // Calculate totals
        const totalInvoiced = guestInvoices.reduce((sum, inv) => sum + Number(inv.grandTotal || 0), 0);
        const totalPaid = guestPayments.reduce((sum, pay) => sum + Number(pay.amount || 0), 0);
        const balance = totalInvoiced - totalPaid;

        return {
            invoices: guestInvoices,
            payments: guestPayments,
            stats: {
                totalInvoiced,
                totalPaid,
                balance
            }
        };
    },

    async getGuestById(hotelId: number, guestId: string) {
        const guest = await db.query.guests.findFirst({
            where: and(
                eq(guests.id, guestId),
                eq(guests.hotelId, hotelId)
            ),
            with: {
                bookings: {
                    limit: 10,
                    orderBy: desc(bookings.checkIn),
                    with: {
                        orders: {
                            limit: 5,
                            orderBy: desc(orders.createdAt)
                        }
                    }
                }
            }
        });

        if (!guest) throw new NotFoundError('Guest');
        return guest;
    },

    async updateGuest(hotelId: number, guestId: string, data: Partial<typeof guests.$inferInsert>) {
        const [updated] = await db.update(guests)
            .set({ ...data, updatedAt: new Date() })
            .where(and(
                eq(guests.id, guestId),
                eq(guests.hotelId, hotelId)
            ))
            .returning();

        if (!updated) throw new NotFoundError('Guest');
        return updated;
    },

    async deleteGuest(hotelId: number, guestId: string) {
        // Check if guest has active bookings
        const activeBookings = await db.query.bookings.findMany({
            where: and(
                eq(bookings.guestId, guestId),
                eq(bookings.hotelId, hotelId),
                inArray(bookings.status, ['CONFIRMED', 'CHECKED_IN'] as any)
            )
        });

        if (activeBookings.length > 0) {
            throw new ValidationError('Cannot delete guest with active bookings. Cancel or check out bookings first.');
        }

        const [deleted] = await db.delete(guests)
            .where(and(
                eq(guests.id, guestId),
                eq(guests.hotelId, hotelId)
            ))
            .returning();

        if (!deleted) throw new NotFoundError('Guest');
        return deleted;
    }
};
