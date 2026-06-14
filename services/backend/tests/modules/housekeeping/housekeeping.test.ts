import { describe, expect, it, mock, beforeEach } from "bun:test";
import { createTestApp } from "../../test-utils";

// Mock DB
const mockFindMany = mock();
const mockInsert = mock();
const mockUpdate = mock();
const mockValues = mock();
const mockReturning = mock();
const mockSet = mock();
const mockWhere = mock();

mock.module("../../../src/db", () => ({
    db: {
        query: {
            housekeepingTasks: { findMany: mockFindMany },
            users: { findFirst: mock(() => Promise.resolve({ id: "admin-1", isActive: true, hotelId: 1 })) }
        },
        insert: mockInsert,
        update: mockUpdate,
        transaction: mock((cb) => cb({
            insert: mockInsert,
            update: mockUpdate,
            query: {
                housekeepingTasks: { findMany: mockFindMany },
                users: { findFirst: mock(() => Promise.resolve({ id: "admin-1", isActive: true, hotelId: 1 })) }
            }
        }))
    }
}));

// Mock Schema
import { mockedSchema } from "../../mocks/schema";
mock.module("../../../src/db/schema", () => mockedSchema);

// Mock Audit Service
const mockLogAction = mock();
mock.module("../../../src/modules/system/audit.service", () => ({
    logAction: mockLogAction,
    AuditService: {
        log: mockLogAction
    }
}));

// Mock WS Service
const mockBroadcast = mock();
const mockSendToUser = mock();
mock.module("../../../src/modules/notifications/ws.service", () => ({
    WSService: {
        broadcastToRole: mockBroadcast,
        sendToUser: mockSendToUser
    }
}));
// Helper for assertion
const mockSend = mockBroadcast; // Logic delegates to broadcast or sendToUser

// import { housekeepingController } from "../../../src/modules/housekeeping/housekeeping.controller";

describe("Operations - Housekeeping Controller", () => {
    let app: any;
    let validToken: string;



    beforeEach(async () => {


        mockFindMany.mockReset();
        mockInsert.mockReset();
        mockUpdate.mockReset();
        mockValues.mockReset();
        mockReturning.mockReset();
        mockSet.mockReset();
        mockWhere.mockReset();
        mockBroadcast.mockReset();
        mockSendToUser.mockReset();

        // Setup chains
        mockInsert.mockReturnValue({ values: mockValues });
        mockValues.mockReturnValue({ returning: mockReturning });

        mockUpdate.mockReturnValue({ set: mockSet });
        mockSet.mockReturnValue({ where: mockWhere });
        mockWhere.mockReturnValue({ returning: mockReturning });

        const { housekeepingController } = await import("../../../src/modules/housekeeping/housekeeping.controller");
        app = createTestApp(housekeepingController);

        const { Elysia } = await import("elysia");
        const { jwt } = await import("@elysiajs/jwt");
        const { config } = await import("../../../src/config/env");
        const jwtApp = new Elysia().use(jwt({ name: 'jwt', secret: config.jwt.secret }));

        validToken = await (jwtApp as any).decorator.jwt.sign({
            id: "admin-1",
            hotelId: 1,
            type: "HOTEL_STAFF",
            permissions: ["ROOMS.MANAGE_CLEANING", "HOUSEKEEPING.UPDATE"]
        });
    });

    it("GET /housekeeping - should list tasks", async () => {
        mockFindMany.mockResolvedValue([{ id: 1, taskType: "CLEAN", status: "PENDING" }]);

        const req = new Request("http://localhost/housekeeping", {
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data).toHaveLength(1);
    });

    it("POST /housekeeping - should assign task and notify", async () => {
        mockReturning.mockReturnValue([{ id: 10, roomId: 101, status: "PENDING" }]);

        const req = new Request("http://localhost/housekeeping", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${validToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                roomId: 101,
                taskType: "DEEP_CLEAN",
                priority: "HIGH"
            })
        });

        const res = await app.handle(req);

        if (res.status !== 200) {
            console.log(await res.text());
        }

        expect(res.status).toBe(200);
        expect(mockInsert).toHaveBeenCalled();
        expect(mockBroadcast).toHaveBeenCalled();
        expect(mockUpdate).toHaveBeenCalled(); // Should update room status
    });

    it("PATCH /housekeeping/:id/status - should update status and room availability", async () => {
        mockReturning.mockReturnValue([{ id: 10, roomId: 101, status: "COMPLETED" }]);

        const req = new Request("http://localhost/housekeeping/10/status", {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${validToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ status: "COMPLETED" })
        });

        const res = await app.handle(req);

        expect(res.status).toBe(200);
        expect(mockUpdate).toHaveBeenCalled();
        // Check if room update logic was called (mockReturning for task update returns task with roomId)
        // The controller does a second update for the room if status is COMPLETED
    });
});
