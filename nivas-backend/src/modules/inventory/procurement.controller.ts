import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { InventoryService } from './inventory.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

export const procurementController = new Elysia({ prefix: '/procurement' })
    .use(authMiddleware)
    .get('/purchase-orders', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const pos = await InventoryService.getPurchaseOrders(user.hotelId);
        return createResponse(pos, 'Purchase orders fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.READ,
        detail: { summary: 'List all purchase orders', tags: ['Inventory'] }
    })
    .get('/purchase-orders/:id', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const po = await InventoryService.getPurchaseOrderById(user.hotelId, parseInt(params.id));
        return createResponse(po, 'Purchase order fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.READ,
        detail: { summary: 'Get a single purchase order', tags: ['Inventory'] }
    })
    .post('/purchase-orders', async ({ body, user, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const newPO = await InventoryService.createPurchaseOrder(
            user.hotelId,
            user.id,
            body,
            request.headers.get('x-forwarded-for') || undefined
        );
        return createResponse(newPO, 'Purchase Order created successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.MANAGE_PROCUREMENT,
        body: t.Object({
            supplierName: t.String(),
            items: t.Array(t.Object({
                itemId: t.Number(),
                quantity: t.Number(),
                unitCost: t.Number()
            })),
            notes: t.Optional(t.String())
        }),
        detail: { summary: 'Create Purchase Order', tags: ['Inventory'] }
    })
    .patch('/purchase-orders/:id', async ({ params, body, user, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updated = await InventoryService.updatePurchaseOrder(
            user.hotelId, user.id, parseInt(params.id), body,
            request.headers.get('x-forwarded-for') || undefined
        );
        return createResponse(updated, 'Purchase order updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.MANAGE_PROCUREMENT,
        body: t.Object({
            supplierName: t.Optional(t.String()),
            items: t.Optional(t.Array(t.Object({
                itemId: t.Number(),
                quantity: t.Number(),
                unitCost: t.Number()
            }))),
            notes: t.Optional(t.String())
        }),
        detail: { summary: 'Update a purchase order', tags: ['Inventory'] }
    })
    .delete('/purchase-orders/:id', async ({ params, user, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const cancelled = await InventoryService.cancelPurchaseOrder(
            user.hotelId, user.id, parseInt(params.id),
            request.headers.get('x-forwarded-for') || undefined
        );
        return createResponse(cancelled, 'Purchase order cancelled successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.MANAGE_PROCUREMENT,
        detail: { summary: 'Cancel a purchase order', tags: ['Inventory'] }
    })
    .post('/purchase-orders/:id/approve', async ({ params, user, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const approved = await InventoryService.approvePurchaseOrder(
            user.hotelId, user.id, parseInt(params.id),
            request.headers.get('x-forwarded-for') || undefined
        );
        return createResponse(approved, 'Purchase order approved successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.MANAGE_PROCUREMENT,
        detail: { summary: 'Approve a purchase order', tags: ['Inventory'] }
    })
    .post('/purchase-orders/:id/reject', async ({ params, body, user, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const rejected = await InventoryService.rejectPurchaseOrder(
            user.hotelId, user.id, parseInt(params.id), body.reason,
            request.headers.get('x-forwarded-for') || undefined
        );
        return createResponse(rejected, 'Purchase order rejected');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.MANAGE_PROCUREMENT,
        body: t.Object({
            reason: t.Optional(t.String())
        }),
        detail: { summary: 'Reject a purchase order', tags: ['Inventory'] }
    })
    .patch('/purchase-orders/:id/receive', async ({ params, user, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const result = await InventoryService.receivePurchaseOrder(
            user.hotelId,
            user.id,
            parseInt(params.id),
            request.headers.get('x-forwarded-for') || undefined
        );
        return createResponse(result, result.message);
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.MANAGE_PROCUREMENT,
        detail: { summary: 'Receive PO items', tags: ['Inventory'] }
    });
