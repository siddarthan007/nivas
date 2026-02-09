import { db } from '../../db';
import { tenantFeatures, notificationSettings, exchangeRates, hotels } from '../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { NotFoundError, BusinessLogicError } from '../../utils/errors';

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
        const existing = await db.query.tenantFeatures.findFirst({
            where: eq(tenantFeatures.hotelId, hotelId)
        });

        let updated;
        if (existing) {
            [updated] = await db.update(tenantFeatures)
                .set({ ...data, updatedAt: new Date() })
                .where(eq(tenantFeatures.hotelId, hotelId))
                .returning();
        } else {
            [updated] = await db.insert(tenantFeatures).values({
                hotelId,
                ...data
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

        return settings;
    },

    async updateNotificationSettings(hotelId: number, data: any) {
        const existing = await db.query.notificationSettings.findFirst({
            where: eq(notificationSettings.hotelId, hotelId)
        });

        let updated;
        if (existing) {
            [updated] = await db.update(notificationSettings)
                .set({ ...data, updatedAt: new Date() })
                .where(eq(notificationSettings.hotelId, hotelId))
                .returning();
        } else {
            [updated] = await db.insert(notificationSettings).values({
                hotelId,
                ...data
            }).returning();
        }

        return updated;
    },

    async testNotificationChannel(hotelId: number, channel: string, recipient: string) {
        const settings = await db.query.notificationSettings.findFirst({
            where: eq(notificationSettings.hotelId, hotelId)
        });

        if (!settings) throw new BusinessLogicError('Notification settings not configured');

        // Logic to actually send test message via NotificationService would go here
        // For now we just return a success dummy response as in the original controller

        return {
            channel,
            testResult: 'CONNECTION_OK',
            message: `Test ${channel} notification sent successfully`
        };
    },

    async getExchangeRates() {
        return await db.query.exchangeRates.findMany({
            orderBy: [desc(exchangeRates.effectiveFrom)]
        });
    },

    async createExchangeRate(data: any) {
        const [rate] = await db.insert(exchangeRates).values({
            baseCurrency: data.baseCurrency,
            targetCurrency: data.targetCurrency,
            rate: data.rate.toString(),
            effectiveFrom: data.effectiveFrom,
            effectiveTo: data.effectiveTo,
            source: data.source
        }).returning();
        return rate;
    },

    async convertCurrency(from: string, to: string, amountStr: string) {
        const amount = parseFloat(amountStr);
        if (isNaN(amount)) throw new BusinessLogicError('Invalid amount');

        const rate = await db.query.exchangeRates.findFirst({
            where: and(
                eq(exchangeRates.baseCurrency, from),
                eq(exchangeRates.targetCurrency, to)
            ),
            orderBy: [desc(exchangeRates.effectiveFrom)]
        });

        if (rate) {
            const rateVal = parseFloat(rate.rate);
            const convertedAmount = amount * rateVal;
            return {
                from,
                to,
                amount,
                convertedAmount: Math.round(convertedAmount * 100) / 100,
                rate: rateVal
            };
        }

        // Try reverse rate
        const reverseRate = await db.query.exchangeRates.findFirst({
            where: and(
                eq(exchangeRates.baseCurrency, to),
                eq(exchangeRates.targetCurrency, from)
            ),
            orderBy: [desc(exchangeRates.effectiveFrom)]
        });

        if (reverseRate) {
            const reverseRateVal = parseFloat(reverseRate.rate);
            const convertedAmount = amount / reverseRateVal;
            return {
                from,
                to,
                amount,
                convertedAmount: Math.round(convertedAmount * 100) / 100,
                rate: 1 / reverseRateVal
            };
        }

        throw new NotFoundError('Exchange rate');
    },

    async updateHotelCurrency(hotelId: number, currency: string) {
        const [updated] = await db.update(hotels)
            .set({ currency, updatedAt: new Date() })
            .where(eq(hotels.id, hotelId))
            .returning();

        if (!updated) throw new NotFoundError('Hotel');
        return updated;
    }
};
