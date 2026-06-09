import { db } from '../../db';
import { bookings, orders, invoices, payments, guests, menuItems, reviews, auditLogs } from '../../db/schema';
import { eq, count } from 'drizzle-orm';
import { cache } from '../../shared/redis';
import { StorageService } from '../storage/storage.service';

const prettyBytes = (b: number) => b >= 1073741824 ? `${(b / 1073741824).toFixed(2)} GB` : b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;

/**
 * Per-hotel usage stats — record counts (DB) + object-storage size (bucket).
 * OPTIMIZED: counts are cheap COUNT(*) on the indexed `hotel_id`; the bucket size
 * lists only the hotel's own prefix. Cached 10 min (changes slowly) so opening the
 * page doesn't recompute every time.
 */
export const HotelStorageService = {
    async getUsage(hotelId: number) {
        return cache.getOrSet(`hotel:usage:${hotelId}`, 600, async () => {
            const tables: [string, any][] = [
                ['bookings', bookings], ['orders', orders], ['invoices', invoices],
                ['payments', payments], ['guests', guests], ['menuItems', menuItems],
                ['reviews', reviews], ['auditLogs', auditLogs],
            ];
            const [counts, bucket] = await Promise.all([
                Promise.all(tables.map(async ([name, tbl]) => {
                    const [r] = await db.select({ c: count() }).from(tbl).where(eq(tbl.hotelId, hotelId));
                    return { table: name, rows: Number(r?.c || 0) };
                })),
                StorageService.getUsageByHotel(hotelId),
            ]);
            const totalRows = counts.reduce((s, c) => s + c.rows, 0);
            return {
                database: { totalRows, byTable: counts.sort((a, b) => b.rows - a.rows) },
                storage: { objects: bucket.objects, bytes: bucket.bytes, pretty: prettyBytes(bucket.bytes) },
            };
        });
    },
};
