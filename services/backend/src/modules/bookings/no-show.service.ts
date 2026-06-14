import { db } from '../../db';
import { bookings, hotels } from '../../db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { BookingsService } from '../bookings/bookings.service';
import { logger } from '../../shared/logger';

/**
 * Auto-cancel confirmed bookings as no-show when check-in date has passed
 * and the hotel's no-show policy window (hours after check-in time) elapses.
 */
export const NoShowService = {
    async processHotel(hotelId: number) {
        const hotel = await db.query.hotels.findFirst({
            where: eq(hotels.id, hotelId),
            columns: { checkInTime: true, paymentConfig: true },
        });
        if (!hotel) return { cancelled: 0 };

        const policy = ((hotel.paymentConfig as Record<string, unknown>) || {}).noShow as {
            enabled?: boolean;
            graceHours?: number;
        } | undefined;

        if (policy?.enabled === false) return { cancelled: 0 };

        const graceHours = policy?.graceHours ?? 6;
        const checkInTime = hotel.checkInTime || '14:00';
        const [hh, mm] = checkInTime.split(':').map(Number);
        const cutoff = new Date();
        cutoff.setHours(cutoff.getHours() - graceHours);

        const candidates = await db.query.bookings.findMany({
            where: and(
                eq(bookings.hotelId, hotelId),
                eq(bookings.status, 'CONFIRMED'),
                lt(bookings.checkIn, cutoff),
            ),
            columns: { id: true, checkIn: true },
        });

        let cancelled = 0;
        for (const b of candidates) {
            const checkInDeadline = new Date(b.checkIn);
            checkInDeadline.setHours(hh || 14, mm || 0, 0, 0);
            checkInDeadline.setHours(checkInDeadline.getHours() + graceHours);
            if (new Date() < checkInDeadline) continue;

            try {
                await BookingsService.cancelBooking(
                    hotelId,
                    'system',
                    b.id,
                    'NO_SHOW — auto-cancelled by policy',
                    0,
                );
                cancelled++;
            } catch (err) {
                logger.error({ err, bookingId: b.id }, '[NoShow] Failed to auto-cancel');
            }
        }
        return { cancelled };
    },

    async processAll() {
        const hotelRows = await db.query.hotels.findMany({ columns: { id: true } });
        let total = 0;
        for (const h of hotelRows) {
            const { cancelled } = await this.processHotel(h.id);
            total += cancelled;
        }
        return { total };
    },
};
