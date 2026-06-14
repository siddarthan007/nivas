import { Elysia, t } from 'elysia';
import { s } from '../../lib/schema';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { OrdersService } from './orders.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';
import { requirePassword } from '../../utils/password.guard';

export const ordersController = new Elysia({ prefix: '/orders' })
    .use(authMiddleware)
    .post('/', async ({ body, user }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }

        const newOrder = await OrdersService.createOrder(user.hotelId, user.id, body);
        if (!newOrder) throw new ValidationError('Failed to create order');

        return createResponse(newOrder, `Order ${newOrder.orderNumber} created successfully`);
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ORDERS.CREATE,
        body: t.Object({
            roomId: t.Optional(t.Number()),
            customerName: t.Optional(t.String()),
            orderType: t.String(),
            bookingId: t.Optional(t.String()),
            guestId: t.Optional(t.String()),
            restaurantTableId: t.Optional(t.Number()),
            outletId: t.Optional(t.Number()),
            applyVat: t.Optional(t.Boolean()),
            applyServiceCharge: t.Optional(t.Boolean()),
            discountAmount: t.Optional(t.Number()),
            couponId: t.Optional(t.Number()),
            applyLoyalty: t.Optional(t.Boolean()),
            paymentMethod: t.Optional(t.String()),
            cashTendered: t.Optional(t.Number()),
            transactionId: t.Optional(t.String()),
            items: t.Array(t.Object({
                menuItemId: t.Number(),
                quantity: t.Number({ minimum: 1 }),
                price: t.Number(),
                notes: t.Optional(t.String())
            }), { minItems: 1 })
        }),
        detail: {
            summary: 'Create a new order',
            tags: ['Orders']
        }
    })
    .get('/', async ({ user, query }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }

        const filters = {
            status: query.status ? (Array.isArray(query.status) ? query.status : typeof query.status === 'string' ? query.status.split(',') : [query.status]) : undefined,
            type: query.type,
            search: query.search,
        };

        const ordersList = await OrdersService.getOrders(user.hotelId, filters);

        return createResponse(ordersList, 'Orders fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ORDERS.READ,
        query: t.Object({
            status: t.Optional(t.String()),
            type: t.Optional(t.String()),
            search: t.Optional(t.String()),
        }),
        detail: {
            summary: 'Get all orders',
            tags: ['Orders']
        }
    })
    .get('/:id', async ({ params, user }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }

        const order = await OrdersService.getOrderById(user.hotelId, params.id);
        return createResponse(order, 'Order fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ORDERS.READ,
        detail: {
            summary: 'Get a single order by ID',
            tags: ['Orders']
        }
    })
    .patch('/:id', async ({ params, body, user }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }

        const updated = await OrdersService.updateOrder(user.hotelId, user.id, params.id, body);
        return createResponse(updated, 'Order updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ORDERS.UPDATE_STATUS,
        body: t.Object({
            orderType: t.Optional(t.String()),
            customerName: t.Optional(t.String()),
            roomId: t.Optional(t.Number()),
            bookingId: t.Optional(t.String()),
            guestId: t.Optional(t.String()),
            restaurantTableId: t.Optional(t.Number()),
            items: t.Optional(t.Array(t.Object({
                menuItemId: t.Number(),
                quantity: t.Number(),
                price: t.Number(),
                notes: t.Optional(t.String())
            }))),
            addToGuestBill: t.Optional(t.Boolean()),
            applyVat: t.Optional(t.Boolean()),
            applyServiceCharge: t.Optional(t.Boolean()),
            discountAmount: t.Optional(t.Number()),
            couponId: t.Optional(t.Number()),
            paymentMethod: t.Optional(t.String()),
            cashTendered: t.Optional(t.Number()),
            transactionId: t.Optional(t.String()),
            status: t.Optional(t.String())
        }),
        detail: {
            summary: 'Update an order',
            tags: ['Orders']
        }
    })
    .post('/:id/pos-checkout', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updated = await OrdersService.completePosCheckout(user.hotelId, user.id, params.id, body);
        return createResponse(updated, 'POS checkout completed');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ORDERS.UPDATE_STATUS,
        body: t.Object({
            itemsToAdd: t.Optional(t.Array(t.Object({
                menuItemId: t.Number(),
                quantity: t.Number({ minimum: 1 }),
                price: t.Number(),
                notes: t.Optional(t.String()),
            }))),
            applyVat: t.Optional(t.Boolean()),
            applyServiceCharge: t.Optional(t.Boolean()),
            couponId: t.Optional(t.Number()),
            paymentMethod: t.Optional(t.String()),
            transactionId: t.Optional(t.String()),
            cashTendered: t.Optional(t.Number()),
            status: t.Optional(t.String()),
            addToGuestBill: t.Optional(t.Boolean()),
            roomId: t.Optional(t.Number()),
            bookingId: t.Optional(t.String()),
            guestId: t.Optional(t.String()),
        }),
        detail: { summary: 'Composite POS checkout (add items + bill + pay)', tags: ['Orders'] },
    })
    .post('/:id/cancel', async ({ params, body, user }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }

        const cancelled = await OrdersService.cancelOrder(user.hotelId, user.id, params.id, body.reason);
        return createResponse(cancelled, 'Order cancelled successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ORDERS.CANCEL,
        body: t.Object({
            reason: t.Optional(t.String())
        }),
        detail: {
            summary: 'Cancel an order',
            tags: ['Orders']
        }
    })
    .post('/:id/items', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const result = await OrdersService.addItemsToOrder(user.hotelId, user.id, params.id, body.items);
        return createResponse(result, 'Items added to order');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ORDERS.UPDATE_STATUS,
        body: t.Object({
            items: t.Array(t.Object({
                menuItemId: t.Number(),
                quantity: t.Number({ minimum: 1 }),
                price: t.Number(),
                notes: t.Optional(t.String())
            }), { minItems: 1 })
        }),
        detail: { summary: 'Add items to an existing open order', tags: ['Orders'] }
    })
    .put('/:id/items', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const result = await OrdersService.syncOrderItems(user.hotelId, user.id, params.id, body.items);
        return createResponse(result, 'Order items synced');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ORDERS.UPDATE_STATUS,
        body: t.Object({
            items: t.Array(t.Object({
                menuItemId: t.Number(),
                quantity: t.Number({ minimum: 1 }),
                price: t.Number(),
                notes: t.Optional(t.String())
            }))
        }),
        detail: { summary: 'Replace all items on an open order (POS sync)', tags: ['Orders'] }
    })
    .patch('/:id/items/:itemId', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updated = await OrdersService.updateOrderItem(user.hotelId, user.id, params.id, parseInt(params.itemId), body);
        return createResponse(updated, 'Item updated');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ORDERS.UPDATE_STATUS,
        body: t.Object({
            quantity: t.Optional(t.Number({ minimum: 1 })),
            notes: t.Optional(t.String()),
            status: t.Optional(t.String())
        }),
        detail: { summary: 'Update an order item quantity, notes or status', tags: ['Orders'] }
    })
    .post('/:id/items/:itemId/void', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updated = await OrdersService.voidOrderItem(user.hotelId, user.id, params.id, parseInt(params.itemId), body.reason);
        return createResponse(updated, 'Item voided');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ORDERS.CANCEL,
        body: t.Object({ reason: t.Optional(t.String()) }),
        detail: { summary: 'Void a single line item from an order', tags: ['Orders'] }
    })
    .patch('/:id/table', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updated = await OrdersService.changeTable(user.hotelId, user.id, params.id, body.tableId);
        return createResponse(updated, 'Order moved to new table');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ORDERS.UPDATE_STATUS,
        body: t.Object({ tableId: t.Number() }),
        detail: { summary: 'Move an open order to another table', tags: ['Orders'] }
    })
    .post('/:id/merge', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const merged = await OrdersService.mergeOrders(user.hotelId, user.id, params.id, body.sourceOrderIds);
        return createResponse(merged, 'Orders merged');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ORDERS.UPDATE_STATUS,
        body: t.Object({ sourceOrderIds: t.Array(t.String(), { minItems: 1 }) }),
        detail: { summary: 'Merge open orders into this order', tags: ['Orders'] }
    })
    .post('/:id/comp', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        await requirePassword(user.id, body.confirmPassword);
        const comped = await OrdersService.compOrder(user.hotelId, user.id, params.id, body.reason);
        return createResponse(comped, 'Order made complimentary');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.GENERATE_INVOICE, // comp = waiving revenue
        body: t.Object({ reason: t.Optional(s.string({ maxLength: 300 })), confirmPassword: t.String() }),
        detail: { summary: 'Make an order complimentary (comp)', tags: ['Orders'] }
    })
    .patch('/:id/status', async ({ params, body, user }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }

        const updatedOrder = await OrdersService.updateStatus(user.hotelId, user.id, params.id, body.status);

        return createResponse(updatedOrder, 'Order status updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ORDERS.UPDATE_STATUS,
        body: t.Object({
            status: t.Union([
                t.Literal('PENDING'),
                t.Literal('CONFIRMED'),
                t.Literal('PREPARING'),
                t.Literal('READY'),
                t.Literal('SERVED'),
                t.Literal('CANCELLED')
            ])
        }),
        detail: {
            summary: 'Update order status',
            tags: ['Orders']
        }
    });