import { Elysia } from 'elysia';
import { createHash } from 'node:crypto';
import { db } from '../db';
import { idempotencyKeys } from '../db/schema';
import { eq } from 'drizzle-orm';
import { HttpError } from '../utils/errors';

const MUTATING = (m: string) => !['GET', 'HEAD', 'OPTIONS'].includes(m.toUpperCase());

// Scope the client-supplied key by the caller's auth token + path so two tenants
// (or two users) reusing a common key like "retry-1" never collide.
function effectiveKey(request: Request): string | null {
    const clientKey = request.headers.get('idempotency-key');
    if (!clientKey) return null;
    const auth = request.headers.get('authorization') || request.headers.get('cookie') || 'anon';
    const fp = createHash('sha256').update(auth).digest('hex').slice(0, 16);
    const path = new URL(request.url).pathname;
    return `${fp}:${request.method.toUpperCase()}:${path}:${clientKey}`;
}

export const idempotencyMiddleware = new Elysia()
    .onRequest(async ({ request, set }) => {
        if (!MUTATING(request.method)) return;
        const key = effectiveKey(request);
        if (!key) return;

        // Atomic claim: insert wins the race; a conflict means someone already has it.
        const inserted = await db.insert(idempotencyKeys)
            .values({ key, path: new URL(request.url).pathname, method: request.method.toUpperCase() })
            .onConflictDoNothing()
            .returning({ key: idempotencyKeys.key });

        if (inserted.length === 0) {
            const existing = await db.query.idempotencyKeys.findFirst({ where: eq(idempotencyKeys.key, key) });
            if (existing?.responseStatus) {
                set.status = existing.responseStatus;
                return existing.responseBody;
            }
            // Claimed but not yet completed → a concurrent in-flight request.
            throw new HttpError('A request with this idempotency key is already in progress', 409);
        }
    })
    .onAfterHandle(async ({ request, set, response }) => {
        if (!MUTATING(request.method)) return;
        const key = effectiveKey(request);
        if (!key) return;

        const status = typeof set.status === 'number' ? set.status : 200;
        // Only cache successful responses. A failure frees the key so the client
        // can retry after fixing the input.
        if (status >= 200 && status < 300) {
            await db.update(idempotencyKeys).set({ responseStatus: status, responseBody: response ?? null }).where(eq(idempotencyKeys.key, key));
        } else {
            await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, key));
        }
    })
    .onError(async ({ request, set }) => {
        if (!MUTATING(request.method)) return;
        const key = effectiveKey(request);
        if (!key) return;
        const status = typeof set.status === 'number' ? set.status : 500;
        // Free the key on error so the same key can be retried.
        if (status >= 400) {
            await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, key));
        }
    });
