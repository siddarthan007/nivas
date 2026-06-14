import { db } from '../../db';
import { notifications } from '../../db/schema';
import { WSService } from './ws.service';
import { isManagerRole } from './notification-roles';
import { PushService } from './push.service';

export const NotificationStore = {
    async create(data: {
        hotelId: number;
        recipientId?: string;
        targetRole?: string;
        type: string;
        title: string;
        message: string;
        metadata?: any;
    }) {
        const rows = await db.insert(notifications).values({
            hotelId: data.hotelId,
            recipientId: data.recipientId,
            targetRole: data.targetRole,
            type: data.type,
            title: data.title,
            message: data.message,
            metadata: data.metadata,
            isRead: false
        }).returning();

        const row = rows[0];
        if (row) {
            WSService.pushNotificationRecord(data.hotelId, row, client =>
                (!!data.recipientId && client.userId === data.recipientId) ||
                (!!data.targetRole && client.role === data.targetRole) ||
                isManagerRole(client.role)
            );

            if (data.recipientId) {
                PushService.sendToUser(
                    data.hotelId,
                    data.recipientId,
                    data.title,
                    data.message,
                    { ...(data.metadata || {}), type: data.type },
                ).catch(() => { /* best-effort */ });
            } else if (data.targetRole) {
                PushService.broadcastToRole(
                    data.hotelId,
                    data.targetRole,
                    data.title,
                    data.message,
                    { ...(data.metadata || {}), type: data.type },
                ).catch(() => { /* best-effort */ });
            }
        }

        return rows;
    }
};
