import { createHash, randomBytes } from 'node:crypto';
import { db } from '../../db';
import { apiKeys } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { NotFoundError } from '../../utils/errors';

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
};
