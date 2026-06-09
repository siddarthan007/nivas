import { db } from './index';
import { sql } from 'drizzle-orm';
import { logger } from '../shared/logger';

export async function runMigrations() {
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
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Could not add booking_no_overlap constraint: %', SQLERRM;
            END $$;
        `);
        logger.info('Database migrations completed');
    } catch (err: any) {
        logger.error({ message: err.message }, 'Migration error: ' + err.message);
    }
}
