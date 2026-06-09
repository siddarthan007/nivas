import { db } from '../../db';
import { backgroundJobs, notifications, channelSyncLogs, outboxEvents, idempotencyKeys } from '../../db/schema';
import { and, eq, lt } from 'drizzle-orm';

const days = (n: number) => new Date(Date.now() - n * 86400000);

/**
 * Bounds per-hotel DB growth by pruning rows that are processed / terminal and no
 * longer useful. Compliance tables (cbms_logs) and audit_logs (own 1-year prune)
 * are intentionally untouched.
 */
export const StorageCleanupService = {
    async run() {
        const results: Record<string, string> = {};
        const tasks: [string, () => Promise<any>][] = [
            // Completed jobs: keep 14 days for debugging, then drop.
            ['backgroundJobs', () => db.delete(backgroundJobs).where(and(eq(backgroundJobs.status, 'COMPLETED'), lt(backgroundJobs.createdAt, days(14))))],
            // Delivered outbox events: relay already done, keep 7 days.
            ['outboxEvents', () => db.delete(outboxEvents).where(and(eq(outboxEvents.status, 'DELIVERED'), lt(outboxEvents.createdAt, days(7))))],
            // Read notifications >30d, and ANY notification >90d.
            ['notificationsRead', () => db.delete(notifications).where(and(eq(notifications.isRead, true), lt(notifications.createdAt, days(30))))],
            ['notificationsOld', () => db.delete(notifications).where(lt(notifications.createdAt, days(90)))],
            // Channel sync logs: operational, keep 30 days.
            ['channelSyncLogs', () => db.delete(channelSyncLogs).where(lt(channelSyncLogs.createdAt, days(30)))],
            // Idempotency keys only need to live briefly (replay window).
            ['idempotencyKeys', () => db.delete(idempotencyKeys).where(lt(idempotencyKeys.createdAt, days(2)))],
        ];
        for (const [name, fn] of tasks) {
            try { await fn(); results[name] = 'ok'; }
            catch (e: any) { results[name] = `err: ${e?.message || e}`; }
        }
        return results;
    },
};
