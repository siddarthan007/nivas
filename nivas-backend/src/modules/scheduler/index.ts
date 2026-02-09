import { Cron } from 'croner';
import { NightAuditService } from './night-audit.service';
import { WSService as NotificationService } from '../notifications/ws.service';
import { LicenseNotificationService } from '../notifications/license-notification.service';
import { JobService } from '../system/job.service';
import { CbmsService } from '../finance/cbms.service';
import { db } from '../../db';
import { hotels } from '../../db/schema';
import { eq } from 'drizzle-orm';

export const initScheduler = () => {
    console.log('Scheduler System Initialized');

    // Night Audit - Run at 2 AM daily
    new Cron('0 2 * * *', async () => {
        console.log('Triggering Scheduled Night Audit...');
        try {
            await NightAuditService.runGlobalAudit();
        } catch (err) {
            console.error('Night Audit failed:', err);
        }
    });

    // License Expiry Check - Run at 8 AM daily
    new Cron('0 8 * * *', async () => {
        console.log('Checking License Expirations...');
        try {
            await LicenseNotificationService.checkExpiringLicenses();
        } catch (err) {
            console.error('License expiry check failed:', err);
        }
    });

    // Grace Period Check - Run every 6 hours
    new Cron('0 */6 * * *', async () => {
        console.log('Checking Grace Period Licenses...');
        try {
            await LicenseNotificationService.checkGracePeriodLicenses();
        } catch (err) {
            console.error('Grace period check failed:', err);
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

    // CBMS Retry for Failed Syncs - Run every hour
    new Cron('0 * * * *', async () => {
        try {
            const activeHotels = await db.query.hotels.findMany({
                where: eq(hotels.isActive, true)
            });
            for (const hotel of activeHotels) {
                if ((hotel as any).isCbmsEnabled) {
                    const results = await CbmsService.retryFailedSyncs(hotel.id);
                    if (results.length > 0) {
                        console.log(`CBMS retry: ${results.length} invoices processed for ${hotel.name}`);
                    }
                }
            }
        } catch (err) {
            console.error('CBMS retry failed:', err);
        }
    });
};