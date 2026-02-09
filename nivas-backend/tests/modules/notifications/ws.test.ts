import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import { Elysia } from "elysia";

// Mock DB with all required query methods
const mockUsersFindFirst = mock();
const mockNotificationsFindMany = mock();
const mockInsert = mock();
const mockValues = mock();

mock.module("../../../src/db", () => ({
    db: {
        query: {
            users: { findFirst: mockUsersFindFirst },
            notifications: { findMany: mockNotificationsFindMany }
        },
        insert: mockInsert
    }
}));

// Mock Schema
import { mockedSchema } from "../../mocks/schema";
mock.module("../../../src/db/schema", () => mockedSchema);

// Mock Drizzle ORM
mock.module("drizzle-orm", () => ({
    eq: (col: any, val: any) => ({ type: 'eq', col, val }),
    and: (...args: any[]) => ({ type: 'and', args }),
    or: (...args: any[]) => ({ type: 'or', args }),
    desc: (col: any) => ({ type: 'desc', col })
}));

describe("WebSocket Notification Service", () => {
    let wsController: any;
    let WSService: any;
    let server: any;
    let wsUrl: string;
    let validToken: string;

    beforeEach(async () => {
        // Reset mocks
        mockUsersFindFirst.mockReset();
        mockNotificationsFindMany.mockReset();
        mockInsert.mockReset();
        mockValues.mockReset();

        // Setup mock chains
        mockInsert.mockReturnValue({ values: mockValues });
        mockValues.mockResolvedValue(undefined);

        // Default mock behaviors
        mockNotificationsFindMany.mockResolvedValue([]);
        mockUsersFindFirst.mockResolvedValue({
            id: "user-1",
            hotelId: 1,
            role: { name: "Manager" }
        });

        // Set Env for Secret
        process.env.JWT_SECRET = "test-secret";

        // Dynamic import to ensure mocks are applied
        const mod = await import("../../../src/modules/notifications/ws.service");
        wsController = mod.wsController;
        WSService = mod.WSService;

        // Generate Token
        const { jwt } = await import("@elysiajs/jwt");
        const jwtTool = new Elysia().use(jwt({ name: 'jwt', secret: "test-secret" }));

        validToken = await (jwtTool as any).decorator.jwt.sign({
            id: "user-1",
            hotelId: 1,
            role: "Manager"
        });

        // Start Server
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
                } catch (e) { }
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
                } catch (e) {
                    // pong or other non-JSON message
                }
            };
            ws.onerror = () => {
                clearTimeout(timeout);
                resolve();
            };
        });

        expect(connected).toBe(true);
        expect(userData?.userId).toBe("user-1");
    });

    it("should handle ping/pong", async () => {
        const url = `${wsUrl}?token=${validToken}`;
        const ws = new WebSocket(url);

        let pongReceived = false;
        let readyToSend = false;

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
                } else {
                    // Got CONNECTED message, now send ping
                    try {
                        const data = JSON.parse(event.data.toString());
                        if (data.type === 'CONNECTED') {
                            readyToSend = true;
                            ws.send("ping");
                        }
                    } catch (e) { }
                }
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
                        // Send broadcast after connection
                        setTimeout(() => {
                            WSService.broadcastToHotel(1, 'TEST_ALERT', { message: 'Hello' });
                        }, 100);
                    } else if (data.type === 'TEST_ALERT') {
                        messages.push(data);
                        clearTimeout(timeout);
                        ws.close();
                        resolve();
                    }
                } catch (e) {
                    // Non-JSON message
                }
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
                        // Send user-specific notification after connection
                        setTimeout(async () => {
                            await WSService.sendToUser(1, 'user-1', 'PRIVATE_MSG', { secret: '123' });
                        }, 100);
                    } else if (data.type === 'PRIVATE_MSG') {
                        messages.push(data);
                        clearTimeout(timeout);
                        ws.close();
                        resolve();
                    }
                } catch (e) {
                    // Non-JSON message
                }
            };
            ws.onerror = () => {
                clearTimeout(timeout);
                resolve();
            };
        });

        const msg = messages.find(m => m.type === 'PRIVATE_MSG');
        expect(msg).toBeDefined();
        expect(msg?.data?.secret).toBe('123');

        // Verify DB insert was called
        expect(mockInsert).toHaveBeenCalled();
    });
});
