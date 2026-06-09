import { db } from '../../db';
import { menuItems } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { NotFoundError } from '../../utils/errors';
import { StorageService } from '../storage/storage.service';

export const MenuService = {
    async createItem(hotelId: number, data: { name: string; description?: string; price: number; category?: string; imageUrl?: string; isAvailable?: boolean }) {
        const [newItem] = await db.insert(menuItems).values({
            hotelId,
            name: data.name,
            description: data.description,
            price: data.price.toString(),
            category: data.category,
            imageUrl: data.imageUrl,
            isAvailable: data.isAvailable ?? true
        }).returning();
        return newItem;
    },

    async createBulkItems(hotelId: number, items: any[]) {
        if (items.length === 0) return [];

        const itemsToInsert = items.map(item => ({
            hotelId,
            name: item.name,
            description: item.description,
            price: item.price.toString(),
            category: item.category,
            imageUrl: item.imageUrl,
            isAvailable: true
        }));

        const inserted = await db.insert(menuItems).values(itemsToInsert).returning();
        return inserted;
    },

    async getAllItems(hotelId: number) {
        return await db.query.menuItems.findMany({
            where: eq(menuItems.hotelId, hotelId)
        });
    },

    async updateItem(hotelId: number, itemId: number, data: any) {
        const allowed: Record<string, boolean> = {
            name: true, description: true, price: true,
            category: true, imageUrl: true, isAvailable: true, categoryId: true
        };
        const updateData: any = {};
        for (const key of Object.keys(data)) {
            if (allowed[key]) updateData[key] = data[key];
        }

        const [updated] = await db.update(menuItems)
            .set({
                ...updateData,
                price: updateData.price ? updateData.price.toString() : undefined,
                updatedAt: new Date()
            })
            .where(and(
                eq(menuItems.id, itemId),
                eq(menuItems.hotelId, hotelId)
            ))
            .returning();

        if (!updated) throw new NotFoundError('Menu item');
        return updated;
    },

    async deleteItem(hotelId: number, itemId: number) {
        const [deleted] = await db.delete(menuItems)
            .where(and(
                eq(menuItems.id, itemId),
                eq(menuItems.hotelId, hotelId)
            ))
            .returning();

        if (!deleted) throw new NotFoundError('Menu item');
        // Hard-deleted → remove its image from object storage (best-effort).
        await StorageService.deleteByUrl(deleted.imageUrl);
        return deleted;
    }
};
