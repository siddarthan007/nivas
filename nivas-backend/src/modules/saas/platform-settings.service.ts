import { db } from '../../db';
import { platformSettings } from '../../db/schema';
import { eq } from 'drizzle-orm';

/**
 * Platform-wide SMS / Email gateway credentials (super-admin managed, shared by
 * every tenant). Secrets returned as booleans; only overwritten when a new value
 * is sent. Singleton row id = 1.
 */
export const PlatformSettingsService = {
    async get() {
        const s = await db.query.platformSettings.findFirst({ where: eq(platformSettings.id, 1) });
        return {
            sms: { provider: s?.smsProvider || '', senderId: s?.smsSenderId || '', apiKeySet: !!s?.smsApiKey, apiSecretSet: !!s?.smsApiSecret },
            email: {
                smtpHost: s?.smtpHost || '', smtpPort: s?.smtpPort || 587, smtpUser: s?.smtpUser || '',
                smtpFromEmail: s?.smtpFromEmail || '', smtpFromName: s?.smtpFromName || '', smtpPasswordSet: !!s?.smtpPassword,
            },
        };
    },

    async update(data: any) {
        const sms = data.sms || {}; const email = data.email || {};
        const patch: Record<string, any> = { id: 1, updatedAt: new Date() };
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

        const existing = await db.query.platformSettings.findFirst({ where: eq(platformSettings.id, 1) });
        if (existing) await db.update(platformSettings).set(patch).where(eq(platformSettings.id, 1));
        else await db.insert(platformSettings).values(patch as any);
        return this.get();
    },
};
