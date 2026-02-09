import { db } from '../../db';
import { hotels, subscriptions, subscriptionPackages, subscriptionPayments } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { NotFoundError, BusinessLogicError } from '../../utils/errors';
import { logAction } from '../system/audit.service';
import { LicenseNotificationService } from '../notifications/license-notification.service';

export type LicenseStatus = 'ACTIVE' | 'PAUSED' | 'REVOKED' | 'TRIAL' | 'EXPIRED' | 'PENDING_PAYMENT';
export type BillingCycle = 'MONTHLY' | 'ANNUAL' | '2_YEAR' | '3_YEAR';

const TRIAL_DAYS_DEFAULT = 14;


/**
 * SaaS License Service - Core business logic for license management
 * Eliminates redundancy from controllers
 */
export const LicenseService = {
    /**
     * Get hotel by ID with validation
     */
    async getHotel(hotelId: number) {
        const hotel = await db.query.hotels.findFirst({
            where: eq(hotels.id, hotelId)
        });
        if (!hotel) throw new NotFoundError('Hotel');
        return hotel;
    },

    /**
     * Get hotel's active subscription
     */
    async getSubscription(hotelId: number) {
        return await db.query.subscriptions.findFirst({
            where: eq(subscriptions.hotelId, hotelId),
            orderBy: [desc(subscriptions.createdAt)],
            with: { package: true }
        });
    },

    /**
     * Update license status with validation and logging
     */
    async updateLicenseStatus(
        hotelId: number,
        newStatus: LicenseStatus,
        userId: string,
        action: string,
        additionalData: Record<string, any> = {},
        ip?: string
    ) {
        const hotel = await this.getHotel(hotelId);
        const currentStatus = (hotel.licenseStatus as LicenseStatus) || 'TRIAL';

        // Validate state transitions
        this.validateStatusTransition(currentStatus, newStatus, action);

        // Update hotel
        const [updated] = await db.update(hotels)
            .set({
                licenseStatus: newStatus,
                ...this.getStatusUpdateFields(newStatus, additionalData),
                updatedAt: new Date()
            })
            .where(eq(hotels.id, hotelId))
            .returning();

        // Update subscription if exists
        await this.syncSubscriptionStatus(hotelId, newStatus, additionalData);

        // Log action
        await logAction(hotelId, userId, action, 'HOTEL', hotelId.toString(), additionalData, ip);

        return { hotel: updated, previousStatus: currentStatus };
    },

    /**
     * Validate license status transitions
     */
    validateStatusTransition(current: LicenseStatus, _target: LicenseStatus, action: string) {
        const invalidTransitions: Record<string, string[]> = {
            'PAUSE': ['PAUSED', 'REVOKED'],
            'RESUME': ['ACTIVE', 'TRIAL', 'REVOKED'],
            'REVOKE': ['REVOKED'],
            'ACTIVATE': ['ACTIVE']
        };

        const blockedFor = invalidTransitions[action];
        if (blockedFor?.includes(current)) {
            throw new BusinessLogicError('Cannot ' + (action || '').toLowerCase() + ' a ' + (current || '').toLowerCase() + ' license');
        }
    },

    /**
     * Get update fields based on new status
     */
    getStatusUpdateFields(status: LicenseStatus, data: Record<string, any>) {
        switch (status) {
            case 'PAUSED':
                return { licensePausedAt: new Date() };
            case 'ACTIVE':
                return {
                    licenseExpiresAt: data.expiresAt,
                    licenseGraceEndsAt: null,
                    licensePausedAt: null,
                    isActive: true
                };
            case 'TRIAL':
                return {
                    licenseExpiresAt: data.trialEndsAt,
                    licenseGraceEndsAt: null,
                    licensePausedAt: null,
                    isActive: true
                };
            case 'REVOKED':
                return { isActive: false };
            default:
                return {};
        }
    },

    /**
     * Sync subscription status with hotel license
     */
    async syncSubscriptionStatus(hotelId: number, status: LicenseStatus, data: Record<string, any> = {}) {
        const subscription = await this.getSubscription(hotelId);
        if (!subscription) return;

        const updateData: any = { status, updatedAt: new Date() };

        if (status === 'PAUSED') {
            updateData.pausedAt = new Date();
            updateData.pauseReason = data.reason;
        } else if (status === 'ACTIVE') {
            updateData.pausedAt = null;
            updateData.pauseReason = null;
            updateData.revokedAt = null;
            updateData.revocationReason = null;
            if (data.billingCycle) updateData.billingCycle = data.billingCycle;
            if (data.expiresAt) {
                updateData.currentPeriodStart = new Date();
                updateData.currentPeriodEnd = data.expiresAt;
            }
        } else if (status === 'REVOKED') {
            updateData.revokedAt = new Date();
            updateData.revocationReason = data.reason;
            updateData.revokedById = data.userId;
        } else if (status === 'TRIAL') {
            updateData.trialEndsAt = data.trialEndsAt;
            updateData.pausedAt = null;
            updateData.revokedAt = null;
        }

        await db.update(subscriptions)
            .set(updateData)
            .where(eq(subscriptions.id, subscription.id));
    },

    /**
     * Pause license
     */
    async pauseLicense(hotelId: number, userId: string, reason?: string, ip?: string) {
        const { hotel } = await this.updateLicenseStatus(
            hotelId, 'PAUSED', userId, 'PAUSE_LICENSE', { reason }, ip
        );
        if (hotel) {
            await LicenseNotificationService.sendLicensePaused(hotelId, hotel.name, reason);
        }
        return hotel;
    },

    /**
     * Resume paused license
     */
    async resumeLicense(hotelId: number, userId: string, reason?: string, ip?: string) {
        const hotel = await this.getHotel(hotelId);
        if (hotel.licenseStatus !== 'PAUSED') {
            throw new BusinessLogicError('License is not paused');
        }

        const [updated] = await db.update(hotels)
            .set({
                licenseStatus: 'ACTIVE',
                licensePausedAt: null,
                updatedAt: new Date()
            })
            .where(eq(hotels.id, hotelId))
            .returning();

        await this.syncSubscriptionStatus(hotelId, 'ACTIVE', {});
        await logAction(hotelId, userId, 'RESUME_LICENSE', 'HOTEL', hotelId.toString(), { reason }, ip);
        return updated;
    },

    /**
     * Revoke license
     */
    async revokeLicense(hotelId: number, userId: string, reason: string, ip?: string) {
        const { hotel } = await this.updateLicenseStatus(
            hotelId, 'REVOKED', userId, 'REVOKE_LICENSE', { reason, userId }, ip
        );
        if (hotel) {
            await LicenseNotificationService.sendLicenseRevoked(hotelId, hotel.name, reason);
        }
        return hotel;
    },

    /**
     * Grant trial access
     */
    async grantTrial(hotelId: number, userId: string, days?: number, packageId?: number, ip?: string) {
        const hotel = await this.getHotel(hotelId);
        const trialDays = days ?? TRIAL_DAYS_DEFAULT;
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

        const [updated] = await db.update(hotels)
            .set({
                licenseStatus: 'TRIAL',
                licenseExpiresAt: trialEndsAt,
                licenseGraceEndsAt: null,
                licensePausedAt: null,
                isActive: true,
                updatedAt: new Date()
            })
            .where(eq(hotels.id, hotelId))
            .returning();

        // Create or update subscription
        await this.ensureSubscription(hotelId, packageId, 'TRIAL', trialEndsAt);

        await logAction(hotelId, userId, 'GRANT_TRIAL', 'HOTEL', hotelId.toString(), { trialDays, trialEndsAt }, ip);
        await LicenseNotificationService.sendTrialExtended(hotelId, hotel.name, trialEndsAt, trialDays);

        return { hotel: updated, trialEndsAt };
    },

    /**
     * Activate license
     */
    async activateLicense(hotelId: number, userId: string, billingCycle: BillingCycle = 'MONTHLY', ip?: string) {
        const hotel = await this.getHotel(hotelId);

        if (hotel.licenseStatus === 'ACTIVE') {
            throw new BusinessLogicError('License is already active');
        }

        const expiresAt = new Date();
        const monthsToAdd = billingCycle === 'ANNUAL' ? 12 :
            billingCycle === '2_YEAR' ? 24 :
                billingCycle === '3_YEAR' ? 36 : 1;

        expiresAt.setMonth(expiresAt.getMonth() + monthsToAdd);

        const [updated] = await db.update(hotels)
            .set({
                licenseStatus: 'ACTIVE',
                licenseExpiresAt: expiresAt,
                licenseGraceEndsAt: null,
                licensePausedAt: null,
                isActive: true,
                updatedAt: new Date()
            })
            .where(eq(hotels.id, hotelId))
            .returning();

        await this.syncSubscriptionStatus(hotelId, 'ACTIVE', { expiresAt, billingCycle });
        await logAction(hotelId, userId, 'ACTIVATE_LICENSE', 'HOTEL', hotelId.toString(), { expiresAt, billingCycle }, ip);
        await LicenseNotificationService.sendLicenseActivated(hotelId, hotel.name, expiresAt);

        return { hotel: updated, expiresAt };
    },

    /**
     * Extend license
     */
    async extendLicense(hotelId: number, userId: string, days: number, ip?: string) {
        const hotel = await this.getHotel(hotelId);

        const currentExpiry = hotel.licenseExpiresAt || new Date();
        const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
        const newExpiry = new Date(baseDate);
        newExpiry.setDate(newExpiry.getDate() + days);

        const newStatus = hotel.licenseStatus === 'EXPIRED' ? 'ACTIVE' : hotel.licenseStatus;

        const [updated] = await db.update(hotels)
            .set({
                licenseExpiresAt: newExpiry,
                licenseGraceEndsAt: null,
                licenseStatus: newStatus,
                updatedAt: new Date()
            })
            .where(eq(hotels.id, hotelId))
            .returning();

        await logAction(hotelId, userId, 'EXTEND_LICENSE', 'HOTEL', hotelId.toString(), { days, newExpiry }, ip);
        return { hotel: updated, newExpiry };
    },

    /**
     * Ensure subscription exists
     */
    async ensureSubscription(hotelId: number, packageId: number | undefined, status: string, endsAt: Date) {
        const existing = await this.getSubscription(hotelId);

        // Get default package if not specified
        let pkgId = packageId;
        if (!pkgId) {
            const defaultPkg = await db.query.subscriptionPackages.findFirst({
                where: eq(subscriptionPackages.isActive, true),
                orderBy: (pkg, { asc }) => [asc(pkg.monthlyPrice)]
            });
            pkgId = defaultPkg?.id;
        }

        if (!pkgId) return; // No package available

        if (existing) {
            await db.update(subscriptions)
                .set({ status: status as any, trialEndsAt: status === 'TRIAL' ? endsAt : undefined, updatedAt: new Date() })
                .where(eq(subscriptions.id, existing.id));
        } else {
            await db.insert(subscriptions).values({
                hotelId,
                packageId: pkgId,
                status: status as any,
                trialEndsAt: status === 'TRIAL' ? endsAt : undefined,
                startDate: new Date()
            });
        }
    },

    /**
     * Record payment and activate license
     */
    async recordPayment(
        hotelId: number,
        userId: string,
        amount: number,
        currency: string = 'USD',
        billingCycle: BillingCycle = 'MONTHLY',
        paymentMethod?: string,
        transactionId?: string,
        packageId?: number,
        ip?: string
    ) {
        const hotel = await this.getHotel(hotelId);
        let subscription = await this.getSubscription(hotelId);

        // Create subscription if doesn't exist
        if (!subscription) {
            if (!packageId) {
                throw new BusinessLogicError('Package ID required for first payment');
            }
            await this.ensureSubscription(hotelId, packageId, 'ACTIVE', new Date());
            subscription = await this.getSubscription(hotelId);
        }

        // Calculate period
        const periodStart = new Date();
        const periodEnd = new Date();

        const monthsToAdd = billingCycle === 'ANNUAL' ? 12 :
            billingCycle === '2_YEAR' ? 24 :
                billingCycle === '3_YEAR' ? 36 : 1;

        periodEnd.setMonth(periodEnd.getMonth() + monthsToAdd);

        // Record payment
        const [payment] = await db.insert(subscriptionPayments).values({
            subscriptionId: subscription!.id,
            hotelId,
            amount: amount.toString(),
            currency,
            paymentMethod,
            transactionId,
            periodStart,
            periodEnd,
            status: 'COMPLETED'
        }).returning();

        // Update hotel license
        await db.update(hotels)
            .set({
                licenseStatus: 'ACTIVE',
                licenseExpiresAt: periodEnd,
                licenseGraceEndsAt: null,
                isActive: true,
                updatedAt: new Date()
            })
            .where(eq(hotels.id, hotelId));

        // Update subscription
        await db.update(subscriptions)
            .set({
                status: 'ACTIVE',
                billingCycle,
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd,
                updatedAt: new Date()
            })
            .where(eq(subscriptions.id, subscription!.id));

        await logAction(hotelId, userId, 'RECORD_SUBSCRIPTION_PAYMENT', 'SUBSCRIPTION_PAYMENT', payment?.id ?? '', { amount, periodStart, periodEnd }, ip);
        await LicenseNotificationService.sendPaymentReceived(hotelId, hotel.name, amount, currency, periodEnd);

        return { payment, periodStart, periodEnd };
    }
};
