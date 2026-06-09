import { db } from '../../db';
import { coupons } from '../../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { BusinessLogicError, NotFoundError } from '../../utils/errors';
import { logAction } from '../system/audit.service';

export interface CouponInput {
    code: string;
    description?: string;
    discountType?: 'PERCENT' | 'FIXED';
    discountValue: number;
    maxDiscount?: number;
    minOrderAmount?: number;
    scope?: 'ALL' | 'ROOM' | 'FNB';
    usageLimit?: number;
    validFrom?: string;
    validUntil?: string;
    isActive?: boolean;
}

const num = (v: unknown) => parseFloat(String(v ?? '0')) || 0;

export const CouponsService = {
    async list(hotelId: number) {
        return db.query.coupons.findMany({
            where: eq(coupons.hotelId, hotelId),
            orderBy: (c, { desc }) => [desc(c.createdAt)],
        });
    },

    async create(hotelId: number, userId: string, data: CouponInput, ip?: string) {
        const code = data.code.trim().toUpperCase();
        if (!code) throw new BusinessLogicError('Coupon code is required');

        const existing = await db.query.coupons.findFirst({
            where: and(eq(coupons.hotelId, hotelId), eq(coupons.code, code)),
        });
        if (existing) throw new BusinessLogicError(`Coupon code "${code}" already exists`);

        const [coupon] = await db.insert(coupons).values({
            hotelId,
            code,
            description: data.description,
            discountType: data.discountType || 'PERCENT',
            discountValue: String(data.discountValue),
            maxDiscount: String(data.maxDiscount ?? 0),
            minOrderAmount: String(data.minOrderAmount ?? 0),
            scope: data.scope || 'ALL',
            usageLimit: data.usageLimit ?? 0,
            validFrom: data.validFrom ? new Date(data.validFrom) : null,
            validUntil: data.validUntil ? new Date(data.validUntil) : null,
            isActive: data.isActive ?? true,
            createdById: userId,
        }).returning();

        await logAction(hotelId, userId, 'CREATE_COUPON', 'COUPON', String(coupon!.id), { code }, ip);
        return coupon;
    },

    async update(hotelId: number, userId: string, id: number, data: Partial<CouponInput>, ip?: string) {
        const updates: Record<string, unknown> = { updatedAt: new Date() };
        if (data.code !== undefined) updates.code = data.code.trim().toUpperCase();
        if (data.description !== undefined) updates.description = data.description;
        if (data.discountType !== undefined) updates.discountType = data.discountType;
        if (data.discountValue !== undefined) updates.discountValue = String(data.discountValue);
        if (data.maxDiscount !== undefined) updates.maxDiscount = String(data.maxDiscount);
        if (data.minOrderAmount !== undefined) updates.minOrderAmount = String(data.minOrderAmount);
        if (data.scope !== undefined) updates.scope = data.scope;
        if (data.usageLimit !== undefined) updates.usageLimit = data.usageLimit;
        if (data.validFrom !== undefined) updates.validFrom = data.validFrom ? new Date(data.validFrom) : null;
        if (data.validUntil !== undefined) updates.validUntil = data.validUntil ? new Date(data.validUntil) : null;
        if (data.isActive !== undefined) updates.isActive = data.isActive;

        const [coupon] = await db.update(coupons)
            .set(updates)
            .where(and(eq(coupons.id, id), eq(coupons.hotelId, hotelId)))
            .returning();
        if (!coupon) throw new NotFoundError('Coupon');
        await logAction(hotelId, userId, 'UPDATE_COUPON', 'COUPON', String(id), data, ip);
        return coupon;
    },

    async remove(hotelId: number, userId: string, id: number, ip?: string) {
        const [deleted] = await db.delete(coupons)
            .where(and(eq(coupons.id, id), eq(coupons.hotelId, hotelId)))
            .returning();
        if (!deleted) throw new NotFoundError('Coupon');
        await logAction(hotelId, userId, 'DELETE_COUPON', 'COUPON', String(id), { code: deleted.code }, ip);
        return deleted;
    },

    /**
     * Validate a coupon against an order amount/scope and compute the discount.
     * Does NOT consume usage — call `redeem` once the sale is committed.
     */
    async validate(hotelId: number, code: string, amount: number, scope: 'ROOM' | 'FNB' | 'ALL' = 'ALL') {
        const coupon = await db.query.coupons.findFirst({
            where: and(eq(coupons.hotelId, hotelId), eq(coupons.code, code.trim().toUpperCase())),
        });
        if (!coupon) throw new NotFoundError('Coupon');
        if (!coupon.isActive) throw new BusinessLogicError('Coupon is inactive');

        const now = new Date();
        if (coupon.validFrom && now < coupon.validFrom) throw new BusinessLogicError('Coupon is not yet valid');
        if (coupon.validUntil && now > coupon.validUntil) throw new BusinessLogicError('Coupon has expired');

        if (coupon.scope !== 'ALL' && scope !== 'ALL' && coupon.scope !== scope) {
            throw new BusinessLogicError(`Coupon only applies to ${coupon.scope}`);
        }
        const minOrder = num(coupon.minOrderAmount);
        if (minOrder > 0 && amount < minOrder) {
            throw new BusinessLogicError(`Minimum order amount is ${minOrder}`);
        }
        const limit = coupon.usageLimit ?? 0;
        if (limit > 0 && (coupon.usedCount ?? 0) >= limit) {
            throw new BusinessLogicError('Coupon usage limit reached');
        }

        let discount = coupon.discountType === 'PERCENT'
            ? (amount * num(coupon.discountValue)) / 100
            : num(coupon.discountValue);

        const cap = num(coupon.maxDiscount);
        if (coupon.discountType === 'PERCENT' && cap > 0) discount = Math.min(discount, cap);
        discount = Math.min(discount, amount); // never exceed the order
        discount = Math.round(discount * 100) / 100;

        return {
            couponId: coupon.id,
            code: coupon.code,
            discountType: coupon.discountType,
            discountValue: num(coupon.discountValue),
            discount,
            finalAmount: Math.round((amount - discount) * 100) / 100,
        };
    },

    /** Increment usage count after a coupon-backed sale is committed.
     *  Atomic limit guard: won't push usedCount past usageLimit even if two
     *  checkouts validate the last remaining use concurrently. */
    async redeem(hotelId: number, id: number) {
        await db.update(coupons)
            .set({ usedCount: sql`${coupons.usedCount} + 1` })
            .where(and(
                eq(coupons.id, id),
                eq(coupons.hotelId, hotelId),
                sql`(${coupons.usageLimit} = 0 OR ${coupons.usedCount} < ${coupons.usageLimit})`
            ));
    },
};
