import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';
import { createResponse } from '../../utils/response.helper';
import { ForbiddenError } from '../../utils/errors';

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
        hasPermission: PERMISSIONS.NOTIFICATIONS.VIEW,
        detail: { summary: 'Get unread notifications', tags: ['Notifications'] }
    })
    .patch('/:id/read', async ({ params, user }) => {
        await NotificationsService.markAsRead(params.id, user!.hotelId!, user!.id, user!.role?.name || '');
        return createResponse(null, 'Notification marked as read');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.NOTIFICATIONS.MARK_READ,
        params: t.Object({ id: t.String() }),
        detail: { summary: 'Mark notification as read', tags: ['Notifications'] }
    })
    .patch('/read-all', async ({ user }) => {
        await NotificationsService.markAllRead(user!.id, user!.hotelId!, user!.role?.name || '');
        return createResponse(null, 'All notifications marked as read');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.NOTIFICATIONS.MARK_READ,
        detail: { summary: 'Mark all as read', tags: ['Notifications'] }
    })
    // Push notification token management
    .post('/push/register', async ({ user, body }) => {
        const result = await PushService.registerToken(
            user!.hotelId!,
            user!.id,
            body.expoPushToken,
            body.platform,
            body.deviceId
        );
        return createResponse(result, result.success ? 'Push token registered' : 'Invalid push token');
    }, {
        isSignedIn: true,
        body: t.Object({
            expoPushToken: t.String(),
            platform: t.Union([t.Literal('ios'), t.Literal('android')]),
            deviceId: t.Optional(t.String())
        }),
        detail: { summary: 'Register Expo push token', tags: ['Notifications'] }
    })
    .post('/push/unregister', async ({ user, body }) => {
        const result = await PushService.unregisterToken(body.expoPushToken, user!.id);
        if (!result.success) {
            throw new ForbiddenError(result.error || 'Cannot unregister this push token');
        }
        return createResponse(null, 'Push token unregistered');
    }, {
        isSignedIn: true,
        body: t.Object({ expoPushToken: t.String() }),
        detail: { summary: 'Unregister Expo push token', tags: ['Notifications'] }
    });