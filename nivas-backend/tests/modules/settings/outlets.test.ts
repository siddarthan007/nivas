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
            outlets: { findMany: mockFindMany },
            users: { findFirst: mock(() => Promise.resolve({ id: "admin-1", isActive: true, hotelId: 1 })) }
        },
        insert: mockInsert
    }
}));

// Mock Schema
import { mockedSchema } from "../../mocks/schema";
mock.module("../../../src/db/schema", () => mockedSchema);

import { outletsController } from "../../../src/modules/settings/outlets.controller";

describe("Settings - Outlets Controller", () => {
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

        app = createTestApp(outletsController);

        const { Elysia } = await import("elysia");
        const { jwt } = await import("@elysiajs/jwt");
        const { config } = await import("../../../src/config/env");
        const jwtApp = new Elysia().use(jwt({ name: 'jwt', secret: config.jwt.secret }));

        validToken = await (jwtApp as any).decorator.jwt.sign({
            id: "admin-1",
            hotelId: 1,
            type: "HOTEL_STAFF",
            permissions: ["SETTINGS.MANAGE_OUTLETS"]
        });
    });

    it("GET /settings/outlets - should list outlets", async () => {
        mockFindMany.mockResolvedValue([{ id: 1, name: "Main Bar", type: "BAR" }]);

        const req = new Request("http://localhost/settings/outlets", {
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data).toHaveLength(1);
    });

    it("POST /settings/outlets - should create outlet", async () => {
        mockReturning.mockReturnValue([{ id: 2, name: "Pool Bar", type: "BAR" }]);

        const req = new Request("http://localhost/settings/outlets", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${validToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: "Pool Bar",
                type: "BAR"
            })
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(mockInsert).toHaveBeenCalled();
    });
});
