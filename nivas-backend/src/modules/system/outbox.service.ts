import { db } from '../../db';
import { outboxEvents } from '../../db/schema';
import { eq, asc } from 'drizzle-orm';
import { getRedis } from '../../shared/redis';
import { logger } from '../../shared/logger';

const LOCK_KEY = 'lock:outbox:relay';
const LOCK_TTL = 50; // seconds — shorter than the 60s cron interval

export const OutboxService = {
    /**
     * Add an event to the outbox, ideally within the same DB transaction as the
     * domain write (so the event and the state change commit together).
     */
    async addEvent(
        hotelId: number | null,
        aggregateType: string,
        aggregateId: string,
        eventType: string,
        payload: any,
        tx: any = db
    ) {
        return tx.insert(outboxEvents).values({
            hotelId, aggregateType, aggregateId, eventType, payload, status: 'PENDING',
        }).returning();
    },

    /**
     * Relay pending events to Redis Streams. Run periodically (cron). Guarded by
     * a distributed lock so that with multiple app instances only ONE processes
     * the batch — no double-publish, no races.
     */
    async processPendingEvents() {
        const redis = getRedis();
        if (!redis || redis.status !== 'ready') return 0; // Redis down → skip, retry next tick

        // Acquire the lock with a UNIQUE token; if another instance holds it, skip.
        const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        let locked = false;
        try {
            locked = (await redis.set(LOCK_KEY, token, 'EX', LOCK_TTL, 'NX')) === 'OK';
        } catch { return 0; }
        if (!locked) return 0;

        try {
            const pendingEvents = await db.query.outboxEvents.findMany({
                where: eq(outboxEvents.status, 'PENDING'),
                orderBy: [asc(outboxEvents.createdAt)],
                limit: 100,
            });
            if (pendingEvents.length === 0) return 0;

            let processed = 0;
            for (const event of pendingEvents) {
                try {
                    await redis.xadd(
                        `stream:outbox:${event.aggregateType}`,
                        '*',
                        'event', JSON.stringify({
                            id: event.id,
                            hotelId: event.hotelId,
                            aggregateId: event.aggregateId,
                            eventType: event.eventType,
                            payload: event.payload,
                            timestamp: event.createdAt,
                        })
                    );
                    await db.update(outboxEvents)
                        .set({ status: 'DELIVERED', deliveredAt: new Date(), attempts: (event.attempts ?? 0) + 1 })
                        .where(eq(outboxEvents.id, event.id));
                    processed++;
                } catch (err: any) {
                    const newAttempts = (event.attempts ?? 0) + 1;
                    const status = newAttempts >= 5 ? 'FAILED' : 'PENDING';
                    await db.update(outboxEvents)
                        .set({ status, attempts: newAttempts, errorMsg: String(err?.message || err).slice(0, 500) })
                        .where(eq(outboxEvents.id, event.id));
                    logger.warn?.({ err: err?.message, eventId: event.id }, '[outbox] relay failed');
                }
            }
            return processed;
        } finally {
            // Compare-and-delete: only release if WE still own the lock (it may have
            // expired and been re-acquired by another instance during a slow batch).
            try {
                await redis.eval('if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) end', 1, LOCK_KEY, token);
            } catch { /* ignore */ }
        }
    },
};
