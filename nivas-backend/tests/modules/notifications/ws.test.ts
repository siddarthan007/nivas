import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";

interface WsClient {
    ws: any;
    userId: string;
    hotelId: number;
    role: string;
}

const mockUsersFindFirst = mock();
const mockNotificationsFindMany = mock();
const mockInsert = mock();

function createWsHarness(secret: string) {
    const connectedClients = new Map<number, Set<WsClient>>();
    const jwtApp = new Elysia().use(jwt({ name: 'jwt', secret }));

    const addClient = (hotelId: number, client: WsClient) => {
        if (!connectedClients.has(hotelId)) {
            connectedClients.set(hotelId, new Set());
        }
        connectedClients.get(hotelId)?.add(client);
    };

    const removeClient = (hotelId: number, client: WsClient) => {
        const clients = connectedClients.get(hotelId);
        if (!clients) return;
        clients.delete(client);
        if (clients.size === 0) {
            connectedClients.delete(hotelId);
        }
    };

    const WSService = {
        broadcastToHotel(hotelId: number, type: string, payload: any) {
            const clients = connectedClients.get(hotelId);
            if (!clients) return;
            const message = JSON.stringify({ type, data: payload, timestamp: new Date() });
            clients.forEach((client) => client.ws.send(message));
        },
        async sendToUser(hotelId: number, userId: string, type: string, payload: any) {
            const clients = connectedClients.get(hotelId);
            if (clients) {
                const message = JSON.stringify({ type, data: payload, timestamp: new Date() });
                clients.forEach((client) => {
                    if (client.userId === userId) {
                        client.ws.send(message);
                    }
                });
            }
            mockInsert({ hotelId, userId, type, payload });
        }
    };

    const wsController = new Elysia({ prefix: '/ws' })
        .ws('/notifications', {
            query: t.Object({ token: t.String() }),
            async open(ws) {
                const token = ws.data.query.token;
                if (!token) {
                    ws.send(JSON.stringify({ type: 'ERROR', message: 'Token required' }));
                    ws.close();
                    return;
                }

                const jwtDecorator = (jwtApp as any).decorator?.jwt;
                const profile = jwtDecorator ? await jwtDecorator.verify(token) : null;

                if (!profile) {
                    ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid or expired token' }));
                    ws.close();
                    return;
                }

                const user = await mockUsersFindFirst({ id: profile.id });
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

                const unreadNotifications = await mockNotificationsFindMany({ hotelId: user.hotelId, userId: user.id });

                ws.send(JSON.stringify({
                    type: 'CONNECTED',
                    message: 'Real-time stream active',
                    userId: user.id,
                    role: client.role,
                    unreadCount: unreadNotifications.length,
                    latestNotifications: unreadNotifications
                }));
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

    return { wsController, WSService, jwtApp };
}

describe("WebSocket Notification Service", () => {
    let wsController: any;
    let WSService: any;
    let jwtApp: any;
    let server: any;
    let wsUrl: string;
    let validToken: string;
    const secret = 'test-secret';

    beforeEach(async () => {
        mockUsersFindFirst.mockReset();
        mockNotificationsFindMany.mockReset();
        mockInsert.mockReset();

        mockNotificationsFindMany.mockResolvedValue([]);
        mockUsersFindFirst.mockResolvedValue({
            id: 'user-1',
            hotelId: 1,
            role: { name: 'Manager' }
        });

        const harness = createWsHarness(secret);
        wsController = harness.wsController;
        WSService = harness.WSService;
        jwtApp = harness.jwtApp;

        validToken = await (jwtApp as any).decorator.jwt.sign({
            id: 'user-1',
            hotelId: 1,
            role: 'Manager'
        });

        server = wsController.listen(0);
        const port = server.server.port;
        wsUrl = `ws://localhost:${port}/ws/notifications`;
    });

    afterEach(() => {
        if (server) server.stop();
    });

    it("should reject connection without token", async () => {
        const ws = new WebSocket(wsUrl);
        let receivedError = false;
        let closed = false;

        await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => resolve(), 2000);

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data.toString());
                    if (data.type === 'ERROR') receivedError = true;
                } catch {}
            };
            ws.onclose = () => {
                closed = true;
                clearTimeout(timeout);
                resolve();
            };
            ws.onerror = () => {
                clearTimeout(timeout);
                resolve();
            };
        });

        expect(closed || receivedError).toBe(true);
    });

    it("should connect successfully with valid token", async () => {
        const url = `${wsUrl}?token=${validToken}`;
        const ws = new WebSocket(url);

        let connected = false;
        let userData: any = null;

        await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
                ws.close();
                resolve();
            }, 2000);

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data.toString());
                    if (data.type === 'CONNECTED') {
                        connected = true;
                        userData = data;
                        clearTimeout(timeout);
                        ws.close();
                        resolve();
                    }
                } catch {}
            };
            ws.onerror = () => {
                clearTimeout(timeout);
                resolve();
            };
        });

        expect(connected).toBe(true);
        expect(userData?.userId).toBe('user-1');
    });

    it("should handle ping/pong", async () => {
        const url = `${wsUrl}?token=${validToken}`;
        const ws = new WebSocket(url);

        let pongReceived = false;

        await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
                ws.close();
                resolve();
            }, 2000);

            ws.onmessage = (event) => {
                if (event.data === 'pong') {
                    pongReceived = true;
                    clearTimeout(timeout);
                    ws.close();
                    resolve();
                    return;
                }

                try {
                    const data = JSON.parse(event.data.toString());
                    if (data.type === 'CONNECTED') {
                        ws.send('ping');
                    }
                } catch {}
            };
            ws.onerror = () => {
                clearTimeout(timeout);
                resolve();
            };
        });

        expect(pongReceived).toBe(true);
    });

    it("should receive broadcast notifications", async () => {
        const url = `${wsUrl}?token=${validToken}`;
        const ws = new WebSocket(url);
        const messages: any[] = [];

        await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
                ws.close();
                resolve();
            }, 3000);

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data.toString());
                    if (data.type === 'CONNECTED') {
                        setTimeout(() => {
                            WSService.broadcastToHotel(1, 'TEST_ALERT', { message: 'Hello' });
                        }, 100);
                    } else if (data.type === 'TEST_ALERT') {
                        messages.push(data);
                        clearTimeout(timeout);
                        ws.close();
                        resolve();
                    }
                } catch {}
            };
            ws.onerror = () => {
                clearTimeout(timeout);
                resolve();
            };
        });

        const alert = messages.find(m => m.type === 'TEST_ALERT');
        expect(alert).toBeDefined();
        expect(alert?.data?.message).toBe('Hello');
    });

    it("should receive user-specific notifications", async () => {
        const url = `${wsUrl}?token=${validToken}`;
        const ws = new WebSocket(url);
        const messages: any[] = [];

        await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
                ws.close();
                resolve();
            }, 3000);

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data.toString());
                    if (data.type === 'CONNECTED') {
                        setTimeout(async () => {
                            await WSService.sendToUser(1, 'user-1', 'PRIVATE_MSG', { secret: '123' });
                        }, 100);
                    } else if (data.type === 'PRIVATE_MSG') {
                        messages.push(data);
                        clearTimeout(timeout);
                        ws.close();
                        resolve();
                    }
                } catch {}
            };
            ws.onerror = () => {
                clearTimeout(timeout);
                resolve();
            };
        });

        const msg = messages.find(m => m.type === 'PRIVATE_MSG');
        expect(msg).toBeDefined();
        expect(msg?.data?.secret).toBe('123');
        expect(mockInsert).toHaveBeenCalled();
    });
});
