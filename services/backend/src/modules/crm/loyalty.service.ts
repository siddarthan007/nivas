import { db } from '../../db';
import { bookings, hotels } from '../../db/schema';
import { eq, and, sql } from 'drizzle-orm';

export interface LoyaltyDiscount {
    percent: number;
    reason: string;
    stayCount: number;
}

interface LoyaltyTier {
    minStays: number;
    discountPercent: number;
}

interface LoyaltyRules {
    enabled?: boolean;
    tiers?: LoyaltyTier[];
}

const DEFAULT_TIERS: LoyaltyTier[] = [
    { minStays: 5, discountPercent: 10 },
    { minStays: 3, discountPercent: 5 },
];

/**
 * Rule-based repeat-guest loyalty discount for POS orders.
 * Rules live in hotel.paymentConfig.loyaltyRules (no migration required).
 */
export const LoyaltyService = {
    async getRules(hotelId: number): Promise<LoyaltyRules> {
        const hotel = await db.query.hotels.findFirst({
            where: eq(hotels.id, hotelId),
            columns: { paymentConfig: true },
        });
        const cfg = ((hotel?.paymentConfig as Record<string, unknown>) || {}).loyaltyRules as LoyaltyRules | undefined;
        return { enabled: cfg?.enabled === true, tiers: cfg?.tiers?.length ? cfg.tiers : DEFAULT_TIERS };
    },

    async countCompletedStays(hotelId: number, guestId?: string | null, guestPhone?: string | null): Promise<number> {
        if (guestId) {
            const rows = await db
                .select({ count: sql<number>`count(*)::int` })
                .from(bookings)
                .where(and(
                    eq(bookings.hotelId, hotelId),
                    eq(bookings.guestId, guestId),
                    eq(bookings.status, 'CHECKED_OUT'),
                ));
            return Number(rows[0]?.count) || 0;
        }
        const phone = (guestPhone || '').trim();
        if (!phone) return 0;
        const rows = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(bookings)
            .where(and(
                eq(bookings.hotelId, hotelId),
                eq(bookings.guestPhone, phone),
                eq(bookings.status, 'CHECKED_OUT'),
            ));
        return Number(rows[0]?.count) || 0;
    },

    async getPosDiscount(hotelId: number, opts: {
        guestId?: string | null;
        bookingId?: string | null;
        guestPhone?: string | null;
    }): Promise<LoyaltyDiscount | null> {
        const rules = await this.getRules(hotelId);
        if (!rules.enabled) return null;

        let guestId = opts.guestId;
        let guestPhone = opts.guestPhone;

        if (!guestId && opts.bookingId) {
            const booking = await db.query.bookings.findFirst({
                where: and(eq(bookings.id, opts.bookingId), eq(bookings.hotelId, hotelId)),
                columns: { guestId: true, guestPhone: true },
            });
            guestId = booking?.guestId;
            guestPhone = guestPhone || booking?.guestPhone;
        }

        if (!guestId && !guestPhone) return null;

        const stayCount = await this.countCompletedStays(hotelId, guestId, guestPhone);
        const tiers = [...(rules.tiers || DEFAULT_TIERS)].sort((a, b) => b.minStays - a.minStays);

        for (const tier of tiers) {
            if (stayCount >= tier.minStays) {
                return {
                    percent: tier.discountPercent,
                    reason: `Loyalty: ${stayCount} previous stay(s) — ${tier.discountPercent}% off`,
                    stayCount,
                };
            }
        }
        return null;
    },

    async computeDiscountAmount(hotelId: number, grossTotal: number, opts: {
        guestId?: string | null;
        bookingId?: string | null;
        guestPhone?: string | null;
    }): Promise<{ discountAmount: number; loyalty: LoyaltyDiscount | null }> {
        const loyalty = await this.getPosDiscount(hotelId, opts);
        if (!loyalty || grossTotal <= 0) return { discountAmount: 0, loyalty };
        const discountAmount = Math.round(grossTotal * (loyalty.percent / 100) * 100) / 100;
        return { discountAmount: Math.min(discountAmount, grossTotal), loyalty };
    },
};
