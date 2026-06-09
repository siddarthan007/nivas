import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.ts';

const conn = process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/nivas_db';

// Production-tuned connection pool. `max` is PER INSTANCE — keep it modest so N
// load-balanced replicas don't exhaust Postgres' max_connections (default 100).
// idle/lifetime recycling avoids stale connections behind proxies (PgBouncer/NAT).
const client = postgres(conn, {
    prepare: false,
    max: Number(process.env.DB_POOL_MAX || 10),
    idle_timeout: Number(process.env.DB_IDLE_TIMEOUT || 30),   // close idle conns after 30s
    connect_timeout: Number(process.env.DB_CONNECT_TIMEOUT || 15),
    max_lifetime: 60 * 30,                                     // recycle conns every 30 min
});
export const db = drizzle(client, { schema });

/** Close the pool on shutdown so in-flight queries drain cleanly. */
export async function closeDb() {
    await client.end({ timeout: 5 });
}
