import { describe, expect, it, mock, beforeEach } from "bun:test";
import { createTestApp } from "../../test-utils";

// Mock DB
const mockFindMany = mock();
const mockInsert = mock();
const mockUpdate = mock();
const mockDelete = mock();
const mockValues = mock();
const mockReturning = mock();
const mockSet = mock();
const mockWhere = mock();
const mockSelect = mock();
const mockFrom = mock();
const mockSelectWhere = mock();

mock.module("../../../src/db", () => ({
    db: {
        query: {
            roles: { findMany: mockFindMany },
            users: { findFirst: mock(() => Promise.resolve({ id: "admin-1", isActive: true, hotelId: 1 })) }
        },
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
        select: mockSelect
    }
}));

// Mock Schema
import { mockedSchema } from "../../mocks/schema";
mock.module("../../../src/db/schema", () => mockedSchema);

import { rolesController } from "../../../src/modules/iam/roles.controller";

describe("IAM - Roles Controller", () => {
    let app: any;
    let validToken: string;

    beforeEach(async () => {
        mockFindMany.mockReset();
        mockInsert.mockReset();
        mockUpdate.mockReset();
        mockDelete.mockReset();
        mockValues.mockReset();
        mockReturning.mockReset();
        mockSet.mockReset();
        mockWhere.mockReset();

        // Setup chains
        mockInsert.mockReturnValue({ values: mockValues });
        mockValues.mockReturnValue({ returning: mockReturning });

        mockUpdate.mockReturnValue({ set: mockSet });
        mockSet.mockReturnValue({ where: mockWhere });
        mockWhere.mockReturnValue({ returning: mockReturning });

        mockDelete.mockReturnValue({ where: mockWhere });

        // Setup chain for select count
        mockSelect.mockReturnValue({ from: mockFrom });
        mockFrom.mockReturnValue({ where: mockSelectWhere });
        // Default to no users assigned
        mockSelectWhere.mockResolvedValue([{ count: 0 }]);

        app = createTestApp(rolesController);

        const { Elysia } = await import("elysia");
        const { jwt } = await import("@elysiajs/jwt");
        const { config } = await import("../../../src/config/env");
        const jwtApp = new Elysia().use(jwt({ name: 'jwt', secret: config.jwt.secret }));

        validToken = await (jwtApp as any).decorator.jwt.sign({
            id: "admin-1",
            hotelId: 1,
            type: "HOTEL_STAFF",
            permissions: ["ROLES.READ", "ROLES.CREATE", "ROLES.UPDATE", "ROLES.DELETE"]
        });
    });

    it("GET /roles - should return list of roles", async () => {
        mockFindMany.mockResolvedValue([{ id: 1, name: "Manager", permissions: ["ALL"] }]);

        const req = new Request("http://localhost/roles", {
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data).toHaveLength(1);
    });

    it("POST /roles - should create a new role", async () => {
        mockReturning.mockReturnValue([{ id: 2, name: "Supervisor", permissions: [] }]);

        const req = new Request("http://localhost/roles", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${validToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: "Supervisor",
                permissions: ["VIEW_DASHBOARD"]
            })
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(mockInsert).toHaveBeenCalled();
    });

    it("PATCH /roles/:id - should update role permissions", async () => {
        mockReturning.mockReturnValue([{ id: 2, name: "Supervisor", permissions: ["VIEW_DASHBOARD", "VIEW_REPORTS"] }]);

        const req = new Request("http://localhost/roles/2", {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${validToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                permissions: ["VIEW_DASHBOARD", "VIEW_REPORTS"]
            })
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(mockUpdate).toHaveBeenCalled();
    });

    it("DELETE /roles/:id - should delete role", async () => {
        const req = new Request("http://localhost/roles/2", {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);

        expect(res.status).toBe(200);
        expect(mockDelete).toHaveBeenCalled();
    });
});
