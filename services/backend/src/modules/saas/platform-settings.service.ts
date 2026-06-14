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
            billing: (s?.billingConfig || {}) as { name?: string; email?: string; phone?: string; pan?: string; vat?: string; address?: string; },
        };
    },

    async update(data: any) {
        const sms = data.sms || {}; const email = data.email || {}; const billing = data.billing || {};
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
        const currentBilling = (existing?.billingConfig || {}) as Record<string, any>;
        const nextBilling = { ...currentBilling };
        if (billing.name !== undefined) nextBilling.name = billing.name;
        if (billing.email !== undefined) nextBilling.email = billing.email;
        if (billing.phone !== undefined) nextBilling.phone = billing.phone;
        if (billing.pan !== undefined) nextBilling.pan = billing.pan;
        if (billing.vat !== undefined) nextBilling.vat = billing.vat;
        if (billing.address !== undefined) nextBilling.address = billing.address;
        patch.billingConfig = nextBilling;

        if (existing) await db.update(platformSettings).set(patch).where(eq(platformSettings.id, 1));
        else await db.insert(platformSettings).values(patch as any);
        return this.get();
    },

    async getBillingConfig() {
        const s = await db.query.platformSettings.findFirst({ where: eq(platformSettings.id, 1), columns: { billingConfig: true } });
        return (s?.billingConfig || {}) as { name?: string; email?: string; phone?: string; pan?: string; vat?: string; address?: string; };
    },

    async updateBillingConfig(data: { name?: string; email?: string; phone?: string; pan?: string; vat?: string; address?: string }) {
        const ps = await db.query.platformSettings.findFirst({ where: eq(platformSettings.id, 1), columns: { billingConfig: true } });
        const next = { ...((ps?.billingConfig || {}) as Record<string, any>) };
        for (const k of ['name', 'email', 'phone', 'pan', 'vat', 'address'] as const) if (data[k] !== undefined) next[k] = data[k];
        await db.insert(platformSettings).values({ id: 1, billingConfig: next } as { id: number; billingConfig: Record<string, any> })
            .onConflictDoUpdate({ target: platformSettings.id, set: { billingConfig: next, updatedAt: new Date() } });
        return this.getBillingConfig();
    },
};
