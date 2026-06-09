import { db } from '../../db';
import { hotels, payments, bookings, rooms } from '../../db/schema';
import { eq, and, gte, sum, count } from 'drizzle-orm';
import { AiService } from '../../shared/ai.service';
import { cache } from '../../shared/redis';
import { ForecastService } from './forecast.service';
import { ReviewsService } from '../reviews/reviews.service';

const MS = 86400000;
const num = (v: any) => Math.round(parseFloat(v ?? '0') || 0);

/**
 * "Ask your hotel" — RAG-style NL analytics. We assemble a COMPACT, hotel-scoped
 * facts snapshot (real numbers from existing services) and let Gemini Flash answer
 * the question grounded ONLY in that data. No SQL is generated/run by the model →
 * safe + token-efficient + accurate (the model narrates, it doesn't compute totals).
 */
export const AiAnalyticsService = {
    async buildContext(hotelId: number) {
        const now = new Date();
        const d7 = new Date(now.getTime() - 7 * MS);
        const d30 = new Date(now.getTime() - 30 * MS);

        const [hotel, [roomsRow], [rev7], [rev30], [occRow], forecast, reviews] = await Promise.all([
            db.query.hotels.findFirst({ where: eq(hotels.id, hotelId), columns: { name: true, currency: true } }),
            db.select({ c: count() }).from(rooms).where(eq(rooms.hotelId, hotelId)),
            db.select({ t: sum(payments.amount) }).from(payments).where(and(eq(payments.hotelId, hotelId), gte(payments.createdAt, d7))),
            db.select({ t: sum(payments.amount) }).from(payments).where(and(eq(payments.hotelId, hotelId), gte(payments.createdAt, d30))),
            db.select({ c: count() }).from(bookings).where(and(eq(bookings.hotelId, hotelId), eq(bookings.status, 'CHECKED_IN'))),
            ForecastService.getForecast(hotelId, 90).catch(() => null),
            ReviewsService.insights(hotelId, 90).catch(() => null),
        ]);

        const totalRooms = roomsRow?.c || 0;
        const occupiedNow = occRow?.c || 0;

        // Revenue + count by room type over last 30 days (compact, top 6).
        const typeRows = await db.query.bookings.findMany({
            where: and(eq(bookings.hotelId, hotelId), gte(bookings.createdAt, d30)),
            columns: { totalAmount: true, roomId: true },
            with: { room: { columns: { type: true } } },
        });
        const byType: Record<string, { bookings: number; revenue: number }> = {};
        for (const b of typeRows as any[]) {
            const t = b.room?.type || 'UNKNOWN';
            byType[t] = byType[t] || { bookings: 0, revenue: 0 };
            byType[t].bookings += 1;
            byType[t].revenue += num(b.totalAmount);
        }
        const roomTypes = Object.entries(byType).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 6)
            .map(([type, v]) => ({ type, ...v }));

        return {
            hotel: hotel?.name || 'Hotel',
            currency: hotel?.currency || 'NPR',
            asOf: now.toISOString().slice(0, 10),
            rooms: { total: totalRooms, occupiedNow, occupancyNowPct: totalRooms ? Math.round((occupiedNow / totalRooms) * 1000) / 10 : 0 },
            revenue: { last7Days: num(rev7?.t), last30Days: num(rev30?.t) },
            forecast: forecast ? { adr: forecast.adr, avgLeadDays: forecast.avgLeadDays, windows: forecast.windows } : null,
            roomTypesLast30d: roomTypes,
            reviews: reviews ? { total: reviews.total, avgRating: reviews.avgRating, sentiment: reviews.sentiment, recurringComplaints: reviews.recurringComplaints.slice(0, 5) } : null,
        };
    },

    async ask(hotelId: number, question: string): Promise<{ answer: string; aiUsed: boolean }> {
        const enabled = await AiService.isEnabled(hotelId);
        if (!enabled) {
            return { answer: 'AI is not enabled for this hotel. Enable it and add a Gemini API key in Settings → AI.', aiUsed: false };
        }
        await AiService.guardUsage(hotelId); // daily/burst cap → throws if exceeded
        // Cache the facts snapshot 5 min so repeated questions don't rebuild it.
        const context = await cache.getOrSet(`ai:ctx:${hotelId}`, 300, () => this.buildContext(hotelId));
        const system = [
            'You are the analytics assistant for a hotel. Answer the user ONLY using the JSON DATA provided.',
            'Rules: never invent numbers; if the data does not contain the answer, say so plainly.',
            `Use the currency code from the data. Be concise (2-5 sentences), lead with the number, add a brief insight.`,
            'When comparing periods or assessing "underpriced", reason from ADR, occupancy and revenue-per-room-type in the data.',
            'Format the answer in clean Markdown: **bold** the key figures and use short bullet lists for breakdowns. Keep it tight. Do not mention "JSON" or "data" — just answer.',
        ].join(' ');
        const user = `DATA:\n${JSON.stringify(context)}\n\nQUESTION: ${question}`;
        const answer = await AiService.generate(hotelId, system, user, 450);
        return { answer: answer || 'Sorry, I could not generate an answer right now.', aiUsed: !!answer };
    },
};
