import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.ts';

const conn = process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/nivas_db';

const client = postgres(conn, { prepare: false });
export const db = drizzle(client, { schema });
