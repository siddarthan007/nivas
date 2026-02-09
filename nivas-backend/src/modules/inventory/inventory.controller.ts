import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { InventoryService } from './inventory.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

export const inventoryController = new Elysia({ prefix: '/inventory' })
    .use(authMiddleware)
    .get('/', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const items = await InventoryService.getItems(user.hotelId);
        return createResponse(items, 'Inventory items fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.READ,
        detail: {
            summary: 'Get inventory items',
            tags: ['Inventory']
        }
    })
    .post('/', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const newItem = await InventoryService.addItem(user.hotelId, body);
        return createResponse(newItem, 'Inventory item added successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.UPDATE,
        body: t.Object({
            name: t.String(),
            category: t.Optional(t.String()),
            quantity: t.Optional(t.Number()),
            currentStock: t.Optional(t.Number()),
            unit: t.Optional(t.String()),
            lowStockThreshold: t.Optional(t.Number()),
            minStock: t.Optional(t.Number()),
            reorderLevel: t.Optional(t.Number()),
            costPrice: t.Optional(t.Number()),
            supplier: t.Optional(t.String()),
        }),
        detail: {
            summary: 'Add inventory item',
            tags: ['Inventory']
        }
    })
    .post('/bulk', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const result = await InventoryService.addItemsBulk(user.hotelId, body);
        return createResponse(result, 'Bulk inventory items added successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.UPDATE,
        body: t.Array(t.Object({
            name: t.String(),
            category: t.Optional(t.String()),
            quantity: t.Number(),
            unit: t.String(),
            lowStockThreshold: t.Number()
        })),
        detail: {
            summary: 'Bulk add inventory items',
            tags: ['Inventory']
        }
    })
    .patch('/:id', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updatedItem = await InventoryService.updateStock(user.hotelId, parseInt(params.id), body);
        return createResponse(updatedItem, 'Inventory item updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.UPDATE,
        body: t.Object({
            quantity: t.Optional(t.Number()),
            lowStockThreshold: t.Optional(t.Number())
        }),
        detail: {
            summary: 'Update stock levels',
            tags: ['Inventory']
        }
    })
    .get('/:id', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const item = await InventoryService.getItemById(user.hotelId, parseInt(params.id));
        return createResponse(item, 'Inventory item fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.READ,
        detail: { summary: 'Get single inventory item', tags: ['Inventory'] }
    })
    .delete('/:id', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const deleted = await InventoryService.deleteItem(user.hotelId, parseInt(params.id));
        return createResponse(deleted, 'Inventory item deleted successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.UPDATE,
        detail: { summary: 'Delete inventory item', tags: ['Inventory'] }
    })
    .post('/requests', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const request = await InventoryService.requestStock(user.hotelId, user.id, body);
        return createResponse(request, 'Stock request submitted');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.REQUEST_STOCK,
        body: t.Object({
            itemId: t.Number(),
            quantity: t.Number(),
            notes: t.Optional(t.String())
        }),
        detail: {
            summary: 'Request stock replenishment',
            tags: ['Inventory']
        }
    })
    .get('/requests', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const requests = await InventoryService.getStockRequests(user.hotelId);
        return createResponse(requests, 'Stock requests fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.UPDATE,
        detail: {
            summary: 'View all stock requests',
            tags: ['Inventory']
        }
    })
    .patch('/requests/:id/status', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updatedRequest = await InventoryService.updateRequestStatus(user.hotelId, parseInt(params.id), body.status);
        return createResponse(updatedRequest, 'Stock request status updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.UPDATE,
        body: t.Object({
            status: t.Union([
                t.Literal('PENDING'),
                t.Literal('APPROVED'),
                t.Literal('REJECTED')
            ])
        }),
        detail: {
            summary: 'Approve or reject stock request',
            tags: ['Inventory']
        }
    });