import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { db } from '../../db';
import { users, notifications } from '../../db/schema';
import { eq, and, desc, or } from 'drizzle-orm';

interface WsClient {
    ws: any;
    userId: string;
    hotelId: number;
    role: string;
    permissions?: string[];
}

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

export const WSService = {
    broadcastToHotel: (hotelId: number, type: string, payload: any) => {
        const clients = connectedClients.get(hotelId);
        if (clients) {
            const message = JSON.stringify({ type, data: payload, timestamp: new Date() });
            clients.forEach(client => {
                try {
                    client.ws.send(message);
                } catch (e) {
                    console.error('Failed to send to client', e);
                }
            });
        }
    },

    broadcastToRole: async (hotelId: number, targetRoles: string[], type: string, payload: any) => {
        const clients = connectedClients.get(hotelId);
        if (clients) {
            const message = JSON.stringify({ type, data: payload, timestamp: new Date() });
            clients.forEach(client => {
                if (targetRoles.includes(client.role) || ['Owner', 'Manager', 'General Manager'].includes(client.role)) {
                    try {
                        client.ws.send(message);
                    } catch (e) {
                        console.error('Failed to send to client', e);
                    }
                }
            });
        }

        for (const role of targetRoles) {
            await db.insert(notifications).values({
                hotelId,
                targetRole: role,
                type,
                title: payload.title || 'New Alert',
                message: payload.message || 'You have a new notification',
                metadata: payload
            });
        }
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

    sendToUser: async (hotelId: number, userId: string, type: string, payload: any) => {
        const clients = connectedClients.get(hotelId);
        if (clients) {
            const message = JSON.stringify({ type, data: payload, timestamp: new Date() });
            clients.forEach(client => {
                if (client.userId === userId) {
                    try {
                        client.ws.send(message);
                    } catch (e) {
                        console.error('Failed to send to user', e);
                    }
                }
            });
        }

        await db.insert(notifications).values({
            hotelId,
            recipientId: userId,
            type,
            title: payload.title || 'New Message',
            message: payload.message || '',
            metadata: payload
        });
    },

    getConnectedCount: (hotelId: number): number => {
        return connectedClients.get(hotelId)?.size || 0;
    }
};

const jwtConfig = jwt({
    name: 'jwt',
    secret: process.env.JWT_SECRET || 'nivas-secret-key'
});

const jwtVerifierApp = new Elysia().use(jwtConfig);

const verifySocketToken = async (token: string) => {
    const jwtDecorator = (jwtVerifierApp as any).decorator?.jwt;
    return jwtDecorator ? await jwtDecorator.verify(token) : null;
};

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

            try {
                const profile = await verifySocketToken(token);

                if (!profile) {
                    ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid or expired token' }));
                    ws.close();
                    return;
                }

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

                const unreadNotifications = await db.query.notifications.findMany({
                    where: and(
                        eq(notifications.hotelId, user.hotelId),
                        eq(notifications.isRead, false),
                        or(
                            eq(notifications.recipientId, user.id),
                            eq(notifications.targetRole, client.role)
                        )
                    ),
                    orderBy: [desc(notifications.createdAt)],
                    limit: 50
                });

                ws.send(JSON.stringify({
                    type: 'CONNECTED',
                    message: 'Real-time stream active',
                    userId: user.id,
                    role: client.role,
                    unreadCount: unreadNotifications.length,
                    latestNotifications: unreadNotifications
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
