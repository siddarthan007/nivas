import { Elysia } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { NotificationsService } from './notifications.service';

export const notificationsController = new Elysia({ prefix: '/notifications' })
    .use(authMiddleware)
    .get('/', async ({ user }) => {
        const list = await NotificationsService.getUserNotifications(
            user!.id,
            user!.hotelId!,
            user!.role?.name || ''
        );
        return { status: 'success', data: list };
    }, {
        isSignedIn: true,
        detail: { summary: 'Get unread notifications', tags: ['Notifications'] }
    })
    .patch('/:id/read', async ({ params, user }) => {
        await NotificationsService.markAsRead(params.id, user!.id);
        return { status: 'success' };
    }, {
        isSignedIn: true,
        detail: { summary: 'Mark notification as read', tags: ['Notifications'] }
    })
    .post('/read-all', async ({ user }) => {
        await NotificationsService.markAllRead(user!.id, user!.role?.name || '');
        return { status: 'success' };
    }, {
        isSignedIn: true,
        detail: { summary: 'Mark all as read', tags: ['Notifications'] }
    });