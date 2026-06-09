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
    console.log('Scheduler System Initialized');

    // Night Audit - Run at 2 AM daily
    new Cron('0 2 * * *', () => runExclusive('night-audit', 3600, async () => {
        console.log('Triggering Scheduled Night Audit...');
        try { await NightAuditService.runGlobalAudit(); }
        catch (err) { console.error('Night Audit failed:', err); }
    }));

    // License Expiry Check - Run at 8 AM daily
    new Cron('0 8 * * *', () => runExclusive('license-expiry', 1800, async () => {
        console.log('Checking License Expirations...');
        try { await LicenseNotificationService.checkExpiringLicenses(); }
        catch (err) { console.error('License expiry check failed:', err); }
    }));

    // Grace Period Check - Run every 6 hours
    new Cron('0 */6 * * *', () => runExclusive('grace-period', 1800, async () => {
        console.log('Checking Grace Period Licenses...');
        try { await LicenseNotificationService.checkGracePeriodLicenses(); }
        catch (err) { console.error('Grace period check failed:', err); }
    }));

    // Audit-log retention - prune rows older than 6 months, weekly (Sun 3 AM)
    new Cron('0 3 * * 0', () => runExclusive('audit-prune', 1800, async () => {
        try { await AuditService.pruneOldLogs(180); console.log('Audit log retention prune complete'); }
        catch (err) { console.error('Audit prune failed:', err); }
    }));

    // DB storage cleanup — prune processed/terminal rows daily (3:30 AM).
    new Cron('30 3 * * *', () => runExclusive('storage-cleanup', 1800, async () => {
        try { console.log('Storage cleanup complete', await StorageCleanupService.run()); }
        catch (err) { console.error('Storage cleanup failed:', err); }
    }));

    // Automatic DB backup — checks daily (2 AM) whether one is due per the schedule.
    new Cron('0 2 * * *', () => runExclusive('auto-backup', 3600, async () => {
        try { console.log('Auto-backup check', await BackupService.runIfDue()); }
        catch (err) { console.error('Auto-backup failed:', err); }
    }));

    // Daily owner digest email - Run at 7 AM (after night audit)
    new Cron('0 7 * * *', () => runExclusive('daily-digest', 1800, async () => {
        console.log('Sending daily digest emails...');
        try { await DailyDigestService.sendDailyDigests(); }
        catch (err) { console.error('Daily digest failed:', err); }
    }));

    // IRD CBMS sync worker - Run every 2 minutes (distributed-locked inside)
    new Cron('*/2 * * * *', async () => {
        try {
            const n = await CbmsService.processQueue();
            if (n > 0) console.log(`CBMS: synced ${n} documents`);
        } catch (err) {
            console.error('CBMS worker failed:', err);
        }
    });

    // Background Job Processor - Run every 2 minutes
    new Cron('*/2 * * * *', async () => {
        try {
            const results = await JobService.processPendingJobs();
            if (results.length > 0) {
                console.log(`Processed ${results.length} background jobs`);
            }
        } catch (err) {
            console.error('Job processor failed:', err);
        }
    });

    // Outbox Relay - Run every 1 minute
    new Cron('* * * * *', async () => {
        try {
            const processed = await OutboxService.processPendingEvents();
            if (processed > 0) {
                console.log(`Relayed ${processed} outbox events to Redis`);
            }
        } catch (err) {
            console.error('Outbox processor failed:', err);
        }
    });
};