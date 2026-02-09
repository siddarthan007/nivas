import { db } from '../../db';
import { notifications } from '../../db/schema';

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
        return await db.insert(notifications).values({
            hotelId: data.hotelId,
            recipientId: data.recipientId,
            targetRole: data.targetRole,
            type: data.type,
            title: data.title,
            message: data.message,
            metadata: data.metadata,
            isRead: false
        }).returning();
    }
};
