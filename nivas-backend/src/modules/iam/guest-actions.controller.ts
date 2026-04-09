import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { GuestActionsService } from './guest-actions.service';
import { createResponse } from '../../utils/response.helper';

export const guestActionsController = new Elysia({ prefix: '/guest/actions' })
    .use(authMiddleware)
    .onBeforeHandle(({ user, set }) => {
        if (!user) {
            set.status = 401;
            return { status: 'error', message: 'Unauthorized: Please login first.' };
        }
    })
    .patch('/dnd', async ({ body, user }) => {
        const { hotelId, roomId } = await GuestActionsService.validateGuestAccess(user);
        await GuestActionsService.toggleDnd(hotelId, roomId, body.enabled);
        return createResponse(null, `DND turned ${body.enabled ? 'ON' : 'OFF'}`);
    }, {
        isSignedIn: true,
        body: t.Object({ enabled: t.Boolean() }),
        detail: { summary: 'Toggle Do Not Disturb', tags: ['Guest Portal'] }
    })
    .post('/request-checkout', async ({ user }) => {
        const { hotelId, roomId } = await GuestActionsService.validateGuestAccess(user);
        await GuestActionsService.requestCheckout(hotelId, roomId);
        return createResponse(null, 'Checkout requested. Front desk has been notified.');
    }, {
        isSignedIn: true,
        detail: { summary: 'Request checkout', tags: ['Guest Portal'] }
    })
    .get('/menu', async ({ user }) => {
        const { hotelId } = await GuestActionsService.validateGuestAccess(user);
        const menu = await GuestActionsService.getMenu(hotelId);
        return createResponse(menu, 'Menu fetched successfully');
    }, {
        isSignedIn: true,
        detail: { summary: 'Get room service menu', tags: ['Guest Portal'] }
    })
    .post('/order', async ({ body, user }) => {
        const { hotelId, roomId, userId } = await GuestActionsService.validateGuestAccess(user);
        const result = await GuestActionsService.placeOrder(hotelId, roomId, userId, body.items);
        return createResponse(result, 'Order placed! Kitchen has been notified.');
    }, {
        isSignedIn: true,
        body: t.Object({
            items: t.Array(t.Object({
                menuItemId: t.Number(),
                quantity: t.Number(),
                notes: t.Optional(t.String())
            }))
        }),
        detail: { summary: 'Place room service order', tags: ['Guest Portal'] }
    })
    .get('/orders', async ({ user }) => {
        const { hotelId, roomId } = await GuestActionsService.validateGuestAccess(user);
        const orders = await GuestActionsService.getOrderHistory(hotelId, roomId);
        return createResponse(orders, 'Order history fetched successfully');
    }, {
        isSignedIn: true,
        detail: { summary: 'View order history', tags: ['Guest Portal'] }
    })
    .post('/request-housekeeping', async ({ body, user }) => {
        const { hotelId, roomId } = await GuestActionsService.validateGuestAccess(user);
        await GuestActionsService.requestHousekeeping(hotelId, roomId, body.taskType, body.notes);
        return createResponse(null, 'Housekeeping has been notified.');
    }, {
        isSignedIn: true,
        body: t.Object({
            taskType: t.Optional(t.Union([
                t.Literal('CLEANING'),
                t.Literal('TOWELS'),
                t.Literal('AMENITIES'),
                t.Literal('MAINTENANCE')
            ])),
            notes: t.Optional(t.String())
        }),
        detail: { summary: 'Request housekeeping service', tags: ['Guest Portal'] }
    });
