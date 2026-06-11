import { db } from '../../db';
import { hotels, tenantFeatures, notificationSettings } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { logAction } from '../system/audit.service';
import { NotFoundError, ForbiddenError } from '../../utils/errors';
import { cache } from '../../shared/redis';

const settingsKey = (hotelId: number) => `settings:${hotelId}`;

export const SettingsService = {
    // Drop the cached settings after any write so changes propagate immediately.
    async invalidate(hotelId: number) {
        await cache.del(settingsKey(hotelId));
    },

    async getSettings(hotelId: number) {
        const cached = await cache.getJSON<any>(settingsKey(hotelId));
        if (cached) return cached;

        const [hotel, features] = await Promise.all([
            db.query.hotels.findFirst({ where: eq(hotels.id, hotelId) }),
            db.query.tenantFeatures.findFirst({ where: eq(tenantFeatures.hotelId, hotelId) }),
        ]);

        if (!hotel) throw new NotFoundError('Hotel');

        const result = {
            slug: hotel.slug, // for the guest-portal URL / QR
            branding: {
                name: hotel.name,
                logoUrl: hotel.logoUrl,
                primaryColor: hotel.primaryColor,
                secondaryColor: hotel.secondaryColor,
            },
            contact: {
                address: hotel.address,
                phone: hotel.phone,
                email: hotel.email,
                website: hotel.website,
                latitude: hotel.latitude,
                longitude: hotel.longitude,
            },
            tax: {
                panNumber: hotel.panNumber,
                vatNumber: hotel.vatNumber,
                serviceChargeRate: parseFloat(hotel.serviceChargeRate || '0.10') * 100,
                taxRate: parseFloat(hotel.taxRate || '0.13') * 100,
            },
            regional: {
                currency: hotel.currency,
                timezone: hotel.timezone,
                dateFormat: hotel.dateFormat,
                fiscalYearStart: hotel.fiscalYearStart,
                checkInTime: hotel.checkInTime || '14:00',
                checkOutTime: hotel.checkOutTime || '11:00',
            },
            invoice: {
                prefix: hotel.invoicePrefix,
                footerText: hotel.invoiceFooterText,
                terms: hotel.invoiceTerms,
                config: (hotel.invoiceConfig || {}) as Record<string, any>,
            },
            features: {
                enableGuestPortal: features?.enableGuestPortal ?? false,
                enableHousekeeping: features?.enableHousekeeping ?? true,
                enableInventory: features?.enableInventory ?? true,
                emailNotifications: features?.enableEmailNotifications ?? true,
                smsNotifications: features?.enableSmsNotifications ?? false,
                enableHotel: features?.enableHotel ?? true,
                enableFoodAndBeverage: features?.enableFoodAndBeverage ?? true,
                enableFonepay: features?.enableFonepay ?? false,
            },
        };

        // Short TTL self-heals within a minute; behavior-critical writers
        // (features/payment/notification) also invalidate explicitly for instant effect.
        await cache.setJSON(settingsKey(hotelId), result, 60);
        return result;
    },

    async updateBranding(hotelId: number, userId: string, data: any, ip?: string) {
        const updatePayload: Record<string, any> = { updatedAt: new Date() };
        if (data.name !== undefined) updatePayload.name = data.name;
        if (data.logoUrl !== undefined) updatePayload.logoUrl = data.logoUrl;
        if (data.primaryColor !== undefined) updatePayload.primaryColor = data.primaryColor;
        if (data.secondaryColor !== undefined) updatePayload.secondaryColor = data.secondaryColor;

        await db.update(hotels)
            .set(updatePayload)
            .where(eq(hotels.id, hotelId));

        await logAction(hotelId, userId, 'UPDATE_BRANDING', 'HOTEL', hotelId.toString(), data, ip);
    },

    async updateContact(hotelId: number, userId: string, data: any, ip?: string) {
        await db.update(hotels)
            .set({
                address: data.address,
                phone: data.phone,
                email: data.email,
                website: data.website,
                ...(data.latitude !== undefined && { latitude: data.latitude }),
                ...(data.longitude !== undefined && { longitude: data.longitude }),
                updatedAt: new Date(),
            })
            .where(eq(hotels.id, hotelId));

        await logAction(hotelId, userId, 'UPDATE_CONTACT', 'HOTEL', hotelId.toString(), data, ip);
    },

    async updateTax(hotelId: number, userId: string, _userRole: string, userType: string, data: any, ip?: string, userPermissions?: string[]) {
        const canManageBilling = userType === 'SUPER_ADMIN'
            || userPermissions?.includes('*')
            || userPermissions?.includes('settings:manage_billing');

        if (!canManageBilling) {
            throw new ForbiddenError('Missing settings:manage_billing permission to modify tax settings');
        }

        await db.update(hotels)
            .set({
                panNumber: data.panNumber,
                vatNumber: data.vatNumber,
                serviceChargeRate: data.serviceChargeRate !== undefined ? (data.serviceChargeRate / 100).toFixed(4) : undefined,
                taxRate: data.taxRate !== undefined ? (data.taxRate / 100).toFixed(4) : undefined,
                updatedAt: new Date(),
            })
            .where(eq(hotels.id, hotelId));

        await logAction(hotelId, userId, 'UPDATE_TAX_SETTINGS', 'HOTEL', hotelId.toString(), data, ip);
    },

    async updateInvoice(hotelId: number, userId: string, data: any, ip?: string) {
        const updatePayload: Record<string, any> = { updatedAt: new Date() };
        if (data.prefix !== undefined) updatePayload.invoicePrefix = data.prefix;
        if (data.footerText !== undefined) updatePayload.invoiceFooterText = data.footerText;
        if (data.terms !== undefined) updatePayload.invoiceTerms = data.terms;
        if (data.config !== undefined) {
            const hotel = await db.query.hotels.findFirst({ where: eq(hotels.id, hotelId), columns: { invoiceConfig: true } });
            const existing = (hotel?.invoiceConfig || {}) as Record<string, any>;
            updatePayload.invoiceConfig = { ...existing, ...data.config };
        }
        await db.update(hotels).set(updatePayload).where(eq(hotels.id, hotelId));

        await logAction(hotelId, userId, 'UPDATE_INVOICE_SETTINGS', 'HOTEL', hotelId.toString(), data, ip);
    },

    async updateRegional(hotelId: number, userId: string, data: any, ip?: string) {
        const updatePayload: Record<string, any> = { updatedAt: new Date() };
        if (data.currency !== undefined) updatePayload.currency = data.currency;
        if (data.timezone !== undefined) updatePayload.timezone = data.timezone;
        if (data.dateFormat !== undefined) updatePayload.dateFormat = data.dateFormat;
        if (data.fiscalYearStart !== undefined) updatePayload.fiscalYearStart = data.fiscalYearStart;
        if (data.checkInTime !== undefined) updatePayload.checkInTime = data.checkInTime;
        if (data.checkOutTime !== undefined) updatePayload.checkOutTime = data.checkOutTime;

        await db.update(hotels)
            .set(updatePayload)
            .where(eq(hotels.id, hotelId));

        await logAction(hotelId, userId, 'UPDATE_REGIONAL_SETTINGS', 'HOTEL', hotelId.toString(), data, ip);
    },

    async updateFeatures(hotelId: number, userId: string, data: any, ip?: string) {
        const existing = await db.query.tenantFeatures.findFirst({
            where: eq(tenantFeatures.hotelId, hotelId),
        });

        const updatePayload: Record<string, any> = { updatedAt: new Date() };
        if (data.enableGuestPortal !== undefined) updatePayload.enableGuestPortal = data.enableGuestPortal;
        if (data.enableHousekeeping !== undefined) updatePayload.enableHousekeeping = data.enableHousekeeping;
        if (data.enableInventory !== undefined) updatePayload.enableInventory = data.enableInventory;
        if (data.emailNotifications !== undefined) updatePayload.enableEmailNotifications = data.emailNotifications;
        if (data.smsNotifications !== undefined) updatePayload.enableSmsNotifications = data.smsNotifications;
        if (data.enableHotel !== undefined) updatePayload.enableHotel = data.enableHotel;
        if (data.enableFoodAndBeverage !== undefined) updatePayload.enableFoodAndBeverage = data.enableFoodAndBeverage;
        if (data.enableFonepay !== undefined) updatePayload.enableFonepay = data.enableFonepay;

        if (existing) {
            await db.update(tenantFeatures)
                .set(updatePayload)
                .where(eq(tenantFeatures.hotelId, hotelId));
        } else {
            await db.insert(tenantFeatures).values({
                hotelId,
                ...updatePayload,
            });
        }

        await logAction(hotelId, userId, 'UPDATE_FEATURES', 'HOTEL', hotelId.toString(), data, ip);
        await this.invalidate(hotelId);
    },

    async getGuestPortalConfig(hotelId: number) {
        const hotel = await db.query.hotels.findFirst({
            where: eq(hotels.id, hotelId),
            columns: { guestPortalConfig: true }
        });
        if (!hotel) throw new NotFoundError('Hotel');
        const config = (hotel.guestPortalConfig || {}) as Record<string, any>;
        return {
            welcomeMessage: config.welcomeMessage || '',
            wifiNetworks: Array.isArray(config.wifiNetworks) ? config.wifiNetworks : [],
            contactNumbers: config.contactNumbers || {},
            socialLinks: config.socialLinks || {},
            customSections: Array.isArray(config.customSections) ? config.customSections : [],
            showBillBreakdown: config.showBillBreakdown !== false,
            showOrderProgress: config.showOrderProgress !== false,
        };
    },

    async updateGuestPortalConfig(hotelId: number, userId: string, data: any, ip?: string) {
        const hotel = await db.query.hotels.findFirst({
            where: eq(hotels.id, hotelId),
            columns: { guestPortalConfig: true }
        });
        if (!hotel) throw new NotFoundError('Hotel');
        const existing = (hotel.guestPortalConfig || {}) as Record<string, any>;
        const next = {
            ...existing,
            ...(data.welcomeMessage !== undefined && { welcomeMessage: data.welcomeMessage }),
            ...(data.wifiNetworks !== undefined && { wifiNetworks: data.wifiNetworks }),
            ...(data.contactNumbers !== undefined && { contactNumbers: data.contactNumbers }),
            ...(data.socialLinks !== undefined && { socialLinks: data.socialLinks }),
            ...(data.customSections !== undefined && { customSections: data.customSections }),
            ...(data.showBillBreakdown !== undefined && { showBillBreakdown: data.showBillBreakdown }),
            ...(data.showOrderProgress !== undefined && { showOrderProgress: data.showOrderProgress }),
        };
        await db.update(hotels)
            .set({ guestPortalConfig: next, updatedAt: new Date() })
            .where(eq(hotels.id, hotelId));
        await logAction(hotelId, userId, 'UPDATE_GUEST_PORTAL_CONFIG', 'HOTEL', hotelId.toString(), data, ip);
    },

    // Default enabled methods for Nepal (no UPI — that's an India rail).
    DEFAULT_PAYMENT_METHODS: ['CASH', 'CARD', 'FONEPAY', 'ESEWA', 'KHALTI', 'BANK_TRANSFER'] as string[],

    async getPaymentConfig(hotelId: number) {
        const hotel = await db.query.hotels.findFirst({
            where: eq(hotels.id, hotelId),
            columns: { paymentConfig: true }
        });
        if (!hotel) throw new NotFoundError('Hotel');
        const config = (hotel.paymentConfig || {}) as Record<string, any>;
        return {
            enabledMethods: Array.isArray(config.enabledMethods) && config.enabledMethods.length > 0
                ? config.enabledMethods
                : this.DEFAULT_PAYMENT_METHODS,
            // Never return the Fonepay secret — only whether it is set.
            fonepay: {
                merchantCode: config.fonepay?.merchantCode || '',
                qrString: config.fonepay?.qrString || '',
                secretKeySet: !!config.fonepay?.secretKey,
            },
            paymentQr: config.paymentQr || { imageUrl: '', label: '' },
            // Per-method scan-to-pay QRs: { FONEPAY: {imageUrl,label}, ESEWA: {...}, ... }
            paymentQrs: config.paymentQrs || {},
            cancellation: config.cancellation || { enabled: false, type: 'FIXED', value: 0 },
        };
    },

    async updatePaymentConfig(hotelId: number, userId: string, data: any, ip?: string) {
        const hotel = await db.query.hotels.findFirst({
            where: eq(hotels.id, hotelId),
            columns: { paymentConfig: true }
        });
        if (!hotel) throw new NotFoundError('Hotel');
        const existing = (hotel.paymentConfig || {}) as Record<string, any>;
        // Merge Fonepay so a blank secret from the UI never wipes the stored one.
        let fonepayNext = (existing.fonepay || {}) as Record<string, any>;
        if (data.fonepay !== undefined) {
            fonepayNext = {
                ...fonepayNext,
                ...(data.fonepay.merchantCode !== undefined && { merchantCode: data.fonepay.merchantCode }),
                ...(data.fonepay.qrString !== undefined && { qrString: data.fonepay.qrString }),
                ...(data.fonepay.secretKey ? { secretKey: data.fonepay.secretKey } : {}),
            };
        }
        const next = {
            ...existing,
            ...(data.enabledMethods !== undefined && { enabledMethods: data.enabledMethods }),
            ...(data.fonepay !== undefined && { fonepay: fonepayNext }),
            // Static scan-to-pay QR (bank / eSewa / Khalti) shown during payment.
            ...(data.paymentQr !== undefined && { paymentQr: data.paymentQr }),
            ...(data.paymentQrs !== undefined && { paymentQrs: data.paymentQrs }),
            // Hotel cancellation policy: { enabled, type: 'FIXED'|'PERCENT', value }.
            ...(data.cancellation !== undefined && { cancellation: data.cancellation }),
        };
        await db.update(hotels)
            .set({ paymentConfig: next, updatedAt: new Date() })
            .where(eq(hotels.id, hotelId));
        await logAction(hotelId, userId, 'UPDATE_PAYMENT_CONFIG', 'HOTEL', hotelId.toString(), { enabledMethods: data.enabledMethods }, ip);
        await this.invalidate(hotelId);
    },

    async getNotificationConfig(hotelId: number) {
        const hotel = await db.query.hotels.findFirst({
            where: eq(hotels.id, hotelId),
            columns: { notificationConfig: true }
        });
        if (!hotel) throw new NotFoundError('Hotel');
        const c = (hotel.notificationConfig || {}) as Record<string, any>;
        return {
            pusher: c.pusher || { appKey: '', cluster: 'ap2' },
            events: {
                newBooking: c.events?.newBooking !== false,
                checkout: c.events?.checkout !== false,
                newOrder: c.events?.newOrder !== false,
                orderReady: c.events?.orderReady !== false,
                lowStock: c.events?.lowStock !== false,
                housekeeping: c.events?.housekeeping !== false,
            },
        };
    },

    /** Per-hotel SMS / Email provider credentials (notificationSettings table).
     *  Secrets are returned as booleans (configured?) — never the raw value. */
    async getMessagingProviders(hotelId: number) {
        const s = await db.query.notificationSettings.findFirst({ where: eq(notificationSettings.hotelId, hotelId) });
        return {
            sms: {
                provider: s?.smsProvider || '',
                senderId: s?.smsSenderId || '',
                apiKeySet: !!s?.smsApiKey,
                apiSecretSet: !!s?.smsApiSecret,
            },
            email: {
                smtpHost: s?.smtpHost || '',
                smtpPort: s?.smtpPort || 587,
                smtpUser: s?.smtpUser || '',
                smtpFromEmail: s?.smtpFromEmail || '',
                smtpFromName: s?.smtpFromName || '',
                smtpPasswordSet: !!s?.smtpPassword,
            },
        };
    },

    async updateMessagingProviders(hotelId: number, userId: string, data: any, ip?: string) {
        const existing = await db.query.notificationSettings.findFirst({ where: eq(notificationSettings.hotelId, hotelId) });
        // Build patch — only overwrite a secret when a non-empty value is sent.
        const patch: Record<string, any> = { hotelId, updatedAt: new Date() };
        const sms = data.sms || {};
        const email = data.email || {};
        if (sms.provider !== undefined) patch.smsProvider = sms.provider || null;
        if (sms.senderId !== undefined) patch.smsSenderId = sms.senderId || null;
        if (sms.apiKey) patch.smsApiKey = sms.apiKey;
        if (sms.apiSecret) patch.smsApiSecret = sms.apiSecret;
        if (email.smtpHost !== undefined) patch.smtpHost = email.smtpHost || null;
        if (email.smtpPort !== undefined) patch.smtpPort = email.smtpPort;
        if (email.smtpUser !== undefined) patch.smtpUser = email.smtpUser || null;
        if (email.smtpFromEmail !== undefined) patch.smtpFromEmail = email.smtpFromEmail || null;
        if (email.smtpFromName !== undefined) patch.smtpFromName = email.smtpFromName || null;
        if (email.smtpPassword) patch.smtpPassword = email.smtpPassword;

        if (existing) {
            await db.update(notificationSettings).set(patch).where(eq(notificationSettings.hotelId, hotelId));
        } else {
            await db.insert(notificationSettings).values(patch as any);
        }
        await logAction(hotelId, userId, 'UPDATE_MESSAGING_PROVIDERS', 'HOTEL', hotelId.toString(), { sms: sms.provider, email: email.smtpHost }, ip);
        await this.invalidate(hotelId);
        return this.getMessagingProviders(hotelId);
    },

    async updateNotificationConfig(hotelId: number, userId: string, data: any, ip?: string) {
        const hotel = await db.query.hotels.findFirst({
            where: eq(hotels.id, hotelId),
            columns: { notificationConfig: true }
        });
        if (!hotel) throw new NotFoundError('Hotel');
        const existing = (hotel.notificationConfig || {}) as Record<string, any>;
        const next = {
            ...existing,
            ...(data.pusher !== undefined && { pusher: data.pusher }),
            ...(data.events !== undefined && { events: { ...(existing.events || {}), ...data.events } }),
        };
        await db.update(hotels)
            .set({ notificationConfig: next, updatedAt: new Date() })
            .where(eq(hotels.id, hotelId));
        await logAction(hotelId, userId, 'UPDATE_NOTIFICATION_CONFIG', 'HOTEL', hotelId.toString(), data, ip);
        await this.invalidate(hotelId);
    },
};
