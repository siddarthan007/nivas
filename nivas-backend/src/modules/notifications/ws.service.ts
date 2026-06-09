import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { db } from '../../db';
import { users, notifications } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { config } from '../../config/env';
import { getRedis } from '../../shared/redis';
import { NotificationsService } from './notifications.service';

interface WsClient {
    ws: any;
    userId: string;
    hotelId: number;
    role: string;
    permissions?: string[];
}

/**
 * Roles that should receive every hotel notification (oversight roles).
 * Kept in one place so WS delivery and the REST query stay in sync.
 */
export const MANAGER_ROLES = ['Owner', 'Manager', 'General Manager'];

const connectedClients = new Map<number, Set<WsClient>>();

const addClient = (hotelId: number, client: WsClient) => {
    if (!connectedClients.has(hotelId)) {
        connectedClients.set(hotelId, new Set());
    }
    connectedClients.get(hotelId)?.add(client);

};

const removeClient = (hotelId: number, client: WsClient) => {
    const hotelClients = connectedClients.get(hotelId);
    if (hotelClients) {
        hotelClients.delete(client);
        if (hotelClients.size === 0) {
            connectedClients.delete(hotelId);
        }
    }
};

// ── Multi-replica fan-out ────────────────────────────────────
// WS clients are pinned to one replica. To deliver an event to clients on
// OTHER replicas, publish it to Redis; every replica subscribes and delivers
// to its own local sockets. Falls back to local-only when Redis is down, so a
// single-node deployment keeps working unchanged.
const WS_FANOUT_CHANNEL = 'ws:fanout';

function deliverLocal(hotelId: number, message: string, userId?: string) {
    const clients = connectedClients.get(hotelId);
    if (!clients) return;
    clients.forEach(client => {
        if (userId && client.userId !== userId) return;
        try { client.ws.send(message); } catch { /* dropped socket */ }
    });
}

function fanout(hotelId: number, message: string, userId?: string) {
    const redis = getRedis();
    if (redis && redis.status === 'ready') {
        // Publisher also receives its own message via the subscription below,
        // so don't deliver locally here (avoids double-send).
        redis.publish(WS_FANOUT_CHANNEL, JSON.stringify({ hotelId, message, userId }))
            .catch(() => deliverLocal(hotelId, message, userId));
    } else {
        deliverLocal(hotelId, message, userId);
    }
}

let fanoutSubscribed = false;
export function initWsFanout() {
    if (fanoutSubscribed) return;
    const redis = getRedis();
    if (!redis) return;
    const sub = redis.duplicate();
    sub.on('error', () => { /* primary delivery path still works */ });
    sub.on('message', (_channel, raw) => {
        try {
            const { hotelId, message, userId } = JSON.parse(raw);
            deliverLocal(hotelId, message, userId);
        } catch { /* ignore malformed */ }
    });
    sub.subscribe(WS_FANOUT_CHANNEL).then(() => { fanoutSubscribed = true; }).catch(() => {});
}

/**
 * Push a persisted notification record to matching connected clients.
 * All bell notifications travel under a single `NOTIFICATION` envelope so the
 * frontend can reliably distinguish them from transient live-data events
 * (KITCHEN_NEW_ORDER, BOOKING_CONFIRMED, ...).
 */
function pushNotificationRecord(hotelId: number, record: any, matches: (client: WsClient) => boolean) {
    const clients = connectedClients.get(hotelId);
    if (!clients) return;
    const message = JSON.stringify({
        type: 'NOTIFICATION',
        data: { ...record, notifType: record.type },
        timestamp: new Date(),
    });
    clients.forEach(client => {
        if (matches(client)) {
            try {
                client.ws.send(message);
            } catch (e) {
                console.error('Failed to push notification', e);
            }
        }
    });
}

export const WSService = {
    /**
     * Transient hotel-wide live event (NOT a bell notification).
     * Used purely to trigger client-side cache invalidation / live refresh.
     */
    broadcastToHotel: (hotelId: number, type: string, payload: any) => {
        const message = JSON.stringify({ type, data: payload, timestamp: new Date() });
        fanout(hotelId, message); // delivers to this replica + all others
    },

    /**
     * Persist a bell notification (one row per target role) and push it live.
     * Oversight roles (MANAGER_ROLES) always receive it.
     */
    broadcastToRole: async (hotelId: number, targetRoles: string[], type: string, payload: any) => {
        if (!targetRoles || targetRoles.length === 0) return [];
        const dedupeKey = payload.dedupeKey || `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const enriched = { ...payload, dedupeKey };
        const rows = await db.insert(notifications).values(
            targetRoles.map(role => ({
                hotelId,
                targetRole: role,
                type,
                title: payload.title || 'New Alert',
                message: payload.message || 'You have a new notification',
                metadata: enriched,
            }))
        ).returning();

        // Deliver to each connected client the record matching their own role
        // so the live toast and the persisted bell entry share the same id.
        const byRole = new Map(rows.map(r => [r.targetRole as string, r]));
        const clients = connectedClients.get(hotelId);
        if (clients) {
            clients.forEach(client => {
                let rec = byRole.get(client.role);
                if (!rec && MANAGER_ROLES.includes(client.role)) rec = rows[0];
                if (rec) {
                    try {
                        client.ws.send(JSON.stringify({
                            type: 'NOTIFICATION',
                            data: { ...rec, notifType: type },
                            timestamp: new Date(),
                        }));
                    } catch (e) {
                        console.error('Failed to send to client', e);
                    }
                }
            });
        }

        return rows;
    },

    broadcastSystemAlert: (hotelId: number, message: string, severity: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO') => {
        const clients = connectedClients.get(hotelId);
        if (clients) {
            const payload = JSON.stringify({
                type: 'SYSTEM_ALERT',
                data: { message, severity },
                timestamp: new Date()
            });
            clients.forEach(client => {
                try {
                    client.ws.send(payload);
                } catch (e) {
                    // Fail silently for system broadcasts
                }
            });
        }
    },

    /**
     * Persist a bell notification for a single user and push it live.
     */
    sendToUser: async (hotelId: number, userId: string, type: string, payload: any) => {
        const dedupeKey = payload.dedupeKey || `${type}-${userId}-${Date.now()}`;
        const [row] = await db.insert(notifications).values({
            hotelId,
            recipientId: userId,
            type,
            title: payload.title || 'New Message',
            message: payload.message || '',
            metadata: { ...payload, dedupeKey },
        }).returning();

        // Fan out across replicas (the user may be connected to another node).
        const message = JSON.stringify({
            type: 'NOTIFICATION',
            data: { ...row, notifType: type },
            timestamp: new Date(),
        });
        fanout(hotelId, message, userId);
        return row;
    },

    /**
     * Push an already-persisted notification record (used by stores that insert
     * the row themselves, e.g. license notifications) so they appear live too.
     */
    pushNotificationRecord,

    getConnectedCount: (hotelId: number): number => {
        return connectedClients.get(hotelId)?.size || 0;
    }
};

// Single source of truth for the JWT secret (validated in config/env, and the
// production guard rejects the dev default). Avoids a weak/forgeable fallback
// and keeps WS auth in sync with the rest of the app.
const JWT_SECRET = config.jwt.secret;

const jwtConfig = jwt({
    name: 'jwt',
    secret: JWT_SECRET
});

function base64UrlDecode(str: string): string {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    return atob(padded);
}

async function verifyJwtManual(token: string, secret: string): Promise<any | null> {
    try {
        const [headerB64, payloadB64, signatureB64] = token.split('.');
        if (!headerB64 || !payloadB64 || !signatureB64) return null;

        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
        );

        const data = encoder.encode(`${headerB64}.${payloadB64}`);
        const signature = Uint8Array.from(
            base64UrlDecode(signatureB64),
            c => c.charCodeAt(0)
        );

        const valid = await crypto.subtle.verify('HMAC', key, signature, data);
        if (!valid) return null;

        const payload = JSON.parse(base64UrlDecode(payloadB64));
        // Reject expired tokens (the manual path previously accepted any
        // signature-valid token, so an expired / logged-out token still connected).
        if (payload?.exp && Date.now() >= payload.exp * 1000) return null;
        return payload;
    } catch {
        return null;
    }
}

export const wsController = new Elysia({ prefix: '/ws' })
    .use(jwtConfig)
    .ws('/notifications', {
        query: t.Object({
            token: t.String()
        }),
        async open(ws) {
            const token = ws.data.query.token;

            if (!token) {
                ws.send(JSON.stringify({ type: 'ERROR', message: 'Token required' }));
                ws.close();
                return;
            }

            let profile: any = null;

            try {
                // Try Elysia JWT decorator first
                const jwtInstance = (ws.data as any).jwt;
                if (jwtInstance && typeof jwtInstance.verify === 'function') {
                    profile = await jwtInstance.verify(token);
                }
            } catch {
                // Elysia decorator failed, fall through to manual
            }

            // Fallback: manual Web Crypto verification
            if (!profile) {
                profile = await verifyJwtManual(token, JWT_SECRET);
            }

            if (!profile || !profile.id) {
                ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid or expired token' }));
                ws.close();
                return;
            }

            try {
                const user = await db.query.users.findFirst({
                    where: eq(users.id, profile.id as string),
                    with: { role: true }
                });

                if (!user || !user.hotelId) {
                    ws.send(JSON.stringify({ type: 'ERROR', message: 'User not found' }));
                    ws.close();
                    return;
                }

                const client: WsClient = {
                    ws,
                    userId: user.id,
                    hotelId: user.hotelId,
                    role: user.role?.name || 'Staff'
                };

                (ws as any)._client = client;

                addClient(user.hotelId, client);

                // Reuse the REST query so the initial WS payload and the bell's
                // fetch stay identical (de-duped, with read history).
                const latestNotifications = await NotificationsService.getUserNotifications(
                    user.id, user.hotelId, client.role
                );
                const unreadCount = latestNotifications.filter(n => !n.isRead).length;

                ws.send(JSON.stringify({
                    type: 'CONNECTED',
                    message: 'Real-time stream active',
                    userId: user.id,
                    role: client.role,
                    unreadCount,
                    latestNotifications
                }));
            } catch (error) {
                console.error('WebSocket auth error:', error);
                ws.send(JSON.stringify({ type: 'ERROR', message: 'Authentication failed' }));
                ws.close();
            }
        },

        message(ws, message) {
            if (message === 'ping') {
                ws.send('pong');
            }
        },

        close(ws) {
            const client = (ws as any)._client as WsClient | undefined;
            if (client) {
                removeClient(client.hotelId, client);

            }
        }
    });
