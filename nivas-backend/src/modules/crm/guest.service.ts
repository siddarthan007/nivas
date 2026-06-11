import { db } from '../../db';
import { guestProfiles, bookings } from '../../db/schema';
import { eq, and, like, desc, sql } from 'drizzle-orm';
import { NotFoundError } from '../../utils/errors';

export const GuestService = {
    /**
     * Create/update a CRM guest profile from a booking so the CRM auto-populates
     * with real guests (matched by phone). Best-effort — never throws.
     */
    async upsertFromBooking(hotelId: number, data: { fullName?: string | null; phone?: string | null; email?: string | null; nationality?: string | null }) {
        try {
            const phone = (data.phone || '').trim();
            const fullName = (data.fullName || '').trim();
            if (!phone || !fullName) return; // both are required columns
            const existing = await db.query.guestProfiles.findFirst({
                where: and(eq(guestProfiles.hotelId, hotelId), eq(guestProfiles.phone, phone)),
            });
            if (existing) {
                await db.update(guestProfiles).set({
                    fullName,
                    email: data.email || existing.email,
                    nationality: data.nationality || existing.nationality,
                    totalStays: (existing.totalStays || 0) + 1,
                    updatedAt: new Date(),
                }).where(eq(guestProfiles.id, existing.id));
            } else {
                await db.insert(guestProfiles).values({
                    hotelId, fullName, phone,
                    email: data.email || null,
                    nationality: data.nationality || null,
                    totalStays: 1,
                });
            }
        } catch { /* best-effort */ }
    },

    async searchGuests(hotelId: number, query: string | undefined) {
        const filters = [eq(guestProfiles.hotelId, hotelId)];

        if (query) {
            filters.push(like(guestProfiles.fullName, `%${query}%`));
        }

        const profiles = await db.query.guestProfiles.findMany({
            where: and(...filters),
            orderBy: [desc(guestProfiles.updatedAt)],
            limit: 50
        });

        // Compute stays and total spend dynamically from bookings (matched by phone)
        const phoneList = profiles.map(p => p.phone).filter(Boolean) as string[];
        if (phoneList.length === 0) return profiles;

        const stayCounts = await db.select({
            phone: bookings.guestPhone,
            count: sql<number>`count(${bookings.id})`,
            total: sql<number>`COALESCE(SUM(${bookings.totalAmount}::numeric), 0)`
        })
            .from(bookings)
            .where(and(
                eq(bookings.hotelId, hotelId),
                sql`${bookings.guestPhone} IN ${phoneList}`
            ))
            .groupBy(bookings.guestPhone);

        const statsByPhone = new Map(stayCounts.map(s => [s.phone, { count: Number(s.count), total: Number(s.total) }]));

        return profiles.map(p => {
            const stats = statsByPhone.get(p.phone);
            return {
                ...p,
                totalStays: stats?.count ?? p.totalStays ?? 0,
                totalSpend: (stats?.total ?? Number(p.totalSpend ?? 0)).toString()
            };
        });
    },

    async getGuestHistory(hotelId: number, guestId: string) {
        const guest = await db.query.guestProfiles.findFirst({
            where: and(
                eq(guestProfiles.id, guestId),
                eq(guestProfiles.hotelId, hotelId)
            )
        });

        if (!guest) throw new NotFoundError('Guest');

        const stayHistory = await db.query.bookings.findMany({
            where: and(
                eq(bookings.hotelId, hotelId),
                eq(bookings.guestPhone, guest.phone)
            ),
            orderBy: [desc(bookings.checkIn)]
        });

        return {
            profile: guest,
            history: stayHistory
        };
    },

    async createGuestProfile(hotelId: number, data: any) {
        const [guest] = await db.insert(guestProfiles).values({
            hotelId,
            fullName: data.fullName,
            phone: data.phone,
            email: data.email,
            nationality: data.nationality,
            preferences: data.preferences,
            tags: data.tags || [],
            isVip: data.isVip || false
        }).returning();
        return guest;
    },

    async getGuestById(hotelId: number, guestId: string) {
        const guest = await db.query.guestProfiles.findFirst({
            where: and(eq(guestProfiles.id, guestId), eq(guestProfiles.hotelId, hotelId))
        });
        if (!guest) throw new NotFoundError('Guest');
        return guest;
    },

    async updateGuestProfile(hotelId: number, guestId: string, data: any) {
        const [updated] = await db.update(guestProfiles)
            .set({
                preferences: data.preferences,
                tags: data.tags,
                isVip: data.isVip,
                updatedAt: new Date()
            })
            .where(and(
                eq(guestProfiles.id, guestId),
                eq(guestProfiles.hotelId, hotelId)
            ))
            .returning();

        if (!updated) throw new NotFoundError('Guest');
        return updated;
    }
};
