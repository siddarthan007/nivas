import { db } from '../../db';
import { notifications } from '../../db/schema';
import { WSService, MANAGER_ROLES } from './ws.service';

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

        // Push live so it appears in the bell immediately for connected clients.
        const row = rows[0];
        if (row) {
            WSService.pushNotificationRecord(data.hotelId, row, client =>
                (!!data.recipientId && client.userId === data.recipientId) ||
                (!!data.targetRole && client.role === data.targetRole) ||
                MANAGER_ROLES.includes(client.role)
            );
        }

        return rows;
    }
};
