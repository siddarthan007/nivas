import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { MenuService } from './menu.service';
import { MenuCategoryService } from './menu-category.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

/**
 * Menu Controller - Manage menu items and categories
 * All operations are scoped to the user's hotel
 */
export const menuController = new Elysia({ prefix: '/menu' })
    .use(authMiddleware)

    // ============================================
    // CATEGORIES (Must be before /:id)
    // ============================================

    .get('/categories', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const categories = await MenuCategoryService.getAllCategories(user.hotelId);
        return createResponse(categories, 'Categories fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.MENU.VIEW
    })

    .post('/categories', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const category = await MenuCategoryService.createCategory(user.hotelId, body);
        return createResponse(category, 'Category created successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.MENU.CREATE,
        body: t.Object({
            name: t.String(),
            description: t.Optional(t.String())
        })
    })

    .patch('/categories/:id', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const category = await MenuCategoryService.updateCategory(user.hotelId, parseInt(params.id), body);
        return createResponse(category, 'Category updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.MENU.UPDATE,
        body: t.Partial(t.Object({
            name: t.String(),
            description: t.String(),
            sortOrder: t.Number()
        }))
    })

    .delete('/categories/:id', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        await MenuCategoryService.deleteCategory(user.hotelId, parseInt(params.id));
        return createResponse(null, 'Category deleted successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.MENU.DELETE
    })

    // ============================================
    // MENU ITEMS
    // ============================================

    /**
     * Create a new menu item
     */
    .post('/', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const newItem = await MenuService.createItem(user.hotelId, body);
        return createResponse(newItem, 'Menu item created successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.MENU.CREATE,
        body: t.Object({
            name: t.String(),
            description: t.Optional(t.String()),
            price: t.Number(),
            category: t.Optional(t.String()),
            imageUrl: t.Optional(t.String()),
            preparationTime: t.Optional(t.Number()),
            isAvailable: t.Optional(t.Boolean()),
        }),
        detail: {
            summary: 'Add menu item',
            tags: ['Menu']
        }
    })
    /**
     * Bulk create menu items
     */
    .post('/bulk', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const inserted = await MenuService.createBulkItems(user.hotelId, body);
        return createResponse({ count: inserted.length, ids: inserted.map(i => i.id) }, 'Bulk items created successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.MENU.CREATE,
        body: t.Array(t.Object({
            name: t.String(),
            description: t.Optional(t.String()),
            price: t.Number(),
            category: t.Optional(t.String()),
            imageUrl: t.Optional(t.String())
        })),
        detail: {
            summary: 'Bulk add menu items',
            tags: ['Menu']
        }
    })
    /**
     * Get all menu items for the hotel
     */
    .get('/', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const menu = await MenuService.getAllItems(user.hotelId);
        return createResponse(menu, 'Menu items fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.MENU.VIEW,
        detail: {
            summary: 'Get all menu items',
            tags: ['Menu']
        }
    })
    /**
     * Update menu item - SECURITY: Ensure hotel scoping
     */
    .patch('/:id', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updated = await MenuService.updateItem(user.hotelId, parseInt(params.id), body);
        return createResponse(updated, 'Menu item updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.MENU.UPDATE,
        body: t.Partial(t.Object({
            name: t.String(),
            description: t.String(),
            price: t.Number(),
            category: t.String(),
            imageUrl: t.String(),
            isAvailable: t.Boolean()
        })),
        detail: {
            summary: 'Update menu item',
            tags: ['Menu']
        }
    })
    /**
     * Delete menu item
     */
    .delete('/:id', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        await MenuService.deleteItem(user.hotelId, parseInt(params.id));
        return createResponse(null, 'Menu item deleted successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.MENU.DELETE,
        detail: {
            summary: 'Delete menu item',
            tags: ['Menu']
        }
    });