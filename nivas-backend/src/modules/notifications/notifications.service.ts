import { db } from '../../db';
import { notifications } from '../../db/schema';
import { eq, and, desc, or, gte } from 'drizzle-orm';
import { WSService, MANAGER_ROLES } from './ws.service';
import { NotificationChannelService } from './notification-channel.service';

/** How far back read notifications stay visible in the bell (history window). */
const READ_HISTORY_MS = 48 * 60 * 60 * 1000;
/** Max rows returned to the client after de-duplication. */
const MAX_RETURNED = 50;

/**
 * Collapse rows that belong to the same underlying event. The same event is
 * persisted once per target role (and oversight roles see every role's copy),
 * so without this a single order shows up several times. Input must be
 * newest-first; the newest row for each dedupeKey is kept.
 */
function dedupeByKey<T extends { metadata: unknown; type: string; title: string }>(rows: T[]): T[] {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const row of rows) {
        const meta = (row.metadata ?? {}) as Record<string, unknown>;
        // Fall back to a content signature when no explicit dedupeKey was set.
        const key = (meta.dedupeKey as string) || `${row.type}|${row.title}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(row);
    }
    return out;
}

export class NotificationsService {
    /**
     * Notifications for a user's bell: all unread plus read items from the last
     * 48h (so the panel keeps recent history instead of going blank after the
     * user — or the act of opening — marks things read). Oversight roles see
     * every hotel notification (matching live WS delivery); others see only
     * their own. Results are de-duplicated per underlying event.
     */
    static async getUserNotifications(userId: string, hotelId: number, roleName: string) {
        const isManager = MANAGER_ROLES.includes(roleName);
        const historyCutoff = new Date(Date.now() - READ_HISTORY_MS);
        const rows = await db.query.notifications.findMany({
            where: and(
                eq(notifications.hotelId, hotelId),
                or(
                    eq(notifications.isRead, false),
                    gte(notifications.createdAt, historyCutoff)
                ),
                ...(isManager ? [] : [or(
                    eq(notifications.recipientId, userId),
                    eq(notifications.targetRole, roleName)
                )])
            ),
            orderBy: [desc(notifications.createdAt)],
            // Over-fetch so de-dup doesn't starve the visible list.
            limit: MAX_RETURNED * 3
        });
        return dedupeByKey(rows).slice(0, MAX_RETURNED);
    }

    /**
     * Mark a single notification as read
     */
    static async markAsRead(notificationId: string, hotelId: number, userId: string, roleName: string) {
        const isManager = MANAGER_ROLES.includes(roleName);
        await db.update(notifications)
            .set({ isRead: true })
            .where(and(
                eq(notifications.id, notificationId),
                eq(notifications.hotelId, hotelId),
                ...(isManager ? [] : [or(
                    eq(notifications.recipientId, userId),
                    eq(notifications.targetRole, roleName)
                )])
            ));
    }

    /**
     * Mark all notifications as read for a user
     */
    static async markAllRead(userId: string, hotelId: number, roleName: string) {
        const isManager = MANAGER_ROLES.includes(roleName);
        await db.update(notifications)
            .set({ isRead: true })
            .where(and(
                eq(notifications.hotelId, hotelId),
                eq(notifications.isRead, false),
                ...(isManager ? [] : [or(
                    eq(notifications.recipientId, userId),
                    eq(notifications.targetRole, roleName)
                )])
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
