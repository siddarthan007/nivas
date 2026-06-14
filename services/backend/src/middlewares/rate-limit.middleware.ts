import { Elysia } from 'elysia';
import { rateLimit, DefaultContext, type Context, type Options } from 'elysia-rate-limit';
import { getRedis } from '../shared/redis';

/**
 * Redis-backed rate-limit store so limits are shared across ALL app instances
 * (required before running behind a load balancer — otherwise each node has its
 * own counters). Falls back to the library's in-memory store when Redis is down,
 * so a Redis outage degrades to per-instance limiting rather than failing.
 * Each limiter passes a distinct keyPrefix so the global and auth buckets don't
 * collide on the same client key.
 */
class RedisRateLimitContext implements Context {
    private duration = 60_000;
    private fallback = new DefaultContext();
    constructor(private keyPrefix: string) {}

    init(options: Omit<Options, 'context'>) {
        const d = options.duration;
        this.duration = typeof d === 'number' ? d : 60_000;
        this.fallback.init(options);
    }

    async increment(key: string, duration?: number, requestTime?: number) {
        const start = requestTime ?? Date.now();
        const windowMs = duration ?? this.duration;
        const redis = getRedis();
        if (!redis || redis.status !== 'ready') {
            return this.fallback.increment(key, windowMs, start);
        }
        try {
            const rk = `${this.keyPrefix}${key}`;
            const count = await redis.incr(rk);
            if (count === 1) await redis.pexpire(rk, windowMs);
            let ttl = await redis.pttl(rk);
            if (ttl < 0) { await redis.pexpire(rk, windowMs); ttl = windowMs; }
            return { count, nextReset: new Date(Date.now() + ttl), start };
        } catch {
            return this.fallback.increment(key, windowMs, start);
        }
    }

    async decrement(key: string) {
        const redis = getRedis();
        if (!redis || redis.status !== 'ready') return this.fallback.decrement(key);
        try { await redis.decr(`${this.keyPrefix}${key}`); } catch { /* ignore */ }
    }

    async reset(key?: string) {
        const redis = getRedis();
        if (redis && redis.status === 'ready' && key) {
            try { await redis.del(`${this.keyPrefix}${key}`); } catch { /* ignore */ }
        }
        return this.fallback.reset(key);
    }

    async kill() { return this.fallback.kill(); }
}

/**
 * Derive the client key from forwarded headers (set by the frontend proxy /
 * load balancer). The library's default generator calls `server.requestIP()`,
 * which is undefined behind the Bun proxy — that crashed the generator and
 * collapsed everyone into one shared bucket, causing spurious 429s. Keying off
 * X-Forwarded-For gives a stable per-client key and never touches `server`.
 */
const clientKey = (req: Request): string => {
    const cf = req.headers.get('cf-connecting-ip');
    if (cf) return cf.trim();
    const real = req.headers.get('x-real-ip');
    if (real) return real.trim();
    const xff = req.headers.get('x-forwarded-for');
    if (xff) { const parts = xff.split(',').map(s => s.trim()).filter(Boolean); return parts[parts.length - 1] || 'anonymous'; }
    return 'anonymous';
};

const redisContext = (prefix: string): Context => new RedisRateLimitContext(prefix);

export const rateLimitMiddleware = (app: Elysia) =>
    app.use(rateLimit({
        duration: 60000,
        max: 3000,
        generator: clientKey,
        context: redisContext('rlmain:'),
        errorResponse: 'Rate limit exceeded. Please try again later.',
    }));

export const authRateLimitMiddleware = (app: Elysia) =>
    app.use(rateLimit({
        duration: 900000,
        max: 10,
        scoping: 'scoped',
        generator: clientKey,
        context: redisContext('rlauth:'),
        errorResponse: 'Too many login attempts. Please try again after 15 minutes.'
    }));
