import { db } from '../../db';
import { pushTokens, users, roles } from '../../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';
import { buildNotificationPushData } from '@nivas/shared-utils/notification-routes';
import { MANAGER_ROLES } from './notification-roles';

const expo = new Expo();

function enrichPushData(type: string | undefined, data?: Record<string, unknown>): Record<string, unknown> {
    const base = data || {};
    return buildNotificationPushData(type || String(base.type || base.notifType || ''), base);
}

export const PushService = {
    async registerToken(hotelId: number, userId: string, expoToken: string, platform: string, deviceId?: string) {
        if (!Expo.isExpoPushToken(expoToken)) {
            return { success: false, error: 'Invalid Expo push token' };
        }
        await db.insert(pushTokens).values({
            hotelId,
            userId,
            expoPushToken: expoToken,
            platform,
            deviceId,
        }).onConflictDoUpdate({
            target: pushTokens.expoPushToken,
            set: { userId, hotelId, isActive: true, updatedAt: new Date() }
        });
        return { success: true };
    },

    async unregisterToken(expoToken: string, userId?: string) {
        if (userId) {
            const row = await db.query.pushTokens.findFirst({
                where: eq(pushTokens.expoPushToken, expoToken),
            });
            if (row && row.userId !== userId) {
                return { success: false, error: 'Token does not belong to this user' };
            }
        }
        await db.update(pushTokens).set({ isActive: false }).where(eq(pushTokens.expoPushToken, expoToken));
        return { success: true };
    },

    async sendToUser(hotelId: number, userId: string, title: string, body: string, data?: Record<string, unknown>) {
        const tokens = await db.select().from(pushTokens).where(and(
            eq(pushTokens.hotelId, hotelId),
            eq(pushTokens.userId, userId),
            eq(pushTokens.isActive, true)
        ));

        if (tokens.length === 0) return { sent: 0 };

        const messages: ExpoPushMessage[] = tokens.map(t => ({
            to: t.expoPushToken,
            sound: 'default',
            title,
            body,
            data: enrichPushData(String(data?.type || data?.notifType || ''), data),
            priority: 'high',
            channelId: 'default',
        }));

        const chunks = expo.chunkPushNotifications(messages);
        const tickets: ExpoPushTicket[] = [];
        for (const chunk of chunks) {
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            } catch (err) {
                console.error('[Push] chunk failed', err);
            }
        }

        // Deactivate invalid tokens
        const invalidTokens: string[] = [];
        for (let i = 0; i < tickets.length; i++) {
            const ticket = tickets[i];
            const tokenRecord = tokens[i];
            if (!ticket || !tokenRecord) continue;
            if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
                invalidTokens.push(tokenRecord.expoPushToken);
            }
        }
        if (invalidTokens.length > 0) {
            for (const token of invalidTokens) {
                await db.update(pushTokens).set({ isActive: false }).where(eq(pushTokens.expoPushToken, token));
            }
        }

        return { sent: tickets.filter(t => t.status === 'ok').length };
    },

    async broadcastToRole(hotelId: number, roleName: string, title: string, body: string, data?: Record<string, unknown>) {
        const roleUsers = await db.select({ id: users.id }).from(users)
            .innerJoin(roles, eq(users.roleId, roles.id))
            .where(and(eq(users.hotelId, hotelId), eq(roles.name, roleName)));

        const managerUsers = await db.select({ id: users.id }).from(users)
            .innerJoin(roles, eq(users.roleId, roles.id))
            .where(and(eq(users.hotelId, hotelId), inArray(roles.name, [...MANAGER_ROLES])));

        const userIds = [...new Set([...roleUsers.map(u => u.id), ...managerUsers.map(u => u.id)])];
        if (userIds.length === 0) return { sent: 0 };

        const tokens = await db.select().from(pushTokens).where(and(
            eq(pushTokens.hotelId, hotelId),
            inArray(pushTokens.userId, userIds),
            eq(pushTokens.isActive, true)
        ));

        if (tokens.length === 0) return { sent: 0 };

        const messages: ExpoPushMessage[] = tokens.map(t => ({
            to: t.expoPushToken,
            sound: 'default',
            title,
            body,
            data: enrichPushData(String(data?.type || data?.notifType || ''), data),
            priority: 'high',
            channelId: 'default',
        }));

        const chunks = expo.chunkPushNotifications(messages);
        const tickets: ExpoPushTicket[] = [];
        for (const chunk of chunks) {
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            } catch (err) {
                console.error('[Push] broadcast chunk failed', err);
            }
        }

        const invalidTokens: string[] = [];
        for (let i = 0; i < tickets.length; i++) {
            const ticket = tickets[i];
            const tokenRecord = tokens[i];
            if (!ticket || !tokenRecord) continue;
            if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
                invalidTokens.push(tokenRecord.expoPushToken);
            }
        }
        if (invalidTokens.length > 0) {
            for (const token of invalidTokens) {
                await db.update(pushTokens).set({ isActive: false }).where(eq(pushTokens.expoPushToken, token));
            }
        }

        return { sent: tickets.filter(t => t.status === 'ok').length };
    },
};
