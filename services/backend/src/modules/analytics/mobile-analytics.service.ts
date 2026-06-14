import { db } from '../../db';
import { mobileEvents } from '../../db/schema';
import { eq, and, gte, count, avg } from 'drizzle-orm';

export const MobileAnalyticsService = {
    async ingest(hotelId: number, userId: string, events: any[]) {
        if (!events.length) return;
        await db.insert(mobileEvents).values(
            events.map(e => ({
                hotelId,
                userId,
                type: e.type,
                name: e.name,
                timestamp: new Date(e.timestamp),
                metadata: e.metadata || null,
                durationMs: e.durationMs || null,
            }))
        );
    },

    async getSummary(hotelId: number, days: number) {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const [
            screenViews,
            actions,
            errors,
            sessions
        ] = await Promise.all([
            db.select({ name: mobileEvents.name, count: count() }).from(mobileEvents)
                .where(and(eq(mobileEvents.hotelId, hotelId), eq(mobileEvents.type, 'screen_view'), gte(mobileEvents.timestamp, since)))
                .groupBy(mobileEvents.name),
            db.select({ name: mobileEvents.name, count: count() }).from(mobileEvents)
                .where(and(eq(mobileEvents.hotelId, hotelId), eq(mobileEvents.type, 'action'), gte(mobileEvents.timestamp, since)))
                .groupBy(mobileEvents.name),
            db.select({ name: mobileEvents.name, count: count() }).from(mobileEvents)
                .where(and(eq(mobileEvents.hotelId, hotelId), eq(mobileEvents.type, 'error'), gte(mobileEvents.timestamp, since)))
                .groupBy(mobileEvents.name),
            db.select({
                count: count(),
                avgDuration: avg(mobileEvents.durationMs)
            }).from(mobileEvents)
                .where(and(eq(mobileEvents.hotelId, hotelId), eq(mobileEvents.type, 'session'), gte(mobileEvents.timestamp, since))),
        ]);

        return {
            period: { days, since: since.toISOString() },
            screenViews,
            actions,
            errors,
            sessions: sessions[0] ?? { count: 0, avgDuration: null },
        };
    }
};
