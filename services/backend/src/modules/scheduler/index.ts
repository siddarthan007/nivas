import { Cron } from 'croner';
import { NightAuditService } from './night-audit.service';
import { WSService as NotificationService } from '../notifications/ws.service';
import { LicenseNotificationService } from '../notifications/license-notification.service';
import { JobService } from '../system/job.service';
import { OutboxService } from '../system/outbox.service';
import { DailyDigestService } from './daily-digest.service';
import { CbmsService } from '../finance/cbms.service';
import { AuditService } from '../system/audit.service';
import { StorageCleanupService } from '../system/storage-cleanup.service';
import { BackupService } from '../system/backup.service';
import { getRedis } from '../../shared/redis';
import { CheckInReminderService } from '../bookings/check-in-reminder.service';
import { OutstandingBalanceService } from '../finance/outstanding-balance.service';
import { NoShowService } from '../bookings/no-show.service';

/**
 * Run a scheduled job AT MOST ONCE across all instances. Behind a load balancer
 * every replica fires the same cron — without this, a backup/digest/prune would
 * run N times. Uses a Redis SET NX EX lock keyed per job. If Redis is unavailable
 * it fails OPEN (runs) so a single-instance / Redis-down setup still works.
 */
async function runExclusive(key: string, ttlSec: number, fn: () => Promise<void>) {
    const r = getRedis();
    if (r && r.status === 'ready') {
        let acquired = false;
        try { acquired = (await r.set(`cron:lock:${key}`, '1', 'EX', ttlSec, 'NX')) === 'OK'; }
        catch { acquired = true; } // Redis hiccup → don't skip the job
        if (!acquired) return; // another instance owns this tick
    }
    await fn();
}

export const initScheduler = () => {

    // Night Audit - Run at 2 AM daily
    new Cron('0 2 * * *', () => runExclusive('night-audit', 3600, async () => {
        try { await NightAuditService.runGlobalAudit(); }
        catch (err) { console.error('Night Audit failed:', err); }
    }));

    // License Expiry Check - Run at 8 AM daily
    new Cron('0 8 * * *', () => runExclusive('license-expiry', 1800, async () => {
        try { await LicenseNotificationService.checkExpiringLicenses(); }
        catch (err) { console.error('License expiry check failed:', err); }
    }));

    // Grace Period Check - Run every 6 hours
    new Cron('0 */6 * * *', () => runExclusive('grace-period', 1800, async () => {
        try { await LicenseNotificationService.checkGracePeriodLicenses(); }
        catch (err) { console.error('Grace period check failed:', err); }
    }));

    // Audit-log retention - prune rows older than 6 months, weekly (Sun 3 AM)
    new Cron('0 3 * * 0', () => runExclusive('audit-prune', 1800, async () => {
        try { await AuditService.pruneOldLogs(180); }
        catch (err) { console.error('Audit prune failed:', err); }
    }));

    // DB storage cleanup — prune processed/terminal rows daily (3:30 AM).
    new Cron('30 3 * * *', () => runExclusive('storage-cleanup', 1800, async () => {
        try { await StorageCleanupService.run(); }
        catch (err) { console.error('Storage cleanup failed:', err); }
    }));

    // MinIO orphan images — weekly (Sun 4 AM). Scans object store vs DB refs.
    new Cron('0 4 * * 0', () => runExclusive('minio-orphan-cleanup', 3600, async () => {
        try { await StorageCleanupService.pruneMinioOrphans(); }
        catch (err) { console.error('MinIO orphan cleanup failed:', err); }
    }));

    // Automatic DB backup — checks daily (2 AM) whether one is due per the schedule.
    new Cron('0 2 * * *', () => runExclusive('auto-backup', 3600, async () => {
        try { await BackupService.runIfDue(); }
        catch (err) { console.error('Auto-backup failed:', err); }
    }));

    // Daily owner digest email - Run at 7 AM (after night audit)
    new Cron('0 7 * * *', () => runExclusive('daily-digest', 1800, async () => {
        try { await DailyDigestService.sendDailyDigests(); }
        catch (err) { console.error('Daily digest failed:', err); }
    }));

    // IRD CBMS sync worker - Run every 2 minutes (distributed-locked inside)
    new Cron('*/2 * * * *', async () => {
        try {
            const n = await CbmsService.processQueue();
        } catch (err) {
            console.error('CBMS worker failed:', err);
        }
    });

    // Background Job Processor - Run every 2 minutes
    new Cron('*/2 * * * *', async () => {
        try {
            const results = await JobService.processPendingJobs();
        } catch (err) {
            console.error('Job processor failed:', err);
        }
    });

    // Outbox Relay - Run every 1 minute
    new Cron('* * * * *', async () => {
        try {
            const processed = await OutboxService.processPendingEvents();
        } catch (err) {
            console.error('Outbox processor failed:', err);
        }
    });

    // Check-in reminders — daily at 6 PM for tomorrow's arrivals
    new Cron('0 18 * * *', () => runExclusive('checkin-reminder', 1800, async () => {
        try { await CheckInReminderService.processAll(); }
        catch (err) { console.error('Check-in reminder failed:', err); }
    }));

    // No-show auto-cancel — every hour
    new Cron('0 * * * *', () => runExclusive('no-show', 1800, async () => {
        try { await NoShowService.processAll(); }
        catch (err) { console.error('No-show processor failed:', err); }
    }));

    // Outstanding balance reminders — daily at 10 AM
    new Cron('0 10 * * *', () => runExclusive('outstanding-balance', 1800, async () => {
        try { await OutstandingBalanceService.processAll(); }
        catch (err) { console.error('Outstanding balance reminders failed:', err); }
    }));
};