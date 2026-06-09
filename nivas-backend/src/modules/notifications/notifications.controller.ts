import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { NotificationsService } from './notifications.service';
import { createResponse } from '../../utils/response.helper';

export const notificationsController = new Elysia({ prefix: '/notifications' })
    .use(authMiddleware)
    .get('/', async ({ user }) => {
        const list = await NotificationsService.getUserNotifications(
            user!.id,
            user!.hotelId!,
            user!.role?.name || ''
        );
        return createResponse(list, 'Notifications fetched');
    }, {
        isSignedIn: true,
        detail: { summary: 'Get unread notifications', tags: ['Notifications'] }
    })
    .patch('/:id/read', async ({ params, user }) => {
        await NotificationsService.markAsRead(params.id, user!.hotelId!, user!.id, user!.role?.name || '');
        return createResponse(null, 'Notification marked as read');
    }, {
        isSignedIn: true,
        params: t.Object({ id: t.String() }),
        detail: { summary: 'Mark notification as read', tags: ['Notifications'] }
    })
    .patch('/read-all', async ({ user }) => {
        await NotificationsService.markAllRead(user!.id, user!.hotelId!, user!.role?.name || '');
        return createResponse(null, 'All notifications marked as read');
    }, {
        isSignedIn: true,
        detail: { summary: 'Mark all as read', tags: ['Notifications'] }
    });