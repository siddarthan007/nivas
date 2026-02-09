import { db } from '../../db';
import { notifications } from '../../db/schema';
import { eq, and, desc, or } from 'drizzle-orm';
import { WSService } from './ws.service';
import { NotificationChannelService } from './notification-channel.service';

export class NotificationsService {
    /**
     * Get unread notifications for a user
     */
    static async getUserNotifications(userId: string, hotelId: number, roleName: string) {
        return await db.query.notifications.findMany({
            where: and(
                eq(notifications.hotelId, hotelId),
                eq(notifications.isRead, false),
                or(
                    eq(notifications.recipientId, userId),
                    eq(notifications.targetRole, roleName)
                )
            ),
            orderBy: [desc(notifications.createdAt)],
            limit: 50
        });
    }

    /**
     * Mark a single notification as read
     */
    static async markAsRead(notificationId: string, userId: string) {
        await db.update(notifications)
            .set({ isRead: true })
            .where(eq(notifications.id, notificationId));
    }

    /**
     * Mark all notifications as read for a user
     */
    static async markAllRead(userId: string, roleName: string) {
        await db.update(notifications)
            .set({ isRead: true })
            .where(and(
                or(
                    eq(notifications.recipientId, userId),
                    eq(notifications.targetRole, roleName)
                ),
                eq(notifications.isRead, false)
            ));
    }

    /**
     * Send a notification within the system (DB + WS)
     */
    static async send(hotelId: number, type: string, payload: any, target: { userId?: string, roles?: string[] }) {
        // 1. Send via WebSocket
        if (target.userId) {
            await WSService.sendToUser(hotelId, target.userId, type, payload);
        } else if (target.roles) {
            await WSService.broadcastToRole(hotelId, target.roles, type, payload);
        }

        // Note: WSService internally calls DB persistence in the current implementation.
        // Ideally, we should decouple that, but for now we follow the existing pattern 
        // until we refactor WSService completely to be "dumb".
        // In the legacy code, WSService.broadcastToRole calls NotificationStore.create.
        // We will keep using WSService for now to maintain behavior.
    }

    /**
     * Send external notification (Email/SMS/WhatsApp)
     */
    static async sendExternal(hotelId: number, recipient: { phone: string, email?: string }, message: string, template?: string) {
        return await NotificationChannelService.send(hotelId, recipient.phone, recipient.email, message, template);
    }
}
