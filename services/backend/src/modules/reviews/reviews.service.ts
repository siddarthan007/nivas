import { db } from '../../db';
import { reviews } from '../../db/schema';
import { eq, and, desc, gte, sql } from 'drizzle-orm';

// --- Cheap, LLM-free sentiment + complaint tagging -------------------------
const POS = ['great', 'good', 'excellent', 'amazing', 'clean', 'friendly', 'helpful', 'comfortable', 'lovely', 'wonderful', 'best', 'nice', 'recommend', 'perfect', 'awesome', 'spotless', 'delicious', 'spacious', 'quiet', 'value'];
const NEG = ['bad', 'dirty', 'rude', 'poor', 'terrible', 'awful', 'worst', 'noisy', 'slow', 'broken', 'cold', 'smell', 'unfriendly', 'expensive', 'overpriced', 'small', 'uncomfortable', 'leaking', 'stained', 'late', 'cockroach', 'bug', 'mould', 'mold', 'unclean', 'horrible', 'disappointing'];

// Complaint categories → keywords (for surfacing recurring issues).
const TAG_KEYWORDS: Record<string, string[]> = {
    cleanliness: ['clean', 'dirty', 'spotless', 'stain', 'dust', 'unclean', 'mould', 'mold', 'cockroach', 'bug', 'hygiene'],
    staff: ['staff', 'service', 'reception', 'rude', 'friendly', 'helpful', 'manager', 'waiter'],
    food: ['food', 'breakfast', 'restaurant', 'meal', 'delicious', 'menu', 'dinner', 'coffee', 'tea'],
    room: ['room', 'bed', 'pillow', 'spacious', 'small', 'comfortable', 'mattress'],
    noise: ['noise', 'noisy', 'loud', 'quiet', 'sleep'],
    wifi: ['wifi', 'internet', 'network', 'connection'],
    bathroom: ['bathroom', 'shower', 'toilet', 'water', 'hot water', 'leaking'],
    ac: ['ac', 'air condition', 'heater', 'cold', 'hot', 'temperature', 'fan'],
    value: ['price', 'value', 'expensive', 'overpriced', 'cheap', 'worth', 'money'],
    checkin: ['check-in', 'checkin', 'check in', 'checkout', 'check-out', 'wait', 'queue', 'late'],
};

function analyze(comment: string, rating?: number | null): { sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'; score: number; tags: string[] } {
    const text = (comment || '').toLowerCase();
    let score = 0;
    for (const w of POS) if (text.includes(w)) score += 1;
    for (const w of NEG) if (text.includes(w)) score -= 1.2; // weight complaints a touch higher
    // Rating is the strongest signal when present.
    if (rating != null) score += (rating - 3) * 1.5;

    const sentiment = score > 0.8 ? 'POSITIVE' : score < -0.8 ? 'NEGATIVE' : 'NEUTRAL';

    const tags: string[] = [];
    for (const [tag, kws] of Object.entries(TAG_KEYWORDS)) {
        if (kws.some(k => text.includes(k))) tags.push(tag);
    }
    return { sentiment, score: Math.round(score * 100) / 100, tags };
}

export const ReviewsService = {
    async create(hotelId: number, data: { guestName?: string; bookingId?: string; rating?: number; comment?: string; source?: string; externalId?: string }) {
        const { sentiment, score, tags } = analyze(data.comment || '', data.rating);
        const [row] = await db.insert(reviews).values({
            hotelId,
            bookingId: data.bookingId,
            guestName: data.guestName,
            rating: data.rating,
            comment: data.comment,
            source: data.source || 'INTERNAL',
            sentiment,
            sentimentScore: String(score),
            tags,
            externalId: data.externalId,
        }).onConflictDoNothing().returning();
        return row;
    },

    async list(hotelId: number, opts: { sentiment?: string; source?: string; limit?: number } = {}) {
        const conds = [eq(reviews.hotelId, hotelId)];
        if (opts.sentiment) conds.push(eq(reviews.sentiment, opts.sentiment as any));
        if (opts.source) conds.push(eq(reviews.source, opts.source));
        return db.query.reviews.findMany({
            where: and(...conds),
            orderBy: [desc(reviews.createdAt)],
            limit: Math.min(200, opts.limit || 100),
        });
    },

    /** Aggregate sentiment + recurring complaint categories over a window. */
    async insights(hotelId: number, days = 90) {
        const since = new Date(Date.now() - days * 86400000);
        const rows = await db.query.reviews.findMany({
            where: and(eq(reviews.hotelId, hotelId), gte(reviews.createdAt, since)),
            columns: { rating: true, sentiment: true, tags: true },
        });
        const total = rows.length;
        const bySentiment = { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 };
        const tagNeg: Record<string, number> = {};
        let ratingSum = 0, ratingN = 0;
        for (const r of rows) {
            bySentiment[(r.sentiment || 'NEUTRAL') as keyof typeof bySentiment]++;
            if (r.rating != null) { ratingSum += r.rating; ratingN++; }
            if (r.sentiment === 'NEGATIVE') for (const t of (r.tags || [])) tagNeg[t] = (tagNeg[t] || 0) + 1;
        }
        const recurringComplaints = Object.entries(tagNeg)
            .sort((a, b) => b[1] - a[1])
            .map(([tag, count]) => ({ tag, count }));
        return {
            total,
            avgRating: ratingN ? Math.round((ratingSum / ratingN) * 10) / 10 : null,
            sentiment: bySentiment,
            recurringComplaints,
        };
    },

    async saveReply(hotelId: number, id: number, replyText: string, markSent = false) {
        const [row] = await db.update(reviews)
            .set(markSent ? { replyText, repliedAt: new Date() } : { replyDraft: replyText })
            .where(and(eq(reviews.id, id), eq(reviews.hotelId, hotelId)))
            .returning();
        return row;
    },

    analyze, // exported for reuse on bulk import
};
