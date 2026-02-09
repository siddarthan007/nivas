import { db } from '../../db';
import { guestProfiles, bookings } from '../../db/schema';
import { eq, and, like, desc } from 'drizzle-orm';
import { NotFoundError } from '../../utils/errors';

export const GuestService = {
    async searchGuests(hotelId: number, query: string | undefined) {
        const filters = [eq(guestProfiles.hotelId, hotelId)];

        if (query) {
            filters.push(like(guestProfiles.fullName, `%${query}%`));
        }

        return await db.query.guestProfiles.findMany({
            where: and(...filters),
            orderBy: [desc(guestProfiles.updatedAt)],
            limit: 50
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
