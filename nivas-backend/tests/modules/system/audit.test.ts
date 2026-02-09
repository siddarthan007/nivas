import { describe, expect, it, mock, beforeEach } from "bun:test";
import { createTestApp } from "../../test-utils";

// Mock AuditService directly (controller uses this)
const mockGetLogs = mock();

mock.module("../../../src/modules/system/audit.service", () => ({
    AuditService: {
        getLogs: mockGetLogs,
        log: mock() // backward compat
    },
    logAction: mock()
}));

// Mock DB for auth middleware user lookup
const mockUsersFindFirst = mock();
mock.module("../../../src/db", () => ({
    db: {
        query: {
            users: { findFirst: mockUsersFindFirst }
        }
    }
}));

// Mock Schema
import { mockedSchema } from "../../mocks/schema";
mock.module("../../../src/db/schema", () => mockedSchema);

import { auditController } from "../../../src/modules/system/audit.controller";

describe("System - Audit Controller", () => {
    let app: any;
    let validToken: string;

    beforeEach(async () => {
        mockGetLogs.mockReset();
        mockUsersFindFirst.mockReset();

        mockUsersFindFirst.mockResolvedValue({
            id: "admin-1",
            isActive: true,
            hotelId: 1,
            role: {
                name: "Manager",
                permissions: ["SYSTEM.VIEW_SAAS_ANALYTICS"]
            },
            permissions: ["SYSTEM.VIEW_SAAS_ANALYTICS"]
        });

        app = createTestApp(auditController);

        const { Elysia } = await import("elysia");
        const { jwt } = await import("@elysiajs/jwt");
        const { config } = await import("../../../src/config/env");
        const jwtApp = new Elysia().use(jwt({ name: 'jwt', secret: config.jwt.secret }));

        validToken = await (jwtApp as any).decorator.jwt.sign({
            id: "user-1",
            hotelId: 1,
            type: "HOTEL_STAFF",
            permissions: ["SYSTEM.VIEW_SAAS_ANALYTICS"]
        });
    });

    it("GET /audit - should return logs", async () => {
        mockGetLogs.mockResolvedValue([
            { id: 1, action: "LOGIN", user: { fullName: "User" } }
        ]);

        const req = new Request("http://localhost/audit", {
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data).toHaveLength(1);
        expect(body.data[0].action).toBe("LOGIN");
        expect(mockGetLogs).toHaveBeenCalled();
    });
});
