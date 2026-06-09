import { db } from '../../db';
import { hotels, payments, bookings } from '../../db/schema';
import { eq, and, gte, lt, sum, count } from 'drizzle-orm';
import { NotificationChannelService } from '../notifications/notification-channel.service';
import { logger } from '../../shared/logger';

/**
 * Emails each active hotel a short "yesterday" business summary every morning.
 * Uses the hotel's configured email channel (graceful — skips hotels without
 * an email set or channel configured).
 */
export const DailyDigestService = {
    async sendDailyDigests() {
        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);
        const yStart = new Date(dayStart.getTime() - 86400000); // yesterday 00:00
        const yEnd = dayStart;                                  // today 00:00
        const dateLabel = yStart.toLocaleDateString();

        const activeHotels = await db.query.hotels.findMany({
            where: eq(hotels.isActive, true),
            columns: { id: true, name: true, email: true, currency: true },
        });

        let sent = 0;
        for (const hotel of activeHotels) {
            if (!hotel.email) continue;
            try {
                const [rev] = await db.select({ total: sum(payments.amount) })
                    .from(payments)
                    .where(and(eq(payments.hotelId, hotel.id), gte(payments.createdAt, yStart), lt(payments.createdAt, yEnd)));
                const [arrivals] = await db.select({ c: count() })
                    .from(bookings)
                    .where(and(eq(bookings.hotelId, hotel.id), gte(bookings.checkIn, yStart), lt(bookings.checkIn, yEnd)));
                const [departures] = await db.select({ c: count() })
                    .from(bookings)
                    .where(and(eq(bookings.hotelId, hotel.id), gte(bookings.checkOut, yStart), lt(bookings.checkOut, yEnd)));
                const [inHouse] = await db.select({ c: count() })
                    .from(bookings)
                    .where(and(eq(bookings.hotelId, hotel.id), eq(bookings.status, 'CHECKED_IN')));

                const cur = hotel.currency || 'NPR';
                await NotificationChannelService.sendBrandedEmail(hotel.id, hotel.email, `Daily summary — ${dateLabel}`, {
                    heading: `Yesterday at ${hotel.name}`,
                    intro: `Business summary for ${dateLabel}.`,
                    rows: [
                        { label: 'Revenue collected', value: `${cur} ${parseFloat(rev?.total || '0').toLocaleString()}` },
                        { label: 'Arrivals', value: String(arrivals?.c ?? 0) },
                        { label: 'Departures', value: String(departures?.c ?? 0) },
                        { label: 'Currently in-house', value: String(inHouse?.c ?? 0) },
                    ],
                });
                sent++;
            } catch (err) {
                logger.warn?.({ err, hotelId: hotel.id }, '[daily-digest] failed for hotel');
            }
        }
        if (sent > 0) logger.info(`[daily-digest] sent ${sent} digests`);
        return sent;
    },
};
