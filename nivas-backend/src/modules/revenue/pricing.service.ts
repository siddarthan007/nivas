import { db } from '../../db';
import { pricingRules, hotels } from '../../db/schema';
import { eq, and, or, isNull, sql } from 'drizzle-orm';

export const PricingService = {
    async getRules(hotelId: number) {
        return await db.query.pricingRules.findMany({
            where: eq(pricingRules.hotelId, hotelId)
        });
    },

    async createRule(hotelId: number, data: any) {
        const [rule] = await db.insert(pricingRules).values({
            hotelId,
            ...data
        }).returning();
        return rule;
    },

    async updateRule(hotelId: number, id: number, data: any) {
        const [updated] = await db.update(pricingRules)
            .set(data)
            .where(and(eq(pricingRules.id, id), eq(pricingRules.hotelId, hotelId)))
            .returning();
        return updated;
    },

    async deleteRule(hotelId: number, id: number) {
        await db.delete(pricingRules)
            .where(and(eq(pricingRules.id, id), eq(pricingRules.hotelId, hotelId)));
    },

    async calculateRate(hotelId: number, baseRate: number, date: Date = new Date(), timezone: string = 'Asia/Kathmandu') {
        const dateStr = date.toLocaleDateString('en-CA', { timeZone: timezone });
        const dayName = date.toLocaleDateString('en-US', { timeZone: timezone, weekday: 'long' });
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayOfWeek = days.indexOf(dayName);

        const rules = await db.query.pricingRules.findMany({
            where: and(
                eq(pricingRules.hotelId, hotelId),
                eq(pricingRules.isActive, true),
                or(
                    sql`${pricingRules.startDate} <= ${dateStr} AND ${pricingRules.endDate} >= ${dateStr} `,
                    and(isNull(pricingRules.startDate), isNull(pricingRules.endDate))
                )
            )
        });

        let finalRate = baseRate;
        let appliedRules: string[] = [];

        for (const rule of rules) {
            if (rule.daysOfWeek && !rule.daysOfWeek.includes(dayOfWeek)) {
                continue;
            }
            const adjustment = parseFloat(rule.adjustmentValue);
            if (rule.adjustmentType === 'FLAT') {
                finalRate += adjustment;
            } else if (rule.adjustmentType === 'PERCENTAGE') {
                finalRate += (baseRate * (adjustment / 100));
            }
            appliedRules.push(rule.name);
        }

        return {
            finalRate: Math.max(0, finalRate),
            baseRate,
            appliedRules
        };
    }
};