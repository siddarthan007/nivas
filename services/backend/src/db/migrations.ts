import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { logger } from '../shared/logger';

export async function runMigrations() {
    // DDL must hit Postgres directly — PgBouncer transaction mode blocks many statements.
    const url = process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL;
    if (!url) {
        logger.error('Migration error: DATABASE_DIRECT_URL or DATABASE_URL is not set');
        return;
    }
    const client = postgres(url, { max: 1 });
    const db = drizzle(client);

    try {
        await db.execute(sql`
            DO $$
            BEGIN
                -- Only CREATE when missing. CREATE EXTENSION IF NOT EXISTS still
                -- emits a NOTICE (already exists, skipping) every boot; this is silent.
                IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist') THEN
                    CREATE EXTENSION btree_gist;
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'booking_no_overlap'
                    AND conrelid = 'bookings'::regclass
                ) THEN
                    ALTER TABLE bookings
                    ADD CONSTRAINT booking_no_overlap
                    EXCLUDE USING gist (
                        room_id WITH =,
                        tsrange(check_in, check_out) WITH &&
                    )
                    WHERE (status <> 'CANCELLED');
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'orders' AND column_name = 'notes'
                ) THEN
                    ALTER TABLE orders ADD COLUMN notes text;
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'staff_attendance' AND column_name = 'approval_status'
                ) THEN
                    ALTER TABLE staff_attendance ADD COLUMN approval_status text NOT NULL DEFAULT 'PENDING';
                    ALTER TABLE staff_attendance ADD COLUMN approved_by_id uuid REFERENCES users(id);
                    ALTER TABLE staff_attendance ADD COLUMN approved_at timestamp;
                END IF;

                -- Link CRM guest_profiles to canonical guests row by phone (idempotent backfill)
                UPDATE guest_profiles gp
                SET guest_id = g.id, updated_at = NOW()
                FROM guests g
                WHERE gp.guest_id IS NULL
                  AND gp.hotel_id = g.hotel_id
                  AND gp.phone = g.phone;
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Could not add booking_no_overlap constraint: %', SQLERRM;
            END $$;
        `);
        logger.info('Database migrations completed');
    } catch (err: any) {
        logger.error({ message: err.message }, 'Migration error: ' + err.message);
    } finally {
        await client.end({ timeout: 5 }).catch(() => {});
    }
}
