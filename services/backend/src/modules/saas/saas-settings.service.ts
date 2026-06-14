import { db } from '../../db';
import { tenantFeatures, notificationSettings, hotels } from '../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { NotFoundError, BusinessLogicError, ValidationError } from '../../utils/errors';
import { NotificationChannelService } from '../notifications/notification-channel.service';

interface AiConfig {
    enabled?: boolean;
    model?: string;
    apiKey?: string;
    dailyLimit?: number;
}

interface CbmsConfig {
    enabled?: boolean;
    username?: string;
    password?: string;
    sellerPan?: string;
    isRealtime?: boolean;
}

export const SaasSettingsService = {
    async getTenantFeatures(hotelId: number) {
        let features = await db.query.tenantFeatures.findFirst({
            where: eq(tenantFeatures.hotelId, hotelId)
        });

        if (!features) {
            const [created] = await db.insert(tenantFeatures).values({
                hotelId
            }).returning();
            features = created;
        }

        return features;
    },

    async updateTenantFeatures(hotelId: number, data: any) {
        const allowed = ['enableSmsNotifications', 'enableWhatsappNotifications', 'enableEmailNotifications', 'enableBanquets', 'enablePosIntegration', 'enableInventory', 'enableHousekeeping', 'enableGuestPortal', 'enableHotel', 'enableFoodAndBeverage', 'enableFonepay', 'enableCbms', 'enableAi'];
        const updateData: any = {};
        for (const key of allowed) {
            if (data[key] !== undefined) updateData[key] = data[key];
        }
        const existing = await db.query.tenantFeatures.findFirst({
            where: eq(tenantFeatures.hotelId, hotelId)
        });

        let updated;
        if (existing) {
            [updated] = await db.update(tenantFeatures)
                .set({ ...updateData, updatedAt: new Date() })
                .where(eq(tenantFeatures.hotelId, hotelId))
                .returning();
        } else {
            [updated] = await db.insert(tenantFeatures).values({
                hotelId,
                ...updateData
            }).returning();
        }

        return updated;
    },

    async getNotificationSettings(hotelId: number) {
        let settings = await db.query.notificationSettings.findFirst({
            where: eq(notificationSettings.hotelId, hotelId)
        });

        if (!settings) {
            const [created] = await db.insert(notificationSettings).values({
                hotelId
            }).returning();
            settings = created;
        }

        if (!settings) {
            throw new NotFoundError('Notification settings');
        }

        return {
            ...settings,
            smtpPassword: settings.smtpPassword ? '***' : null,
            smtpPasswordSet: !!settings.smtpPassword,
            smsApiKey: settings.smsApiKey ? '***' : null,
            smsApiKeySet: !!settings.smsApiKey,
            smsApiSecret: settings.smsApiSecret ? '***' : null,
            smsApiSecretSet: !!settings.smsApiSecret,
            whatsappApiKey: settings.whatsappApiKey ? '***' : null,
            whatsappApiKeySet: !!settings.whatsappApiKey,
        };
    },

    async updateNotificationSettings(hotelId: number, data: any) {
        const allowed = ['smtpHost', 'smtpPort', 'smtpUser', 'smtpPassword', 'smtpFromEmail', 'smtpFromName', 'smsProvider', 'smsApiKey', 'smsApiSecret', 'smsSenderId', 'whatsappProvider', 'whatsappApiKey', 'whatsappPhoneNumberId', 'whatsappBusinessId', 'bookingConfirmationTemplate', 'checkInReminderTemplate', 'paymentReceiptTemplate'];
        const updateData: any = {};
        for (const key of allowed) {
            if (data[key] !== undefined) updateData[key] = data[key];
        }
        const existing = await db.query.notificationSettings.findFirst({
            where: eq(notificationSettings.hotelId, hotelId)
        });

        let updated;
        if (existing) {
            [updated] = await db.update(notificationSettings)
                .set({ ...updateData, updatedAt: new Date() })
                .where(eq(notificationSettings.hotelId, hotelId))
                .returning();
        } else {
            [updated] = await db.insert(notificationSettings).values({
                hotelId,
                ...updateData
            }).returning();
        }

        return updated;
    },

    async testNotificationChannel(hotelId: number, channel: string, recipient: string) {
        const settings = await db.query.notificationSettings.findFirst({
            where: eq(notificationSettings.hotelId, hotelId)
        });

        if (!settings) throw new BusinessLogicError('Notification settings not configured');
        if (!recipient || !recipient.trim()) throw new BusinessLogicError('A recipient is required to send a test');

        const isEmail = channel.toUpperCase() === 'EMAIL';
        const body = 'This is a test message from your Nivas PMS notification settings. If you received it, the channel is configured correctly.';

        // Actually dispatch through the configured provider so the test is real.
        const result = isEmail
            ? await NotificationChannelService.sendEmail(settings, recipient, 'Nivas PMS — Test Notification', body)
            : await NotificationChannelService.sendSms(settings, recipient, body);

        const ok = !!(result && (result as any).success !== false);
        if (!ok) {
            throw new BusinessLogicError((result as any)?.error || `Failed to send test ${channel} message`);
        }
        return {
            channel,
            testResult: 'SENT',
            message: `Test ${channel} notification sent to ${recipient}`,
        };
    },

    /** Per-hotel AI engine config (Gemini). API key masked on read. */
    async getAiConfig(hotelId: number) {
        const hotel = await db.query.hotels.findFirst({ where: eq(hotels.id, hotelId), columns: { aiConfig: true } });
        const cfg = (hotel?.aiConfig || {}) as AiConfig;
        // Normalize to a currently-allowed model (an old/retired value would otherwise
        // not match any dropdown option and get rejected on the next save).
        const model = cfg.model && this.ALLOWED_AI_MODELS.includes(cfg.model as string) ? cfg.model : 'gemini-2.5-flash';
        return {
            enabled: cfg.enabled !== false,
            model,
            apiKeySet: !!cfg.apiKey,
            dailyLimit: Number(cfg.dailyLimit) > 0 ? Number(cfg.dailyLimit) : 500,
        };
    },

    // Only Gemini Flash models available in Google AI Studio (cost + latency control).
    ALLOWED_AI_MODELS: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'] as string[],

    async setAiConfig(hotelId: number, data: { enabled?: boolean; model?: string; apiKey?: string; dailyLimit?: number }) {
        const hotel = await db.query.hotels.findFirst({ where: eq(hotels.id, hotelId), columns: { aiConfig: true } });
        if (!hotel) throw new NotFoundError('Hotel');
        const cur = (hotel.aiConfig || {}) as AiConfig;
        const next: AiConfig = { ...cur };
        if (data.enabled !== undefined) next.enabled = data.enabled;
        if (data.model !== undefined) {
            if (data.model && !this.ALLOWED_AI_MODELS.includes(data.model)) {
                throw new ValidationError('Only Gemini Flash models are supported');
            }
            next.model = data.model || undefined;
        }
        if (data.apiKey) next.apiKey = data.apiKey;      // only overwrite when a new key is sent
        if (data.dailyLimit !== undefined) next.dailyLimit = data.dailyLimit > 0 ? data.dailyLimit : undefined;
        await db.update(hotels).set({ aiConfig: next, updatedAt: new Date() }).where(eq(hotels.id, hotelId));
        return this.getAiConfig(hotelId);
    },

    /** IRD CBMS credentials for a tenant (SaaS-admin managed). Password masked on read. */
    async getCbmsConfig(hotelId: number) {
        const hotel = await db.query.hotels.findFirst({ where: eq(hotels.id, hotelId), columns: { cbmsConfig: true, panNumber: true } });
        const cfg = (hotel?.cbmsConfig || {}) as CbmsConfig;
        return {
            enabled: !!cfg.enabled,
            username: cfg.username || '',
            sellerPan: cfg.sellerPan || hotel?.panNumber || '',
            isRealtime: cfg.isRealtime ?? true,
            passwordSet: !!cfg.password,
        };
    },

    async setCbmsConfig(hotelId: number, data: { enabled?: boolean; username?: string; password?: string; sellerPan?: string; isRealtime?: boolean }) {
        const hotel = await db.query.hotels.findFirst({ where: eq(hotels.id, hotelId), columns: { cbmsConfig: true } });
        if (!hotel) throw new NotFoundError('Hotel');
        const cur = (hotel.cbmsConfig || {}) as CbmsConfig;
        const next: CbmsConfig = { ...cur };
        if (data.enabled !== undefined) next.enabled = data.enabled;
        if (data.username !== undefined) next.username = data.username;
        if (data.sellerPan !== undefined) next.sellerPan = data.sellerPan;
        if (data.isRealtime !== undefined) next.isRealtime = data.isRealtime;
        if (data.password) next.password = data.password; // only overwrite when a new value is sent
        await db.update(hotels).set({ cbmsConfig: next, updatedAt: new Date() }).where(eq(hotels.id, hotelId));
        return this.getCbmsConfig(hotelId);
    },
};
