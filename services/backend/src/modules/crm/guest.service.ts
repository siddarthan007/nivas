import { db } from '../../db';
import { guestProfiles, bookings, messages, reviews, maintenanceTickets, auditLogs } from '../../db/schema';
import { eq, and, like, desc, sql, or, inArray } from 'drizzle-orm';
import { NotFoundError } from '../../utils/errors';

export const GuestService = {
    /**
     * Create/update a CRM guest profile from a booking so the CRM auto-populates
     * with real guests (matched by phone). Best-effort — never throws.
     */
    async upsertFromBooking(hotelId: number, data: {
        guestId?: string | null;
        fullName?: string | null;
        phone?: string | null;
        email?: string | null;
        nationality?: string | null;
    }) {
        try {
            const phone = (data.phone || '').trim();
            const fullName = (data.fullName || '').trim();
            if (!phone || !fullName) return;
            const guestId = data.guestId?.trim() || null;
            const existing = await db.query.guestProfiles.findFirst({
                where: and(eq(guestProfiles.hotelId, hotelId), eq(guestProfiles.phone, phone)),
            });
            if (existing) {
                await db.update(guestProfiles).set({
                    fullName,
                    email: data.email || existing.email,
                    nationality: data.nationality || existing.nationality,
                    guestId: existing.guestId || guestId,
                    totalStays: (existing.totalStays || 0) + 1,
                    updatedAt: new Date(),
                }).where(eq(guestProfiles.id, existing.id));
            } else {
                await db.insert(guestProfiles).values({
                    hotelId, fullName, phone,
                    guestId,
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
    },

    /** Unified guest timeline: stays, messages, complaints (reviews/maintenance), folio events. */
    async getGuestTimeline(hotelId: number, guestProfileId: string) {
        const guest = await db.query.guestProfiles.findFirst({
            where: and(eq(guestProfiles.id, guestProfileId), eq(guestProfiles.hotelId, hotelId)),
        });
        if (!guest) throw new NotFoundError('Guest');

        const stayHistory = await db.query.bookings.findMany({
            where: and(eq(bookings.hotelId, hotelId), eq(bookings.guestPhone, guest.phone)),
            orderBy: [desc(bookings.checkIn)],
            with: { room: { columns: { number: true } } },
        });

        const bookingIds = stayHistory.map(b => b.id);
        const roomIds = [...new Set(stayHistory.map(b => b.roomId).filter(Boolean))] as number[];

        const [guestReviews, tickets, staffMessages] = await Promise.all([
            db.query.reviews.findMany({
                where: and(
                    eq(reviews.hotelId, hotelId),
                    or(
                        like(reviews.guestName, guest.fullName),
                        ...(bookingIds.length ? [inArray(reviews.bookingId, bookingIds)] : []),
                    ),
                ),
                orderBy: [desc(reviews.createdAt)],
                limit: 50,
            }),
            roomIds.length > 0
                ? db.query.maintenanceTickets.findMany({
                    where: and(
                        eq(maintenanceTickets.hotelId, hotelId),
                        inArray(maintenanceTickets.roomId, roomIds),
                    ),
                    orderBy: [desc(maintenanceTickets.createdAt)],
                    limit: 30,
                })
                : Promise.resolve([]),
            roomIds.length > 0
                ? db.query.messages.findMany({
                    where: and(
                        eq(messages.hotelId, hotelId),
                        inArray(messages.roomId, roomIds),
                    ),
                    orderBy: [desc(messages.createdAt)],
                    limit: 50,
                })
                : Promise.resolve([]),
        ]);

        type TimelineEntry = {
            id: string;
            type: string;
            title: string;
            detail?: string;
            at: string;
            meta?: Record<string, unknown>;
        };

        const timeline: TimelineEntry[] = [];

        for (const b of stayHistory) {
            timeline.push({
                id: `stay-${b.id}`,
                type: 'STAY',
                title: `${b.status} — Room ${(b as { room?: { number?: number } }).room?.number || '?'}`,
                detail: `${new Date(b.checkIn).toLocaleDateString()} → ${new Date(b.checkOut).toLocaleDateString()}`,
                at: (b.createdAt || b.checkIn).toISOString(),
                meta: { bookingId: b.id, status: b.status },
            });
        }

        for (const m of staffMessages) {
            timeline.push({
                id: `msg-${m.id}`,
                type: 'MESSAGE',
                title: 'Staff message',
                detail: m.content?.slice(0, 200),
                at: (m.createdAt || new Date()).toISOString(),
                meta: { roomId: m.roomId },
            });
        }

        for (const r of guestReviews) {
            const isComplaint = r.sentiment === 'NEGATIVE' || (r.rating != null && r.rating <= 2);
            timeline.push({
                id: `review-${r.id}`,
                type: isComplaint ? 'COMPLAINT' : 'REVIEW',
                title: isComplaint ? `Complaint (${r.rating}★)` : `Review (${r.rating}★)`,
                detail: r.comment || undefined,
                at: (r.createdAt || new Date()).toISOString(),
                meta: { tags: r.tags, source: r.source },
            });
        }

        for (const t of tickets) {
            timeline.push({
                id: `ticket-${t.id}`,
                type: 'MAINTENANCE',
                title: t.title,
                detail: t.description || undefined,
                at: (t.createdAt || new Date()).toISOString(),
                meta: { priority: t.priority, status: t.status, roomId: t.roomId },
            });
        }

        timeline.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

        return {
            profile: guest,
            timeline,
            summary: {
                totalStays: stayHistory.length,
                complaints: guestReviews.filter(r => r.sentiment === 'NEGATIVE').length,
                reviews: guestReviews.length,
            },
        };
    },
};
