import { createHash, randomBytes } from 'node:crypto';
import { db } from '../../db';
import { apiKeys, rooms, bookings } from '../../db/schema';
import { eq, and, inArray, lt, gt } from 'drizzle-orm';
import { NotFoundError } from '../../utils/errors';
import { parseBookingDate } from '../../utils/date-parse.util';

const hashKey = (raw: string) => createHash('sha256').update(raw).digest('hex');

export const ApiKeyService = {
    /** Generate a new key. Returns the RAW key once — only its hash is stored. */
    async create(hotelId: number, userId: string, name: string, scopes: string[] = ['read']) {
        const raw = `nvk_${randomBytes(24).toString('hex')}`;
        const [row] = await db.insert(apiKeys).values({
            hotelId,
            name,
            keyPrefix: raw.slice(0, 12),
            keyHash: hashKey(raw),
            scopes: scopes.includes('book') ? ['read', 'book'] : ['read'],
            createdById: userId,
        }).returning({ id: apiKeys.id, name: apiKeys.name, keyPrefix: apiKeys.keyPrefix, scopes: apiKeys.scopes, createdAt: apiKeys.createdAt });
        return { ...row, key: raw }; // raw shown once
    },

    list(hotelId: number) {
        return db.query.apiKeys.findMany({
            where: eq(apiKeys.hotelId, hotelId),
            columns: { id: true, name: true, keyPrefix: true, scopes: true, isActive: true, lastUsedAt: true, createdAt: true },
            orderBy: (k, { desc }) => [desc(k.createdAt)],
        });
    },

    async revoke(hotelId: number, id: number) {
        const [r] = await db.update(apiKeys).set({ isActive: false })
            .where(and(eq(apiKeys.id, id), eq(apiKeys.hotelId, hotelId)))
            .returning();
        if (!r) throw new NotFoundError('API key');
        return r;
    },

    /** Resolve a raw key → { hotelId, scopes } or null. Touches lastUsedAt. */
    async verify(raw: string): Promise<{ hotelId: number; scopes: string[] } | null> {
        if (!raw || !raw.startsWith('nvk_')) return null;
        const row = await db.query.apiKeys.findFirst({
            where: and(eq(apiKeys.keyHash, hashKey(raw)), eq(apiKeys.isActive, true)),
            columns: { id: true, hotelId: true, scopes: true },
        });
        if (!row) return null;
        // Best-effort usage stamp.
        db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id)).catch(() => {});
        return { hotelId: row.hotelId, scopes: (row.scopes as string[]) || ['read'] };
    },

    /** Staff-settings smoke test for the booking engine (no raw API key needed). */
    async previewAvailability(hotelId: number, checkIn: string, checkOut: string) {
        const inD = parseBookingDate(checkIn, 'checkIn');
        const outD = parseBookingDate(checkOut, 'checkOut');
        if (outD <= inD) {
            throw new Error('Invalid checkIn/checkOut');
        }
        const allRooms = await db.query.rooms.findMany({
            where: eq(rooms.hotelId, hotelId),
            columns: { id: true, type: true, rate: true, status: true },
        });
        const overlapping = await db.query.bookings.findMany({
            where: and(
                eq(bookings.hotelId, hotelId),
                inArray(bookings.status, ['CONFIRMED', 'CHECKED_IN']),
                lt(bookings.checkIn, outD),
                gt(bookings.checkOut, inD),
            ),
            columns: { roomId: true },
        });
        const taken = new Set(overlapping.map(b => b.roomId));
        const byType: Record<string, { type: string; available: number; fromRate: number }> = {};
        for (const r of allRooms) {
            if (taken.has(r.id)) continue;
            if (r.status === 'MAINTENANCE' || r.status === 'OUT_OF_ORDER') continue;
            const key = r.type || 'STANDARD';
            const rate = parseFloat(r.rate || '0');
            if (!byType[key]) byType[key] = { type: key, available: 0, fromRate: rate };
            byType[key].available += 1;
            if (rate > 0 && rate < byType[key].fromRate) byType[key].fromRate = rate;
        }
        return {
            checkIn,
            checkOut,
            roomTypes: Object.values(byType).filter(t => t.available > 0),
            totalAvailable: Object.values(byType).reduce((s, t) => s + t.available, 0),
        };
    },
};
