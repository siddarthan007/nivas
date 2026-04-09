import { db } from '../../db';
import { menuCategories, menuItems } from '../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { NotFoundError } from '../../utils/errors';

export const MenuCategoryService = {
    async createCategory(hotelId: number, data: { name: string; description?: string }) {
        const [newCategory] = await db.insert(menuCategories).values({
            hotelId,
            name: data.name,
            description: data.description,
            isActive: true
        }).returning();
        return newCategory;
    },

    async getAllCategories(hotelId: number) {
        return await db.query.menuCategories.findMany({
            where: and(
                eq(menuCategories.hotelId, hotelId),
                eq(menuCategories.isActive, true)
            ),
            orderBy: (categories, { asc }) => [asc(categories.sortOrder), asc(categories.name)]
        });
    },

    async updateCategory(hotelId: number, categoryId: number, data: { name?: string; description?: string; sortOrder?: number }) {
        // First get the old category to see if name changed
        const existing = await db.query.menuCategories.findFirst({
            where: and(eq(menuCategories.id, categoryId), eq(menuCategories.hotelId, hotelId))
        });

        if (!existing) throw new NotFoundError('Menu Category');

        // Update the category
        const [updated] = await db.update(menuCategories)
            .set({
                ...data,
                updatedAt: new Date()
            })
            .where(eq(menuCategories.id, categoryId))
            .returning();

        // If name changed, we should ideally synch menu items that use this name
        // This keeps the "string-based" category in menuItems consistent
        if (data.name && data.name !== existing.name) {
            await db.update(menuItems)
                .set({ category: data.name })
                .where(and(
                    eq(menuItems.hotelId, hotelId),
                    eq(menuItems.category, existing.name)
                ));
        }

        return updated;
    },

    async deleteCategory(hotelId: number, categoryId: number) {
        // Soft delete
        const [deleted] = await db.update(menuCategories)
            .set({ isActive: false })
            .where(and(
                eq(menuCategories.id, categoryId),
                eq(menuCategories.hotelId, hotelId)
            ))
            .returning();

        if (!deleted) throw new NotFoundError('Menu Category');
        return deleted;
    }
};
