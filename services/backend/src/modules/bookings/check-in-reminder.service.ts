import { db } from '../../db';
import { bookings, hotels } from '../../db/schema';
import { eq, and, gte, lt } from 'drizzle-orm';
import { NotificationChannelService } from '../notifications/notification-channel.service';
import { getRedis } from '../../shared/redis';
import { logger } from '../../shared/logger';

/**
 * Send check-in reminders for tomorrow's confirmed arrivals.
 * Runs once daily; Redis dedupe prevents double-sends per booking per day.
 */
export const CheckInReminderService = {
    async processHotel(hotelId: number) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const dayAfter = new Date(tomorrow);
        dayAfter.setDate(dayAfter.getDate() + 1);

        const [hotel, arrivals] = await Promise.all([
            db.query.hotels.findFirst({
                where: eq(hotels.id, hotelId),
                columns: { name: true, checkInTime: true },
            }),
            db.query.bookings.findMany({
                where: and(
                    eq(bookings.hotelId, hotelId),
                    eq(bookings.status, 'CONFIRMED'),
                    gte(bookings.checkIn, tomorrow),
                    lt(bookings.checkIn, dayAfter),
                ),
                with: { room: { columns: { number: true } } },
            }),
        ]);

        if (!hotel || arrivals.length === 0) return { sent: 0 };

        const redis = getRedis();
        const dateKey = tomorrow.toISOString().slice(0, 10);
        let sent = 0;

        for (const b of arrivals) {
            const dedupeKey = `checkin-reminder:${b.id}:${dateKey}`;
            if (redis?.status === 'ready') {
                const acquired = await redis.set(dedupeKey, '1', 'EX', 86400, 'NX');
                if (acquired !== 'OK') continue;
            }

            if (!b.guestPhone && !b.guestEmail) continue;

            try {
                await NotificationChannelService.sendCheckInReminder(
                    hotelId,
                    b.guestPhone || '',
                    b.guestEmail || undefined,
                    {
                        guestName: b.guestName,
                        hotelName: hotel.name,
                        roomNumber: String((b as { room?: { number?: number } }).room?.number || ''),
                        checkInTime: hotel.checkInTime || '14:00',
                    },
                );
                sent++;
            } catch (err) {
                logger.error({ err, bookingId: b.id }, '[CheckInReminder] Send failed');
            }
        }
        return { sent };
    },

    async processAll() {
        const hotels = await db.query.hotels.findMany({ columns: { id: true } });
        let sent = 0;
        for (const h of hotels) {
            const r = await this.processHotel(h.id);
            sent += r.sent;
        }
        return { sent };
    },
};
