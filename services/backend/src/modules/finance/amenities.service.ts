import { db } from '../../db';
import { amenities } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { NotFoundError, BusinessLogicError } from '../../utils/errors';
import { FolioService } from './folio.service';

export const AmenitiesService = {
    list(hotelId: number, activeOnly = false) {
        return db.query.amenities.findMany({
            where: activeOnly
                ? and(eq(amenities.hotelId, hotelId), eq(amenities.isActive, true))
                : eq(amenities.hotelId, hotelId),
            orderBy: (a, { asc }) => [asc(a.name)],
        });
    },

    async create(hotelId: number, data: { name: string; category?: string; price: number; taxable?: boolean; isActive?: boolean }) {
        const [a] = await db.insert(amenities).values({
            hotelId,
            name: data.name,
            category: data.category || 'OTHER',
            price: String(data.price),
            taxable: data.taxable ?? true,
            isActive: data.isActive ?? true,
        }).returning();
        return a;
    },

    async update(hotelId: number, id: number, data: Partial<{ name: string; category: string; price: number; taxable: boolean; isActive: boolean }>) {
        const updates: Record<string, unknown> = { updatedAt: new Date() };
        if (data.name !== undefined) updates.name = data.name;
        if (data.category !== undefined) updates.category = data.category;
        if (data.price !== undefined) updates.price = String(data.price);
        if (data.taxable !== undefined) updates.taxable = data.taxable;
        if (data.isActive !== undefined) updates.isActive = data.isActive;
        const [a] = await db.update(amenities)
            .set(updates)
            .where(and(eq(amenities.id, id), eq(amenities.hotelId, hotelId)))
            .returning();
        if (!a) throw new NotFoundError('Amenity');
        return a;
    },

    async remove(hotelId: number, id: number) {
        const [d] = await db.delete(amenities)
            .where(and(eq(amenities.id, id), eq(amenities.hotelId, hotelId)))
            .returning();
        if (!d) throw new NotFoundError('Amenity');
        return d;
    },

    /**
     * Post an amenity (extra charge) to a booking's folio so it appears on the
     * live bill, ledger and final invoice — reuses the standard folio charge.
     */
    async chargeToBooking(hotelId: number, userId: string, data: { bookingId: string; amenityId: number; quantity?: number; notes?: string }, ip?: string) {
        const amenity = await db.query.amenities.findFirst({
            where: and(eq(amenities.id, data.amenityId), eq(amenities.hotelId, hotelId)),
        });
        if (!amenity) throw new NotFoundError('Amenity');
        if (!amenity.isActive) throw new BusinessLogicError('Amenity is inactive');

        const qty = Math.max(1, Math.floor(data.quantity ?? 1));
        const amount = parseFloat(amenity.price) * qty;
        const description = qty > 1 ? `${amenity.name} x${qty}` : amenity.name;

        return FolioService.createCharge(hotelId, userId, {
            bookingId: data.bookingId,
            description: data.notes ? `${description} (${data.notes})` : description,
            amount,
            type: amenity.category || 'AMENITY',
        }, ip);
    },
};
