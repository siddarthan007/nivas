import { db } from '../../db';
import { losDiscounts } from '../../db/schema';
import { eq, and, lte } from 'drizzle-orm';
import { NotFoundError } from '../../utils/errors';

export const LosDiscountService = {
    async createRule(hotelId: number, data: any) {
        const [newRule] = await db.insert(losDiscounts).values({
            hotelId,
            name: data.name,
            minNights: data.minNights,
            maxNights: data.maxNights,
            discountType: data.discountType,
            discountValue: data.discountValue.toString(),
            applyTo: data.applyTo,
            specificNight: data.specificNight,
            roomTypes: data.roomTypes,
            startDate: data.startDate,
            endDate: data.endDate,
            isActive: true
        }).returning();
        return newRule;
    },

    async getAllRules(hotelId: number) {
        return await db.query.losDiscounts.findMany({
            where: eq(losDiscounts.hotelId, hotelId)
        });
    },

    async calculateDiscount(hotelId: number, query: { nights: string; roomType: string; checkIn: string }) {
        const nights = parseInt(query.nights);
        const roomType = query.roomType;
        const checkIn = query.checkIn;

        // Bad/zero nights → no discount (avoids NaN flowing into the SQL comparison).
        if (!Number.isFinite(nights) || nights < 1) {
            return { nights: 0, roomType, applicableDiscount: null };
        }

        const rules = await db.query.losDiscounts.findMany({
            where: and(
                eq(losDiscounts.hotelId, hotelId),
                eq(losDiscounts.isActive, true),
                lte(losDiscounts.minNights, nights)
            )
        });

        // Filter applicable rules
        const applicableRules = rules.filter(rule => {
            if (rule.maxNights && nights > rule.maxNights) return false;
            if (rule.roomTypes && rule.roomTypes.length > 0 && !rule.roomTypes.includes(roomType)) return false;
            if (rule.startDate && checkIn < rule.startDate) return false;
            if (rule.endDate && checkIn > rule.endDate) return false;
            return true;
        });

        // Get best discount (simple logic: first valid one for now, or could sort by value)
        // Original logic was just `applicableRules[0]`.
        // Let's improve it slightly to pick the largest discount (assuming same type, but mixed types make it hard).
        // Sticking to original logic to avoid changing business logic unrequested, but ensures consistent return structure.
        const bestDiscount = applicableRules.length > 0 ? applicableRules[0] : null;

        return {
            nights,
            roomType,
            applicableDiscount: bestDiscount ? {
                name: bestDiscount.name,
                type: bestDiscount.discountType,
                value: parseFloat(bestDiscount.discountValue),
                applyTo: bestDiscount.applyTo
            } : null
        };
    },

    async updateRule(hotelId: number, id: number, data: any) {
        const allowed = ['name', 'minNights', 'maxNights', 'discountType', 'applyTo', 'specificNight', 'roomTypes', 'startDate', 'endDate', 'isActive'];
        const updateData: any = {};
        for (const key of allowed) {
            if (data[key] !== undefined) updateData[key] = data[key];
        }
        const [updated] = await db.update(losDiscounts)
            .set({
                ...updateData,
                discountValue: data.discountValue?.toString()
            })
            .where(and(
                eq(losDiscounts.id, id),
                eq(losDiscounts.hotelId, hotelId)
            ))
            .returning();

        if (!updated) throw new NotFoundError('LOS discount');
        return updated;
    },

    async deleteRule(hotelId: number, id: number) {
        await db.delete(losDiscounts)
            .where(and(
                eq(losDiscounts.id, id),
                eq(losDiscounts.hotelId, hotelId)
            ));
    }
};
