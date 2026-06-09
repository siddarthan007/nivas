import { Elysia, t } from 'elysia';
import { ProcurementService } from './procurement.service';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { ValidationError } from '../../utils/errors';
import { createResponse } from '../../utils/response.helper';

export const procurementController = new Elysia({ prefix: '/procurement' })
    .use(authMiddleware)
    .get('/vendors', async ({ user }) => {
        if (!user || !user.hotelId) throw new ValidationError('User must be associated with a hotel');
        return createResponse(await ProcurementService.getVendors(user.hotelId), 'Vendors fetched');
    }, { isSignedIn: true, hasPermission: PERMISSIONS.INVENTORY.MANAGE_PROCUREMENT })
    .post('/vendors', async ({ user, body }) => {
        if (!user || !user.hotelId) throw new ValidationError('User must be associated with a hotel');
        return createResponse(await ProcurementService.createVendor(user.hotelId, body), 'Vendor created');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.MANAGE_PROCUREMENT,
        body: t.Object({
            name: t.String(),
            paymentTerms: t.Optional(t.String()),
            contact: t.Optional(t.Any())
        })
    })
    .get('/purchase-orders', async ({ user }) => {
        if (!user || !user.hotelId) throw new ValidationError('User must be associated with a hotel');
        return createResponse(await ProcurementService.getPurchaseOrders(user.hotelId), 'Purchase orders fetched');
    }, { isSignedIn: true, hasPermission: PERMISSIONS.INVENTORY.MANAGE_PROCUREMENT })
    .post('/purchase-orders', async ({ user, body }) => {
        if (!user || !user.hotelId) throw new ValidationError('User must be associated with a hotel');
        return createResponse(await ProcurementService.createPurchaseOrder(user.hotelId, user.id, body), 'Purchase order created');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.MANAGE_PROCUREMENT,
        body: t.Object({
            supplierName: t.Optional(t.String()),
            vendorId: t.Optional(t.Number()),
            warehouseId: t.Optional(t.Number()),
            expectedDelivery: t.Optional(t.String()),
            notes: t.Optional(t.String()),
            items: t.Array(t.Object({
                itemId: t.Number(),
                quantity: t.Number(),
                unitCost: t.Number()
            }))
        })
    })
    .post('/purchase-orders/:id/approve', async ({ user, params: { id } }) => {
        if (!user || !user.hotelId) throw new ValidationError('User must be associated with a hotel');
        return createResponse(await ProcurementService.updateStatus(user.hotelId, parseInt(id, 10), 'APPROVED'), 'Purchase order approved');
    }, { isSignedIn: true, hasPermission: PERMISSIONS.INVENTORY.MANAGE_PROCUREMENT })
    .post('/purchase-orders/:id/reject', async ({ user, params: { id } }) => {
        if (!user || !user.hotelId) throw new ValidationError('User must be associated with a hotel');
        return createResponse(await ProcurementService.updateStatus(user.hotelId, parseInt(id, 10), 'REJECTED'), 'Purchase order rejected');
    }, { isSignedIn: true, hasPermission: PERMISSIONS.INVENTORY.MANAGE_PROCUREMENT })
    .patch('/purchase-orders/:id/receive', async ({ user, params: { id }, body }) => {
        if (!user || !user.hotelId) throw new ValidationError('User must be associated with a hotel');
        // vendor + warehouse are resolved server-side from the PO when omitted,
        // so a one-click "Receive" works without extra input.
        return createResponse(await ProcurementService.receiveGRN(user.hotelId, user.id, {
            poId: parseInt(id, 10),
            vendorId: body?.vendorId,
            warehouseId: body?.warehouseId,
            lines: body?.lines
        }), 'Goods received');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.INVENTORY.MANAGE_PROCUREMENT,
        body: t.Optional(t.Object({
            vendorId: t.Optional(t.Number()),
            warehouseId: t.Optional(t.Number()),
            lines: t.Optional(t.Array(t.Any()))
        }))
    })
    .delete('/purchase-orders/:id', async ({ user, params: { id } }) => {
        if (!user || !user.hotelId) throw new ValidationError('User must be associated with a hotel');
        return createResponse(await ProcurementService.updateStatus(user.hotelId, parseInt(id, 10), 'CANCELLED'), 'Purchase order cancelled');
    }, { isSignedIn: true, hasPermission: PERMISSIONS.INVENTORY.MANAGE_PROCUREMENT });
