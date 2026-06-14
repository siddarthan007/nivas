import { db } from '../../db';
import { backgroundJobs, hotels } from '../../db/schema';
import { eq, and, lte, lt, asc } from 'drizzle-orm';
import { NotificationChannelService } from '../notifications/notification-channel.service';
import { applyMessageTemplate } from '../../utils/message-template.util';

/**
 * Background Job Service (Postgres-based)
 * Handles delayed tasks with retries and basic concurrency control.
 */
export const JobService = {
    /**
     * Enqueue a new background job
     * @param delayMinutes Number of minutes to wait before processing
     */
    async enqueue(hotelId: number, type: string, payload: any, delayMinutes: number = 0) {
        const scheduledAt = new Date();
        scheduledAt.setMinutes(scheduledAt.getMinutes() + delayMinutes);

        await db.insert(backgroundJobs).values({
            hotelId,
            type,
            payload,
            status: 'PENDING',
            scheduledAt,
            attempts: 0
        });
    },

    /**
     * Process pending jobs that are due
     * Includes basic locking and retry logic
     */
    async processPendingJobs(maxRetries: number = 3) {
        const now = new Date();
        const results = [];

        // Reap stuck jobs: a crash between claim and completion leaves a job
        // PROCESSING forever (never re-selected). Re-queue any held >10 min.
        const stuckBefore = new Date(now.getTime() - 10 * 60 * 1000);
        await db.update(backgroundJobs)
            .set({ status: 'PENDING', updatedAt: now })
            .where(and(eq(backgroundJobs.status, 'PROCESSING'), lt(backgroundJobs.updatedAt, stuckBefore)));

        // 1. Fetch potential candidates (simple select, lock in loop/transaction)
        // Note: Full "SKIP LOCKED" support depends on driver. 
        // We will claim jobs atomically by setting status to PROCESSING.
        const pendingJobs = await db.query.backgroundJobs.findMany({
            where: and(
                eq(backgroundJobs.status, 'PENDING'),
                lte(backgroundJobs.scheduledAt, now)
            ),
            orderBy: [asc(backgroundJobs.scheduledAt)],
            limit: 10
        });

        for (const job of pendingJobs) {
            // 2. Atomically claim the job
            const claimed = await db.update(backgroundJobs)
                .set({ status: 'PROCESSING', updatedAt: new Date() })
                .where(and(
                    eq(backgroundJobs.id, job.id),
                    eq(backgroundJobs.status, 'PENDING') // Optimistic concurrency check
                ))
                .returning();

            if (!claimed.length || !claimed[0]) continue; // Lost race or undefined

            const currentJob = claimed[0];

            try {
                // 3. Execute job logic
                switch (currentJob.type) {
                    case 'SEND_REVIEW_REQUEST':
                        await this.handleReviewRequest(currentJob);
                        break;
                    case 'SEND_BOOKING_CONFIRMATION':
                        await this.handleBookingConfirmation(currentJob);
                        break;
                    case 'GENERATE_REPORT':
                        await this.handleReportGeneration(currentJob);
                        break;
                    case 'SYNC_CHANNEL':
                        await this.handleChannelSync(currentJob);
                        break;
                    case 'SEND_OUTSTANDING_REMINDER':
                        await this.handleOutstandingReminder(currentJob);
                        break;
                    case 'SEND_CHECKIN_REMINDER':
                        await this.handleCheckInReminder(currentJob);
                        break;
                    default:
                        // Unknown type → fail (was silently marked COMPLETED, dropping the job).
                        throw new Error(`Unknown job type: ${currentJob.type}`);
                }

                // 4. Success: Mark as COMPLETED
                await db.update(backgroundJobs)
                    .set({ status: 'COMPLETED', updatedAt: new Date() })
                    .where(eq(backgroundJobs.id, currentJob.id));

                results.push({ id: currentJob.id, status: 'COMPLETED' });

            } catch (error) {
                console.error(`Job ${currentJob.id} failed:`, error);

                const nextAttempt = (currentJob.attempts || 0) + 1;

                if (nextAttempt >= maxRetries) {
                    // Max retries reached: Fail permanently
                    await db.update(backgroundJobs)
                        .set({
                            status: 'FAILED',
                            error: String(error),
                            updatedAt: new Date(),
                            attempts: nextAttempt
                        })
                        .where(eq(backgroundJobs.id, currentJob.id));
                    results.push({ id: currentJob.id, status: 'FAILED', error });
                } else {
                    // Retry: Backoff (exponential: 5m, 25m, 125m...)
                    const backoffMinutes = 5 * Math.pow(nextAttempt, 2);
                    const nextSchedule = new Date();
                    nextSchedule.setMinutes(nextSchedule.getMinutes() + backoffMinutes);

                    await db.update(backgroundJobs)
                        .set({
                            status: 'PENDING', // Re-queue
                            error: String(error),
                            updatedAt: new Date(),
                            scheduledAt: nextSchedule,
                            attempts: nextAttempt
                        })
                        .where(eq(backgroundJobs.id, currentJob.id));
                    results.push({ id: currentJob.id, status: 'RETRYING', nextAttemptAt: nextSchedule });
                }
            }
        }

        return results;
    },

    /**
     * Handler for Booking Confirmation Job
     */
    async handleBookingConfirmation(job: any) {
        const { guestName, guestPhone, guestEmail, hotelId, bookingRef, checkIn, checkOut } = job.payload;

        const hotel = await db.query.hotels.findFirst({
            where: eq(hotels.id, hotelId)
        });

        if (!hotel) throw new Error('Hotel not found');

        const message = `Dear ${guestName}, your booking at ${hotel.name} is confirmed! Ref: ${bookingRef}. Check-in: ${checkIn}, Check-out: ${checkOut}. We look forward to welcoming you!`;

        await NotificationChannelService.send(hotelId, guestPhone, guestEmail, message, 'booking_confirmation');
    },

    /**
     * Handler for Report Generation Job
     */
    async handleReportGeneration(job: any) {
        const { reportType, hotelId, params } = job.payload;
        // Report generation is handled synchronously for now.
        // This handler can be expanded for async PDF/Excel generation.
    },

    /**
     * Handler for Channel Sync Job
     */
    async handleChannelSync(job: any) {
        const { channelSettingId, hotelId, syncType } = job.payload;
        // Channel sync is a stub until OTA partnerships are established.
    },

    /**
     * Handler for Review Request Job
     */
    async handleReviewRequest(job: any) {
        const { guestName, guestPhone, guestEmail, hotelId } = job.payload;

        const hotel = await db.query.hotels.findFirst({
            where: eq(hotels.id, hotelId)
        });

        if (!hotel) throw new Error('Hotel not found');

        const reviewLink = `https://${hotel.slug}.nivas.com/review`;
        const vars = {
            guestName: String(guestName || 'Guest'),
            hotelName: hotel.name || 'Hotel',
            reviewLink,
        };
        const message = applyMessageTemplate(
            null,
            vars,
            `Hi ${vars.guestName}, thank you for staying at ${vars.hotelName}! We'd love to hear about your experience. Please leave us a review: ${reviewLink}`,
        );

        // Send via WhatsApp (primary) or Email
        // Note: NotificationChannelService handles its own errors or throws, which we catch above
        await NotificationChannelService.send(
            hotelId,
            guestPhone,
            guestEmail,
            message,
            'review_request'
        );
    },

    async handleOutstandingReminder(job: any) {
        const { guestName, guestPhone, guestEmail, hotelId, balance, currency } = job.payload;
        const hotel = await db.query.hotels.findFirst({ where: eq(hotels.id, hotelId) });
        if (!hotel) throw new Error('Hotel not found');
        const message = `Dear ${guestName}, your outstanding balance at ${hotel.name} is ${currency || 'NPR'} ${balance}. Please settle at your earliest convenience.`;
        await NotificationChannelService.send(hotelId, guestPhone, guestEmail, message, 'outstanding_balance');
    },

    async handleCheckInReminder(job: any) {
        const { guestName, guestPhone, guestEmail, hotelId, roomNumber, checkInTime } = job.payload;
        await NotificationChannelService.sendCheckInReminder(hotelId, guestPhone, guestEmail, {
            guestName, hotelName: (await db.query.hotels.findFirst({ where: eq(hotels.id, hotelId) }))?.name,
            roomNumber, checkInTime,
        });
    },
};
