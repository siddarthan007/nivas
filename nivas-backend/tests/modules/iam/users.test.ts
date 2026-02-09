import { describe, expect, it, mock, beforeEach } from "bun:test";
import { createTestApp } from "../../test-utils";

// Mock DB
const mockFindMany = mock();
const mockUpdate = mock();
const mockSet = mock();
const mockWhere = mock();
const mockReturning = mock();

mock.module("../../../src/db", () => ({
    db: {
        query: {
            users: {
                findMany: mockFindMany,
                findFirst: mock(() => Promise.resolve({ id: "admin-1", isActive: true, hotelId: 1 }))
            }
        },
        update: mockUpdate
    }
}));

// Mock Schema
import { mockedSchema } from "../../mocks/schema";
mock.module("../../../src/db/schema", () => mockedSchema);

import { usersController } from "../../../src/modules/iam/users.controller";

describe("IAM - Users Controller", () => {
    let app: any;
    let validToken: string;

    beforeEach(async () => {
        mockFindMany.mockReset();
        mockUpdate.mockReset();
        mockSet.mockReset();
        mockWhere.mockReset();
        mockReturning.mockReset();

        // Setup update chain
        mockUpdate.mockReturnValue({ set: mockSet });
        mockSet.mockReturnValue({ where: mockWhere });
        mockWhere.mockReturnValue({ returning: mockReturning });

        app = createTestApp(usersController);

        const { Elysia } = await import("elysia");
        const { jwt } = await import("@elysiajs/jwt");
        const { config } = await import("../../../src/config/env");
        const jwtApp = new Elysia().use(jwt({ name: 'jwt', secret: config.jwt.secret }));

        validToken = await (jwtApp as any).decorator.jwt.sign({
            id: "admin-1",
            hotelId: 1,
            type: "HOTEL_STAFF",
            permissions: ["USERS.READ", "USERS.MANAGE_ROLES", "USERS.UPDATE"]
        });
    });

    it("GET /users - should return staff list without passwords", async () => {
        mockFindMany.mockResolvedValue([
            { id: "u1", fullName: "Staff One", passwordHash: "secret" }
        ]);

        const req = new Request("http://localhost/users", {
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data).toHaveLength(1);
        expect(body.data[0].fullName).toBe("Staff One");
        expect(body.data[0].passwordHash).toBeUndefined();
    });

    it("PATCH /users/:id/role - should update user role", async () => {
        mockReturning.mockReturnValue([{ id: "u1", roleId: 2, fullName: "Staff One" }]);

        const req = new Request("http://localhost/users/u1/role", {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${validToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ roleId: 2 })
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data.roleId).toBe(2);
        expect(mockUpdate).toHaveBeenCalled();
    });

    it("PATCH /users/:id/status - should toggle activation", async () => {
        mockReturning.mockReturnValue([{ id: "u1", isActive: false }]);

        const req = new Request("http://localhost/users/u1/status", {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${validToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ isActive: false })
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.message).toContain("deactivated");
        expect(mockUpdate).toHaveBeenCalled();
    });
});
