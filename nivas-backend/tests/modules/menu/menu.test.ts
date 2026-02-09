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

mock.module("../../../src/db", () => ({
    db: {
        query: {
            menuItems: { findMany: mockFindMany },
            users: { findFirst: mock(() => Promise.resolve({ id: 'admin-1', isActive: true, hotelId: 1 })) }
        },
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete
    }
}));

// Mock Schema
import { mockedSchema } from "../../mocks/schema";
mock.module("../../../src/db/schema", () => mockedSchema);

import { menuController } from "../../../src/modules/menu/menu.controller";

describe("Menu Controller", () => {
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

        app = createTestApp(menuController);

        const { Elysia } = await import("elysia");
        const { jwt } = await import("@elysiajs/jwt");
        const { config } = await import("../../../src/config/env");
        const jwtApp = new Elysia().use(jwt({ name: 'jwt', secret: config.jwt.secret }));

        validToken = await (jwtApp as any).decorator.jwt.sign({
            id: "admin-1",
            hotelId: 1,
            type: "HOTEL_STAFF",
            permissions: ["MENU.CREATE", "MENU.VIEW", "MENU.UPDATE", "MENU.DELETE"]
        });
    });

    it("GET /menu - should list menu items", async () => {
        mockFindMany.mockResolvedValue([
            { id: 1, name: "Burger", price: "200" }
        ]);

        const req = new Request("http://localhost/menu", {
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data).toHaveLength(1);
        expect(body.data[0].name).toBe("Burger");
    });

    it("POST /menu - should create item", async () => {
        mockReturning.mockReturnValue([{ id: 1, name: "Burger" }]);

        const req = new Request("http://localhost/menu", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${validToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: "Burger",
                price: 200,
                category: "Food"
            })
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(mockInsert).toHaveBeenCalled();
    });

    it("PATCH /menu/:id - should update item", async () => {
        mockReturning.mockReturnValue([{ id: 1, name: "Cheese Burger" }]);

        const req = new Request("http://localhost/menu/1", {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${validToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ name: "Cheese Burger" })
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(mockUpdate).toHaveBeenCalled();
    });

    it("DELETE /menu/:id - should delete item", async () => {
        mockReturning.mockReturnValue([{ id: 1 }]);

        const req = new Request("http://localhost/menu/1", {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        expect(res.status).toBe(200);
        expect(mockDelete).toHaveBeenCalled();
    });
    it("POST /menu/bulk - should create multiple items", async () => {
        mockReturning.mockReturnValue([{ id: 1 }, { id: 2 }]);

        const req = new Request("http://localhost/menu/bulk", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${validToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify([
                { name: "Burger", price: 200 },
                { name: "Fries", price: 100 }
            ])
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data.count).toBe(2);
        expect(mockInsert).toHaveBeenCalled();
    });
});
