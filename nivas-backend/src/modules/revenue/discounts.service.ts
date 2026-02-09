import { db } from '../../db';
import { discountRules } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { BusinessLogicError, NotFoundError } from '../../utils/errors';

export const DiscountService = {
    async createRule(hotelId: number, data: any) {
        const [newRule] = await db.insert(discountRules).values({
            hotelId,
            outletId: data.outletId,
            name: data.name,
            description: data.description,
            discountType: data.discountType,
            discountValue: data.discountValue.toString(),
            startTime: data.startTime,
            endTime: data.endTime,
            daysOfWeek: data.daysOfWeek,
            startDate: data.startDate,
            endDate: data.endDate,
            minOrderAmount: data.minOrderAmount?.toString(),
            applicableCategories: data.applicableCategories,
            applicableItems: data.applicableItems,
            priority: data.priority,
            isActive: true
        }).returning();

        return newRule;
    },

    async getAllRules(hotelId: number) {
        return await db.query.discountRules.findMany({
            where: eq(discountRules.hotelId, hotelId),
            with: { outlet: true }
        });
    },

    async getActiveRules(hotelId: number) {
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5);
        const dayOfWeek = now.getDay();
        const today = now.toISOString().split('T')[0];

        const allRules = await db.query.discountRules.findMany({
            where: and(
                eq(discountRules.hotelId, hotelId),
                eq(discountRules.isActive, true)
            )
        });

        return allRules.filter(rule => {
            if (rule.startTime && rule.endTime) {
                if (currentTime < rule.startTime || currentTime > rule.endTime) {
                    return false;
                }
            }
            if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
                if (!rule.daysOfWeek.includes(dayOfWeek)) {
                    return false;
                }
            }
            if (rule.startDate && today && today < rule.startDate) return false;
            if (rule.endDate && today && today > rule.endDate) return false;

            return true;
        });
    },

    async updateRule(hotelId: number, id: number, data: any) {
        const [updated] = await db.update(discountRules)
            .set({
                ...data,
                discountValue: data.discountValue?.toString(),
                minOrderAmount: data.minOrderAmount?.toString(),
                updatedAt: new Date()
            })
            .where(and(
                eq(discountRules.id, id),
                eq(discountRules.hotelId, hotelId)
            ))
            .returning();

        if (!updated) throw new NotFoundError('Discount rule');
        return updated;
    },

    async deleteRule(hotelId: number, id: number) {
        await db.delete(discountRules)
            .where(and(
                eq(discountRules.id, id),
                eq(discountRules.hotelId, hotelId)
            ));
    }
};
