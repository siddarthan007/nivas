import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { OrdersService } from './orders.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

export const ordersController = new Elysia({ prefix: '/orders' })
    .use(authMiddleware)
    .post('/', async ({ body, user }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }

        const newOrder = await OrdersService.createOrder(user.hotelId, user.id, body);

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
            items: t.Array(t.Object({
                menuItemId: t.Number(),
                quantity: t.Number(),
                price: t.Number(),
                notes: t.Optional(t.String())
            }))
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
            status: query.status ? query.status.split(',') : undefined,
            type: query.type
        };

        const ordersList = await OrdersService.getOrders(user.hotelId, filters);

        return createResponse(ordersList, 'Orders fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ORDERS.READ,
        query: t.Object({
            status: t.Optional(t.String()),
            type: t.Optional(t.String())
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
            customerName: t.Optional(t.String()),
            roomId: t.Optional(t.Number()),
            items: t.Optional(t.Array(t.Object({
                menuItemId: t.Number(),
                quantity: t.Number(),
                price: t.Number(),
                notes: t.Optional(t.String())
            })))
        }),
        detail: {
            summary: 'Update an order',
            tags: ['Orders']
        }
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