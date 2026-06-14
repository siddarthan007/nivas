import { db } from '../../db';
import { hotels, users, subscriptions, subscriptionPayments } from '../../db/schema';
import { eq, and, lt, gt, isNotNull, desc } from 'drizzle-orm';
import { NotificationChannelService } from './notification-channel.service';
import { WSService as NotificationService } from './ws.service';
import { NotificationStore } from './notification.store';

export type LicenseNotificationType =
    | 'LICENSE_EXPIRING_SOON'
    | 'LICENSE_EXPIRED'
    | 'LICENSE_GRACE_PERIOD'
    | 'LICENSE_PAUSED'
    | 'LICENSE_REVOKED'
    | 'LICENSE_ACTIVATED'
    | 'PAYMENT_RECEIVED'
    | 'PAYMENT_DUE_REMINDER'
    | 'TRIAL_ENDING_SOON'
    | 'TRIAL_EXTENDED';

export const LicenseNotificationService = {
    /**
     * Check all hotels for expiring licenses and send notifications
     * Called by scheduler daily
     */
    async checkExpiringLicenses() {

        const now = new Date();
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        // Find hotels with licenses expiring within 7 days (both ACTIVE and TRIAL)
        const expiringHotels = await db.query.hotels.findMany({
            where: and(
                isNotNull(hotels.licenseExpiresAt),
                lt(hotels.licenseExpiresAt, sevenDaysFromNow),
                gt(hotels.licenseExpiresAt, now),
                eq(hotels.isActive, true)
            )
        });

        let notificationsSent = 0;

        for (const hotel of expiringHotels) {
            if (!hotel.licenseExpiresAt) continue;

            const daysRemaining = Math.ceil(
                (hotel.licenseExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );

            // Only send at specific day thresholds to avoid spam
            if (daysRemaining === 7 || daysRemaining === 3 || daysRemaining === 1) {
                const isTrial = hotel.licenseStatus === 'TRIAL';

                if (isTrial) {
                    await this.sendTrialEndingSoon(hotel.id, hotel.name, hotel.licenseExpiresAt, daysRemaining).catch(err => console.error(`[LicenseNotification] Failed to send trial ending: ${err.message}`));
                } else {
                    await this.sendExpiryWarning(hotel.id, hotel.name, hotel.licenseExpiresAt, daysRemaining).catch(err => console.error(`[LicenseNotification] Failed to send expiry warning: ${err.message}`));
                }
                notificationsSent++;
            }
        }

        // Also check grace period licenses
        await this.checkGracePeriodLicenses();

        return { processed: expiringHotels.length, notificationsSent };
    },

    /**
     * Check for licenses in grace period
     */
    async checkGracePeriodLicenses() {
        const now = new Date();

        const graceHotels = await db.query.hotels.findMany({
            where: and(
                eq(hotels.licenseStatus, 'EXPIRED'),
                isNotNull(hotels.licenseGraceEndsAt),
                gt(hotels.licenseGraceEndsAt, now)
            )
        });

        for (const hotel of graceHotels) {
            if (!hotel.licenseGraceEndsAt) continue;

            const hoursRemaining = Math.ceil(
                (hotel.licenseGraceEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60)
            );

            // Send grace period warning at specific thresholds (12 hours and 2 hours)
            if (hoursRemaining === 12 || hoursRemaining === 2) {
                await this.sendGracePeriodWarning(hotel.id, hotel.name, hotel.licenseGraceEndsAt, hoursRemaining).catch(err => console.error(`[LicenseNotification] Failed to send grace warning: ${err.message}`));
            }
        }
    },

    /**
     * Send expiry warning notification
     */
    async sendExpiryWarning(hotelId: number, hotelName: string, expiresAt: Date, daysRemaining: number) {
        // Get hotel owner/admin
        const owner = await this.getHotelOwner(hotelId);
        if (!owner) return;

        const message = `⚠️ License Expiring Soon
Your Nivas PMS license for "${hotelName}" expires in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}.
Expiry Date: ${expiresAt.toISOString().split('T')[0]}
Please renew to avoid service interruption.`;

        // Send via configured channels
        await NotificationChannelService.send(
            hotelId,
            owner.phone,
            owner.email ?? undefined,
            message
        );

        // Create in-app notification
        await NotificationStore.create({
            hotelId,
            recipientId: owner.id,
            type: 'LICENSE_EXPIRING_SOON',
            title: `License Expires in ${daysRemaining} Days`,
            message: `Your license expires on ${expiresAt.toISOString().split('T')[0]}. Renew now to avoid interruption.`,
            metadata: { expiresAt, daysRemaining }
        });

    },

    /**
     * Send grace period warning
     */
    async sendGracePeriodWarning(hotelId: number, hotelName: string, graceEndsAt: Date, hoursRemaining: number) {
        const owner = await this.getHotelOwner(hotelId);
        if (!owner) return;

        const message = `🚨 URGENT: License Grace Period Ending
Your license for "${hotelName}" has EXPIRED.
Grace period ends in ${hoursRemaining} hour${hoursRemaining > 1 ? 's' : ''}.
Make a payment immediately to restore full access.`;

        await NotificationChannelService.send(
            hotelId,
            owner.phone,
            owner.email ?? undefined,
            message
        );

        await NotificationStore.create({
            hotelId,
            recipientId: owner.id,
            type: 'LICENSE_GRACE_PERIOD',
            title: `Grace Period Ends in ${hoursRemaining}h`,
            message: `Make payment now to avoid service lockout.`,
            metadata: { graceEndsAt, hoursRemaining }
        });
    },

    /**
     * Send license activated notification (after payment)
     */
    async sendLicenseActivated(hotelId: number, hotelName: string, expiresAt: Date) {
        const owner = await this.getHotelOwner(hotelId);
        if (!owner) return;

        const message = `✅ License Activated
Your Nivas PMS license for "${hotelName}" is now active!
Valid until: ${expiresAt.toISOString().split('T')[0]}
Thank you for your payment.`;

        await NotificationChannelService.send(
            hotelId,
            owner.phone,
            owner.email ?? undefined,
            message
        );

        await NotificationStore.create({
            hotelId,
            recipientId: owner.id,
            type: 'LICENSE_ACTIVATED',
            title: 'License Activated',
            message: `Your license is active until ${expiresAt.toISOString().split('T')[0]}.`,
            metadata: { expiresAt }
        });
    },

    /**
     * Send license paused notification
     */
    async sendLicensePaused(hotelId: number, hotelName: string, reason?: string) {
        const owner = await this.getHotelOwner(hotelId);
        if (!owner) return;

        const message = `⏸️ License Paused
Your Nivas PMS license for "${hotelName}" has been paused.
${reason ? `Reason: ${reason}` : ''}
Contact support or make a payment to resume.`;

        await NotificationChannelService.send(
            hotelId,
            owner.phone,
            owner.email ?? undefined,
            message
        );

        await NotificationStore.create({
            hotelId,
            recipientId: owner.id,
            type: 'LICENSE_PAUSED',
            title: 'License Paused',
            message: reason || 'Your license has been paused. Contact support.',
            metadata: { reason }
        });
    },

    /**
     * Send license revoked notification
     */
    async sendLicenseRevoked(hotelId: number, hotelName: string, reason: string) {
        const owner = await this.getHotelOwner(hotelId);
        if (!owner) return;

        const message = `❌ License Revoked
Your Nivas PMS license for "${hotelName}" has been revoked.
Reason: ${reason}
Contact support for assistance.`;

        await NotificationChannelService.send(
            hotelId,
            owner.phone,
            owner.email ?? undefined,
            message
        );

        await NotificationStore.create({
            hotelId,
            recipientId: owner.id,
            type: 'LICENSE_REVOKED',
            title: 'License Revoked',
            message: reason,
            metadata: { reason }
        });
    },

    /**
     * Send payment received confirmation
     */
    async sendPaymentReceived(
        hotelId: number,
        hotelName: string,
        amount: number,
        currency: string,
        newExpiryDate: Date
    ) {
        const owner = await this.getHotelOwner(hotelId);
        if (!owner) return;

        const message = `💰 Payment Received
Payment of ${currency} ${amount} received for "${hotelName}".
Your license is now active until ${newExpiryDate.toISOString().split('T')[0]}.
Thank you!`;

        await NotificationChannelService.send(
            hotelId,
            owner.phone,
            owner.email ?? undefined,
            message
        ).catch(err => console.error(`[LicenseNotification] Failed to send payment received (Channel): ${err.message}`));

        await NotificationStore.create({
            hotelId,
            recipientId: owner.id,
            type: 'PAYMENT_RECEIVED',
            title: `Payment of ${currency} ${amount} Received`,
            message: `License active until ${newExpiryDate.toISOString().split('T')[0]}`,
            metadata: { amount, currency, newExpiryDate }
        });
    },

    /**
     * Send trial ending notification
     */
    async sendTrialEndingSoon(hotelId: number, hotelName: string, trialEndsAt: Date, daysRemaining: number) {
        const owner = await this.getHotelOwner(hotelId);
        if (!owner) return;

        const message = `🔔 Trial Ending Soon
Your free trial for "${hotelName}" ends in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}!
Subscribe now to continue using Nivas PMS.`;

        await NotificationChannelService.send(
            hotelId,
            owner.phone,
            owner.email ?? undefined,
            message
        );

        await NotificationStore.create({
            hotelId,
            recipientId: owner.id,
            type: 'TRIAL_ENDING_SOON',
            title: `Trial Ends in ${daysRemaining} Days`,
            message: `Subscribe now to continue using the system.`,
            metadata: { trialEndsAt, daysRemaining }
        });
    },

    /**
     * Send trial extended notification
     */
    async sendTrialExtended(hotelId: number, hotelName: string, newTrialEndsAt: Date, days: number) {
        const owner = await this.getHotelOwner(hotelId);
        if (!owner) return;

        const message = `🎉 Trial Extended!
Your trial for "${hotelName}" has been extended by ${days} days.
New trial end date: ${newTrialEndsAt.toISOString().split('T')[0]}
Enjoy exploring Nivas PMS!`;

        await NotificationChannelService.send(
            hotelId,
            owner.phone,
            owner.email ?? undefined,
            message
        );

        await NotificationStore.create({
            hotelId,
            recipientId: owner.id,
            type: 'TRIAL_EXTENDED',
            title: `Trial Extended by ${days} Days`,
            message: `New end date: ${newTrialEndsAt.toISOString().split('T')[0]}`,
            metadata: { newTrialEndsAt, days }
        });
    },

    /**
     * Helper: Get hotel owner (user with Owner role or first active user)
     */
    async getHotelOwner(hotelId: number) {
        const owner = await db.query.users.findFirst({
            where: and(
                eq(users.hotelId, hotelId),
                eq(users.isActive, true)
            ),
            with: {
                role: true
            },
            orderBy: [desc(users.createdAt)]
        });

        // Prefer Owner role if available
        if (owner?.role?.name === 'Owner') return owner;

        // Otherwise return any active user (typically first created is owner)
        return owner;
    }
};
