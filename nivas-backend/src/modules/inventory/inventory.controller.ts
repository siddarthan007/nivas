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
        detail: { summary: 'Get inventory items', tags: ['Inventory'] }
    })
    .get('/low-stock', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const items = await InventoryService.getLowStockItems(user.hotelId);
        return createResponse(items, 'Low stock items fetched');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.READ,
        detail: { summary: 'Get low stock alerts', tags: ['Inventory'] }
    })
    .post('/', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const newItem = await InventoryService.addItem(user.hotelId, body, user.id);
        return createResponse(newItem, 'Inventory item added successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.UPDATE,
        body: t.Object({
            sku: t.Optional(t.String()),
            barcode: t.Optional(t.String()),
            name: t.String(),
            description: t.Optional(t.String()),
            category: t.Optional(t.String()),
            quantity: t.Optional(t.Number()),
            currentStock: t.Optional(t.Number()),
            unit: t.Optional(t.String()),
            unitCost: t.Optional(t.Number()),
            lowStockThreshold: t.Optional(t.Number()),
            minStock: t.Optional(t.Number()),
            reorderLevel: t.Optional(t.Number()),
            status: t.Optional(t.String()),
            warehouseId: t.Optional(t.Number()),
            supplierId: t.Optional(t.Number()),
        }),
        detail: { summary: 'Add inventory item', tags: ['Inventory'] }
    })
    .post('/bulk', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const result = await InventoryService.addItemsBulk(user.hotelId, body);
        return createResponse(result, 'Bulk inventory items added successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.UPDATE,
        body: t.Array(t.Object({
            sku: t.Optional(t.String()),
            barcode: t.Optional(t.String()),
            name: t.String(),
            description: t.Optional(t.String()),
            category: t.Optional(t.String()),
            quantity: t.Number(),
            unit: t.String(),
            lowStockThreshold: t.Number()
        })),
        detail: { summary: 'Bulk add inventory items', tags: ['Inventory'] }
    })
    .patch('/:id', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updatedItem = await InventoryService.updateItem(user.hotelId, parseInt(params.id), body, user.id);
        return createResponse(updatedItem, 'Inventory item updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.UPDATE,
        body: t.Object({
            sku: t.Optional(t.String()),
            barcode: t.Optional(t.String()),
            name: t.Optional(t.String()),
            description: t.Optional(t.String()),
            category: t.Optional(t.String()),
            unit: t.Optional(t.String()),
            unitCost: t.Optional(t.Number()),
            lowStockThreshold: t.Optional(t.Number()),
            quantity: t.Optional(t.Number()),
            currentStock: t.Optional(t.Number()),
            status: t.Optional(t.String()),
            warehouseId: t.Optional(t.Number()),
            supplierId: t.Optional(t.Number()),
        }),
        detail: { summary: 'Update inventory item details or stock', tags: ['Inventory'] }
    })
    .post('/:id/adjust-stock', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updated = await InventoryService.adjustStock(user.hotelId, parseInt(params.id), body, user.id);
        return createResponse(updated, 'Stock adjusted successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.UPDATE,
        body: t.Object({
            adjustment: t.Number(),
            reason: t.String(),
            reference: t.Optional(t.String()),
        }),
        detail: { summary: 'Adjust stock with movement tracking', tags: ['Inventory'] }
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
    .get('/movements/list', async ({ user, query }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const movements = await InventoryService.getStockMovements(user.hotelId, query.itemId ? Number(query.itemId) : undefined);
        return createResponse(movements, 'Stock movements fetched');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.READ,
        query: t.Object({
            itemId: t.Optional(t.String()),
        }),
        detail: { summary: 'Get stock movements', tags: ['Inventory'] }
    })
    .get('/warehouses/list', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const list = await InventoryService.getWarehouses(user.hotelId);
        return createResponse(list, 'Warehouses fetched');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.READ,
        detail: { summary: 'List warehouses', tags: ['Inventory'] }
    })
    .get('/vendors/list', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const list = await InventoryService.getVendors(user.hotelId);
        return createResponse(list, 'Vendors fetched');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.READ,
        detail: { summary: 'List vendors/suppliers', tags: ['Inventory'] }
    })
    .post('/warehouses', async ({ user, body }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const wh = await InventoryService.createWarehouse(user.hotelId, body);
        return createResponse(wh, 'Warehouse created');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.UPDATE,
        body: t.Object({ name: t.String(), location: t.Optional(t.String()) }),
        detail: { summary: 'Create warehouse', tags: ['Inventory'] }
    })
    .patch('/warehouses/:id', async ({ user, params, body }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const wh = await InventoryService.updateWarehouse(user.hotelId, parseInt(params.id), body);
        return createResponse(wh, 'Warehouse updated');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.UPDATE,
        body: t.Object({ name: t.Optional(t.String()), location: t.Optional(t.String()), isActive: t.Optional(t.Boolean()) }),
        detail: { summary: 'Update warehouse', tags: ['Inventory'] }
    })
    .delete('/warehouses/:id', async ({ user, params }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const wh = await InventoryService.deleteWarehouse(user.hotelId, parseInt(params.id));
        return createResponse(wh, 'Warehouse deleted');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.UPDATE,
        detail: { summary: 'Delete warehouse', tags: ['Inventory'] }
    })
    .get('/warehouses/:id/finance', async ({ user, params }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const data = await InventoryService.getWarehouseFinance(user.hotelId, parseInt(params.id));
        return createResponse(data, 'Warehouse finance fetched');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.READ,
        detail: { summary: 'Get warehouse finance summary', tags: ['Inventory'] }
    })
    .post('/vendors', async ({ user, body }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const v = await InventoryService.createVendor(user.hotelId, body);
        return createResponse(v, 'Vendor created');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.UPDATE,
        body: t.Object({ name: t.String(), contactPerson: t.Optional(t.String()), email: t.Optional(t.String()), phone: t.Optional(t.String()), address: t.Optional(t.String()), taxNumber: t.Optional(t.String()) }),
        detail: { summary: 'Create vendor/supplier', tags: ['Inventory'] }
    })
    .patch('/vendors/:id', async ({ user, params, body }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const v = await InventoryService.updateVendor(user.hotelId, parseInt(params.id), body);
        return createResponse(v, 'Vendor updated');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.UPDATE,
        body: t.Object({ name: t.Optional(t.String()), contactPerson: t.Optional(t.String()), email: t.Optional(t.String()), phone: t.Optional(t.String()), address: t.Optional(t.String()), taxNumber: t.Optional(t.String()), isActive: t.Optional(t.Boolean()) }),
        detail: { summary: 'Update vendor', tags: ['Inventory'] }
    })
    .delete('/vendors/:id', async ({ user, params }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const v = await InventoryService.deleteVendor(user.hotelId, parseInt(params.id));
        return createResponse(v, 'Vendor deleted');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.UPDATE,
        detail: { summary: 'Delete vendor', tags: ['Inventory'] }
    })
    .get('/vendors/:id/finance', async ({ user, params }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const data = await InventoryService.getVendorFinance(user.hotelId, parseInt(params.id));
        return createResponse(data, 'Vendor finance fetched');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.READ,
        detail: { summary: 'Get vendor finance summary', tags: ['Inventory'] }
    })
    .get('/ap-aging', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        return createResponse(await InventoryService.getApAging(user.hotelId), 'AP aging');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.READ,
        detail: { summary: 'Accounts payable aging by supplier', tags: ['Inventory'] }
    })
    .post('/vendors/:id/pay', async ({ user, params, body }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const vp = await InventoryService.recordVendorPayment(user.hotelId, user.id, parseInt(params.id), body);
        return createResponse(vp, 'Supplier payment recorded');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.MANAGE_PROCUREMENT,
        body: t.Object({
            amount: t.Number({ minimum: 0.01 }),
            paymentMethod: t.Optional(t.String()),
            reference: t.Optional(t.String()),
            notes: t.Optional(t.String()),
        }),
        detail: { summary: 'Record a payment to a supplier', tags: ['Inventory'] }
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
        detail: { summary: 'Request stock replenishment', tags: ['Inventory'] }
    })
    .get('/requests', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const requests = await InventoryService.getStockRequests(user.hotelId);
        return createResponse(requests, 'Stock requests fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.UPDATE,
        detail: { summary: 'View all stock requests', tags: ['Inventory'] }
    })
    .patch('/requests/:id/status', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updatedRequest = await InventoryService.updateRequestStatus(user.hotelId, parseInt(params.id), body.status, user.id);
        return createResponse(updatedRequest, 'Stock request status updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.UPDATE,
        body: t.Object({
            status: t.Union([t.Literal('PENDING'), t.Literal('APPROVED'), t.Literal('REJECTED')])
        }),
        detail: { summary: 'Approve or reject stock request', tags: ['Inventory'] }
    });