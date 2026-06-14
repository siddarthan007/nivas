import { db } from '../../db';
import { backgroundJobs, notifications, outboxEvents, idempotencyKeys, cbmsLogs } from '../../db/schema';
import { and, eq, lt, inArray } from 'drizzle-orm';
import { StorageService } from '../storage/storage.service';

const days = (n: number) => new Date(Date.now() - n * 86400000);

/**
 * Bounds per-hotel DB growth by pruning rows that are processed / terminal and no
 * longer useful. audit_logs have their own weekly prune (180d).
 */
export const StorageCleanupService = {
    async run() {
        const results: Record<string, string> = {};
        const tasks: [string, () => Promise<any>][] = [
            // Completed jobs: keep 14 days for debugging, then drop.
            ['backgroundJobs', () => db.delete(backgroundJobs).where(and(eq(backgroundJobs.status, 'COMPLETED'), lt(backgroundJobs.createdAt, days(14))))],
            ['backgroundJobsFailed', () => db.delete(backgroundJobs).where(and(eq(backgroundJobs.status, 'FAILED'), lt(backgroundJobs.createdAt, days(7))))],
            // Delivered outbox events: relay already done, keep 7 days.
            ['outboxEvents', () => db.delete(outboxEvents).where(and(eq(outboxEvents.status, 'DELIVERED'), lt(outboxEvents.createdAt, days(7))))],
            // Read notifications >30d, and ANY notification >90d.
            ['notificationsRead', () => db.delete(notifications).where(and(eq(notifications.isRead, true), lt(notifications.createdAt, days(30))))],
            ['notificationsOld', () => db.delete(notifications).where(lt(notifications.createdAt, days(90)))],
            // Idempotency keys only need to live briefly (replay window).
            ['idempotencyKeys', () => db.delete(idempotencyKeys).where(lt(idempotencyKeys.createdAt, days(2)))],
            // CBMS terminal rows: drop payload-heavy history after retention window.
            ['cbmsLogsSent', () => db.delete(cbmsLogs).where(and(
                inArray(cbmsLogs.status, ['SENT', 'EXISTS']),
                lt(cbmsLogs.updatedAt, days(180)),
            ))],
            ['cbmsLogsFailed', () => db.delete(cbmsLogs).where(and(
                eq(cbmsLogs.status, 'FAILED'),
                lt(cbmsLogs.updatedAt, days(90)),
            ))],
        ];
        for (const [name, fn] of tasks) {
            try { await fn(); results[name] = 'ok'; }
            catch (e: any) { results[name] = `err: ${e?.message || e}`; }
        }
        return results;
    },

    /** Weekly MinIO scan — removes uploaded images with no DB reference. */
    async pruneMinioOrphans() {
        try {
            return await StorageService.pruneOrphanObjects();
        } catch (e: any) {
            return { error: e?.message || String(e) };
        }
    },
};
