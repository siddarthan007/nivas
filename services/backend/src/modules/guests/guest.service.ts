import { db } from '../../db';
import { guests, bookings, orders, invoices, payments, rooms } from '../../db/schema';
import { eq, and, desc, ilike, or, inArray, gte, lte, type SQL } from 'drizzle-orm';
import { FolioService } from '../finance/folio.service';
import { NotFoundError, ValidationError } from '../../utils/errors';

const GUEST_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertValidGuestId(guestId: string) {
    if (!GUEST_ID_RE.test(guestId)) {
        throw new NotFoundError('Guest');
    }
}

export const GuestService = {
    async createGuest(hotelId: number, data: {
        firstName?: string;
        lastName?: string;
        fullName: string;
        uniqueId?: string;
        phone?: string;
        email?: string;
        fatherName?: string;
        dob?: string;
        occupation?: string;
        nationality?: string;
        address?: string;
        city?: string;
        country?: string;
        idType?: string;
        idNumber?: string;
        panNumber?: string;
        vatNumber?: string;
        openingDueAmount?: string;
        photoUrl?: string;
        signatureUrl?: string;
        customerType?: 'HOTEL_GUEST' | 'RESTAURANT_CUSTOMER' | 'BOTH';
        notes?: string;
    }) {
        const insertData = {
            hotelId,
            ...data,
            openingDueAmount: data.openingDueAmount ?? '0',
        };
        const [newGuest] = await db.insert(guests).values(insertData as any).returning();
        return newGuest;
    },

    async findGuests(hotelId: number, filters: { query?: string; isVip?: boolean; isBanned?: boolean; nationality?: string; roomNumber?: string; dateOfStay?: string; customerType?: string }) {
        const conditions: SQL[] = [eq(guests.hotelId, hotelId)];

        if (filters.customerType) {
            conditions.push(eq(guests.customerType, filters.customerType as any));
        }

        if (filters.query) {
            const search = `%${filters.query}%`;
            conditions.push(or(
                ilike(guests.fullName, search),
                ilike(guests.firstName, search),
                ilike(guests.lastName, search),
                ilike(guests.uniqueId, search),
                ilike(guests.phone, search),
                ilike(guests.email, search),
                ilike(guests.idNumber, search),
                ilike(guests.panNumber, search),
                ilike(guests.vatNumber, search)
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
        assertValidGuestId(guestId);
        // Verify guest belongs to hotel
        await this.getGuestById(hotelId, guestId);

        // Get all bookings for this guest
        const guestBookings = await db.query.bookings.findMany({
            where: and(eq(bookings.guestId, guestId), eq(bookings.hotelId, hotelId)),
            columns: { id: true }
        });
        const bookingIds = guestBookings.map(b => b.id);

        // Get all orders directly linked to this guest (restaurant-only customers)
        const guestOrders = await db.query.orders.findMany({
            where: and(eq(orders.guestId, guestId), eq(orders.hotelId, hotelId)),
            columns: { id: true }
        });
        const orderIds = guestOrders.map(o => o.id);

        let guestInvoices: any[] = [];
        let guestPayments: any[] = [];

        if (bookingIds.length > 0) {
            // Fetch Invoices linked to bookings
            const bookingInvoices = await db.query.invoices.findMany({
                where: and(
                    eq(invoices.hotelId, hotelId),
                    inArray(invoices.bookingId, bookingIds)
                ),
                orderBy: desc(invoices.createdAt)
            });
            guestInvoices.push(...bookingInvoices);

            // Fetch Payments linked to bookings
            const bookingPayments = await db.query.payments.findMany({
                where: and(
                    eq(payments.hotelId, hotelId),
                    inArray(payments.bookingId, bookingIds)
                ),
                orderBy: desc(payments.createdAt)
            });
            guestPayments.push(...bookingPayments);
        }

        // Fetch all orders linked to this guest (directly or via bookings)
        let allOrderIds = [...new Set([...orderIds])];
        if (bookingIds.length > 0) {
            const bookingOrders = await db.query.orders.findMany({
                where: and(
                    eq(orders.hotelId, hotelId),
                    inArray(orders.bookingId, bookingIds)
                ),
                columns: { id: true }
            });
            allOrderIds = [...new Set([...allOrderIds, ...bookingOrders.map(o => o.id)])];
        }

        let guestOrdersList: any[] = [];
        if (allOrderIds.length > 0) {
            guestOrdersList = await db.query.orders.findMany({
                where: and(
                    eq(orders.hotelId, hotelId),
                    inArray(orders.id, allOrderIds)
                ),
                orderBy: desc(orders.createdAt)
            });

            // Fetch Payments linked to orders (restaurant orders)
            const orderPayments = await db.query.payments.findMany({
                where: and(
                    eq(payments.hotelId, hotelId),
                    inArray(payments.orderId, allOrderIds)
                ),
                orderBy: desc(payments.createdAt)
            });
            // Avoid duplicates if payment is linked to both booking and order
            const existingPaymentIds = new Set(guestPayments.map(p => p.id));
            guestPayments.push(...orderPayments.filter(p => !existingPaymentIds.has(p.id)));
        }

        const liveFolio = await FolioService.getCustomerFolio(hotelId, guestId);
        const summary = liveFolio.summary ?? {};

        return {
            invoices: guestInvoices,
            payments: guestPayments,
            orders: guestOrdersList,
            folioCharges: liveFolio.charges ?? [],
            liveFolio,
            stats: {
                totalInvoiced: summary.totalCharges ?? 0,
                totalPaid: summary.totalPayments ?? 0,
                balance: summary.balance ?? 0,
                liveBalance: summary.balance ?? 0,
                liveCharges: summary.totalCharges ?? 0,
            },
        };
    },

    async getGuestById(hotelId: number, guestId: string) {
        assertValidGuestId(guestId);
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
                },
                orders: {
                    limit: 10,
                    orderBy: desc(orders.createdAt),
                    with: {
                        items: {
                            with: {
                                menuItem: true
                            }
                        }
                    }
                }
            }
        });

        if (!guest) throw new NotFoundError('Guest');
        return guest;
    },

    async updateGuest(hotelId: number, guestId: string, data: Partial<typeof guests.$inferInsert>) {
        assertValidGuestId(guestId);
        const allowed = [
            'firstName', 'lastName', 'fullName', 'uniqueId', 'phone', 'email',
            'fatherName', 'dob', 'occupation', 'nationality',
            'address', 'city', 'country',
            'idType', 'idNumber', 'panNumber', 'vatNumber',
            'openingDueAmount', 'photoUrl', 'signatureUrl', 'customerType',
            'notes', 'isVip', 'isBanned'
        ];
        const updateData: any = {};
        const raw = data as any;
        for (const key of allowed) {
            if (raw[key] !== undefined) updateData[key] = raw[key];
        }
        const [updated] = await db.update(guests)
            .set({ ...updateData, updatedAt: new Date() })
            .where(and(
                eq(guests.id, guestId),
                eq(guests.hotelId, hotelId)
            ))
            .returning();

        if (!updated) throw new NotFoundError('Guest');
        return updated;
    },

    async deleteGuest(hotelId: number, guestId: string) {
        assertValidGuestId(guestId);
        // Check if guest has active bookings
        const activeBookings = await db.query.bookings.findMany({
            where: and(
                eq(bookings.guestId, guestId),
                eq(bookings.hotelId, hotelId),
                inArray(bookings.status, ['CONFIRMED', 'CHECKED_IN'])
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
