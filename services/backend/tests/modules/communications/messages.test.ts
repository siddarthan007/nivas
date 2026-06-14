import { describe, expect, it, mock, beforeEach } from "bun:test";
import { createTestApp } from "../../test-utils";

// Mock DB
const mockFindMany = mock();
const mockInsert = mock();
const mockValues = mock();
const mockReturning = mock();

mock.module("../../../src/db", () => ({
    db: {
        query: {
            messages: { findMany: mockFindMany },
            users: { findFirst: mock(() => Promise.resolve({ id: "user-1", isActive: true, hotelId: 1 })) }
        },
        insert: mockInsert
    }
}));

// Mock Schema
mock.module("../../../src/db/schema", () => ({
    messages: { name: "messages" }
}));

import { messagesController } from "../../../src/modules/communications/messages.controller";

describe("Communications - Messages Controller", () => {
    let app: any;
    let validToken: string;

    beforeEach(async () => {
        mockFindMany.mockReset();
        mockInsert.mockReset();
        mockValues.mockReset();
        mockReturning.mockReset();

        // Setup chains
        mockInsert.mockReturnValue({ values: mockValues });
        mockValues.mockReturnValue({ returning: mockReturning });

        app = createTestApp(messagesController);

        const { Elysia } = await import("elysia");
        const { jwt } = await import("@elysiajs/jwt");
        const { config } = await import("../../../src/config/env");
        const jwtApp = new Elysia().use(jwt({ name: 'jwt', secret: config.jwt.secret }));

        validToken = await (jwtApp as any).decorator.jwt.sign({
            id: "user-1",
            hotelId: 1,
            type: "HOTEL_STAFF",
            permissions: ["COMMUNICATIONS.SEND_MESSAGE", "COMMUNICATIONS.READ_MESSAGES"]
        });
    });

    it("POST /messages - should send message", async () => {
        mockReturning.mockReturnValue([{ id: 1, content: "Hello" }]);

        const req = new Request("http://localhost/messages", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${validToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                receiverId: "user-2",
                content: "Hello",
                messageType: "TEXT"
            })
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(mockInsert).toHaveBeenCalled();
    });

    it("GET /messages/inbox - should list user messages", async () => {
        mockFindMany.mockResolvedValue([
            { id: 1, content: "Hello", sender: { fullName: "Jane Doe" } }
        ]);

        const req = new Request("http://localhost/messages/inbox", {
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data).toHaveLength(1);
    });
});
