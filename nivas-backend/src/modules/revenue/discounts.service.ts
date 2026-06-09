import { db } from '../../db';
import { discountRules, outlets } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { BusinessLogicError, NotFoundError, ValidationError } from '../../utils/errors';

// Reject an outletId that doesn't belong to this hotel (cross-tenant IDOR).
async function assertOutlet(hotelId: number, outletId?: number) {
    if (outletId == null) return;
    const o = await db.query.outlets.findFirst({ where: and(eq(outlets.id, outletId), eq(outlets.hotelId, hotelId)), columns: { id: true } });
    if (!o) throw new ValidationError('Invalid outlet for this hotel');
}

export const DiscountService = {
    async createRule(hotelId: number, data: any) {
        await assertOutlet(hotelId, data.outletId);
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
        if (data.outletId !== undefined) await assertOutlet(hotelId, data.outletId);
        const allowed = ['name', 'description', 'outletId', 'discountType', 'startTime', 'endTime', 'daysOfWeek', 'startDate', 'endDate', 'applicableCategories', 'applicableItems', 'priority', 'isActive'];
        const updateData: any = {};
        for (const key of allowed) {
            if (data[key] !== undefined) updateData[key] = data[key];
        }
        const [updated] = await db.update(discountRules)
            .set({
                ...updateData,
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
