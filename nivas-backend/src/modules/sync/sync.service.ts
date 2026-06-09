import { db } from '../../db';
import * as schema from '../../db/schema';
import { eq, and, gt, inArray } from 'drizzle-orm';
import { NotFoundError, HttpError } from '../../utils/errors';

export const SyncService = {
    async pull(hotelId: number, deviceId: string, tables: string[], since: string) {
        const sinceDate = new Date(since);
        if (isNaN(sinceDate.getTime())) {
            throw new HttpError('Invalid since date', 400);
        }

        const data: Record<string, any[]> = {};
        
        // Ensure tables exist in schema
        for (const tableName of tables) {
            // camelCase conversion, e.g., 'menu_items' -> 'menuItems'
            const schemaKey = tableName.replace(/_([a-z])/g, g => g[1]!.toUpperCase()) as keyof typeof schema;
            const table = schema[schemaKey] as any;
            
            if (!table) {
                console.warn(`[SyncService] Table ${tableName} not found in schema`);
                data[tableName] = [];
                continue;
            }

            try {
                // If the table has a tenantId, apply it. Most business tables have tenantId.
                const hasHotelId = !!table.hotelId;
                const hasUpdatedAt = !!table.updatedAt;

                let query = db.select().from(table);
                const conditions = [];

                if (hasHotelId) {
                    conditions.push(eq(table.hotelId, hotelId));
                }
                if (hasUpdatedAt) {
                    conditions.push(gt(table.updatedAt, sinceDate));
                }

                if (conditions.length > 0) {
                    if (conditions.length === 1) {
                        query.where(conditions[0]);
                    } else {
                        query.where(and(...conditions));
                    }
                }

                const records = await query;
                data[tableName] = records;
            } catch (err) {
                console.error(`[SyncService] Failed to pull for table ${tableName}`, err);
                data[tableName] = [];
            }
        }

        // Update checkpoint
        await db.insert(schema.syncCheckpoints).values({
            hotelId,
            deviceId,
            lastSyncTimestamp: new Date(),
        }).onConflictDoUpdate({
            target: [schema.syncCheckpoints.hotelId, schema.syncCheckpoints.deviceId],
            set: {
                lastSyncTimestamp: new Date(),
                updatedAt: new Date()
            }
        }).catch(err => {
            console.warn('[SyncService] Could not update checkpoint, might be missing unique constraint', err);
            // fallback if no unique constraint
        });

        return {
            timestamp: new Date().toISOString(),
            data
        };
    },

    async push(hotelId: number, deviceId: string, mutations: any[]) {
        const results = {
            processed: 0,
            failed: 0,
            errors: [] as any[]
        };

        await db.transaction(async (tx) => {
            for (const mutation of mutations) {
                const { table: tableName, action, record } = mutation;
                const schemaKey = tableName.replace(/_([a-z])/g, (g: string) => g[1]!.toUpperCase()) as keyof typeof schema;
                const table = schema[schemaKey] as any;

                if (!table) {
                    results.failed++;
                    results.errors.push({ table: tableName, error: 'Table not found' });
                    continue;
                }

                try {
                    // Inject tenantId for security
                    if (table.hotelId) {
                        record.hotelId = hotelId;
                    }

                    if (action === 'INSERT') {
                        await tx.insert(table).values(record).onConflictDoNothing();
                    } else if (action === 'UPDATE') {
                        if (!record.id) throw new Error('Missing ID for UPDATE');
                        const conditions = [eq(table.id, record.id)];
                        if (table.hotelId) conditions.push(eq(table.hotelId, hotelId));
                        
                        await tx.update(table).set(record).where(and(...conditions));
                    } else if (action === 'DELETE') {
                        if (!record.id) throw new Error('Missing ID for DELETE');
                        const conditions = [eq(table.id, record.id)];
                        if (table.hotelId) conditions.push(eq(table.hotelId, hotelId));

                        // Soft delete if supported
                        if (table.deletedAt) {
                            await tx.update(table).set({ deletedAt: new Date() }).where(and(...conditions));
                        } else {
                            await tx.delete(table).where(and(...conditions));
                        }
                    }
                    results.processed++;
                } catch (err: any) {
                    results.failed++;
                    results.errors.push({ table: tableName, id: record.id, error: err.message });
                }
            }

            // Update checkpoint
            await tx.insert(schema.syncCheckpoints).values({
                hotelId,
                deviceId,
                lastSyncTimestamp: new Date(),
            }).onConflictDoUpdate({
                target: [schema.syncCheckpoints.hotelId, schema.syncCheckpoints.deviceId],
                set: {
                    lastSyncTimestamp: new Date(),
                    updatedAt: new Date()
                }
            }).catch(() => {});
        });

        return results;
    },
    
    async getStatus(hotelId: number, deviceId: string) {
        const cp = await db.query.syncCheckpoints.findFirst({
            where: and(
                eq(schema.syncCheckpoints.hotelId, hotelId),
                eq(schema.syncCheckpoints.deviceId, deviceId)
            )
        });
        return {
            deviceId,
            lastSync: cp ? cp.lastSyncTimestamp : null
        };
    }
};
