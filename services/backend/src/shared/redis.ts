import Redis from 'ioredis';
import { logger } from './logger';

/**
 * Shared Redis client + cache helper.
 *
 * Design goal: Redis is an OPTIONAL accelerator, never a hard dependency. Every
 * helper degrades gracefully — if Redis is down/unconfigured, reads miss (return
 * null) and the caller falls back to the database. The app stays fully functional
 * without Redis, which suits a mid-resource launch where Redis may not be present.
 */

let client: Redis | null = null;
let initialised = false;

export function getRedis(): Redis | null {
    if (initialised) return client;
    initialised = true;
    try {
        const opts = {
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            // Stop retrying after a few attempts so a missing Redis doesn't spam.
            retryStrategy: (times: number) => (times > 5 ? null : Math.min(times * 1000, 5000)),
            enableOfflineQueue: false,
        };
        client = process.env.REDIS_URL
            ? new Redis(process.env.REDIS_URL, opts)
            : new Redis({
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD,
                ...opts,
            });
        client.on('error', (err) => {
            // Log once-ish; ioredis emits on each retry.
            logger.warn?.({ err: err.message }, '[redis] connection error (cache disabled, falling back to DB)');
        });
        client.connect().catch((err) => { 
            logger.warn?.({ err: err?.message || 'Unknown error' }, '[redis] connection failed (cache disabled, falling back to DB)'); 
        });
    } catch {
        client = null;
    }
    return client;
}

async function safe<T>(fn: (r: Redis) => Promise<T>, fallback: T): Promise<T> {
    const r = getRedis();
    if (!r || r.status === 'end' || r.status === 'close') return fallback;
    try { return await fn(r); } catch { return fallback; }
}

export const cache = {
    async getJSON<T>(key: string): Promise<T | null> {
        return safe(async (r) => {
            const v = await r.get(key);
            return v ? (JSON.parse(v) as T) : null;
        }, null);
    },

    async setJSON(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
        await safe(async (r) => { await r.set(key, JSON.stringify(value), 'EX', ttlSeconds); }, undefined);
    },

    async del(...keys: string[]): Promise<void> {
        if (keys.length === 0) return;
        await safe(async (r) => { await r.del(...keys); }, undefined);
    },

    /** Delete every key matching a prefix (uses SCAN, safe on large keyspaces). */
    async delByPrefix(prefix: string): Promise<void> {
        await safe(async (r) => {
            let cursor = '0';
            do {
                const [next, batch] = await r.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 200);
                cursor = next;
                if (batch.length) await r.del(...batch);
            } while (cursor !== '0');
        }, undefined);
    },

    /** Read-through cache: return cached value or compute, store, and return it. */
    async getOrSet<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
        const hit = await this.getJSON<T>(key);
        if (hit !== null) return hit;
        const fresh = await compute();
        if (fresh !== null && fresh !== undefined) await this.setJSON(key, fresh, ttlSeconds);
        return fresh;
    },
};
