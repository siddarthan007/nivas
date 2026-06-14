import { describe, expect, it, mock, beforeEach } from "bun:test";
import { createTestApp } from "../../test-utils";

// 1. Mock DB
const mockFindMany = mock();
const mockFindFirst = mock();
const mockInsert = mock();
const mockUpdate = mock();
const mockDelete = mock();
const mockValues = mock();
const mockReturning = mock();
const mockSet = mock();
const mockWhere = mock();

mock.module("../../../src/db", () => ({
    db: {
        query: {
            channelManagerSettings: { findMany: mockFindMany, findFirst: mockFindFirst },
            channelSyncLogs: { findMany: mockFindMany },
            rooms: { findMany: mockFindMany },
            users: { findFirst: mock(() => Promise.resolve({ id: "admin-1", isActive: true, hotelId: 1 })) }
        },
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete
    }
}));

// 2. Mock Schema
import { mockedSchema } from "../../mocks/schema";
mock.module("../../../src/db/schema", () => mockedSchema);

// Import controller AFTER mocking
import { channelManagerController } from "../../../src/modules/saas/channel-manager.controller";

describe("SaaS - Channel Manager Controller", () => {
    let app: any;
    let validToken: string;

    beforeEach(async () => {
        // Reset all mocks
        mockFindMany.mockReset();
        mockFindFirst.mockReset();
        mockInsert.mockReset();
        mockUpdate.mockReset();
        mockDelete.mockReset();
        mockValues.mockReset();
        mockReturning.mockReset();
        mockSet.mockReset();
        mockWhere.mockReset();

        // Setup insert chain
        mockInsert.mockReturnValue({ values: mockValues });
        mockValues.mockReturnValue({ returning: mockReturning });

        // Setup update chain
        mockUpdate.mockReturnValue({ set: mockSet });
        mockSet.mockReturnValue({ where: mockWhere });
        mockWhere.mockReturnValue({ returning: mockReturning });

        // Setup delete chain
        mockDelete.mockReturnValue({ where: mockWhere });

        app = createTestApp(channelManagerController as any);

        // Generate a valid token
        const { Elysia } = await import("elysia");
        const { jwt } = await import("@elysiajs/jwt");
        const { config } = await import("../../../src/config/env");
        const jwtApp = new Elysia().use(jwt({ name: 'jwt', secret: config.jwt.secret }));

        validToken = await (jwtApp as any).decorator.jwt.sign({
            id: "admin-1",
            hotelId: 1,
            type: "HOTEL_STAFF",
            permissions: ["SYSTEM.MANAGE_SETTINGS"]
        });
    });

    it("GET /channel-manager/channels - should list channels", async () => {
        mockFindMany.mockResolvedValue([{
            id: 1,
            channelCode: "BOOKING_COM",
            channelName: "Booking.com"
        }]);

        const req = new Request("http://localhost/channel-manager/channels", {
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data).toHaveLength(1);
    });

    it("POST /channel-manager/channels - should add channel", async () => {
        mockReturning.mockResolvedValue([{
            id: 1,
            channelCode: "BOOKING_COM",
            channelName: "Booking.com",
            isActive: false
        }]);

        const req = new Request("http://localhost/channel-manager/channels", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${validToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                channelCode: "BOOKING_COM",
                channelName: "Booking.com",
                apiKey: "xyz",
                syncRates: true
            })
        });

        const res = await app.handle(req);

        expect(res.status).toBe(200);
        expect(mockInsert).toHaveBeenCalled();
    });

    it("POST /channel-manager/channels/:id/sync-inventory - should sync inventory", async () => {
        // Mock channel lookup
        mockFindFirst.mockResolvedValue({
            id: 1,
            channelName: "Booking.com",
            isActive: true,
            rateMappings: []
        });

        // Mock rooms list
        mockFindMany.mockResolvedValue([{ id: 101, number: "101" }]);

        // Mock insert sync log
        mockReturning.mockResolvedValue([{ id: 50, status: "SUCCESS" }]);

        const req = new Request("http://localhost/channel-manager/channels/1/sync-inventory", {
            method: "POST",
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data.roomsSynced).toBe(1);
        expect(mockInsert).toHaveBeenCalled();
    });
});
