import { describe, expect, it, mock, beforeEach } from "bun:test";
import { createTestApp } from "../../test-utils";

// Mock DB
const mockFindMany = mock();
const mockFindFirst = mock();
const mockInsert = mock();
const mockUpdate = mock();
const mockValues = mock();
const mockReturning = mock();
const mockSet = mock();
const mockWhere = mock();

const mockDb: any = {
    query: {
        inventoryItems: { findMany: mockFindMany, findFirst: mockFindFirst },
        inventoryRequests: { findMany: mockFindMany },
        users: { findFirst: mock(() => Promise.resolve({ id: 'admin-1', isActive: true, hotelId: 1 })) }
    },
    insert: mockInsert,
    update: mockUpdate
};
mockDb.transaction = (cb: any) => cb(mockDb);

mock.module("../../../src/db", () => ({
    db: mockDb
}));

// Mock Schema
import { mockedSchema } from "../../mocks/schema";
mock.module("../../../src/db/schema", () => mockedSchema);

import { inventoryController } from "../../../src/modules/inventory/inventory.controller";

describe("Inventory Controller", () => {
    let app: any;
    let validToken: string;

    beforeEach(async () => {
        mockFindMany.mockReset();
        mockFindFirst.mockReset();
        mockInsert.mockReset();
        mockUpdate.mockReset();
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

        app = createTestApp(inventoryController);

        const { Elysia } = await import("elysia");
        const { jwt } = await import("@elysiajs/jwt");
        const { config } = await import("../../../src/config/env");
        const jwtApp = new Elysia().use(jwt({ name: 'jwt', secret: config.jwt.secret }));

        validToken = await (jwtApp as any).decorator.jwt.sign({
            id: "admin-1",
            hotelId: 1,
            type: "HOTEL_STAFF",
            permissions: ["INVENTORY.READ", "INVENTORY.UPDATE", "INVENTORY.REQUEST_STOCK"]
        });
    });

    it("GET /inventory - should list items", async () => {
        mockFindMany.mockResolvedValue([{ id: 1, name: "Soap", quantity: 100 }]);

        const req = new Request("http://localhost/inventory", {
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data).toHaveLength(1);
    });

    it("POST /inventory - should add item", async () => {
        mockReturning.mockReturnValue([{ id: 1, name: "Shampoo", quantity: 50 }]);

        const req = new Request("http://localhost/inventory", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${validToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: "Shampoo",
                quantity: 50,
                unit: "Bottles",
                lowStockThreshold: 10
            })
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(mockInsert).toHaveBeenCalled();
    });

    it("POST /inventory/requests - should submit request", async () => {
        mockReturning.mockReturnValue([{ id: 10, itemId: 1, status: "PENDING" }]);

        const req = new Request("http://localhost/inventory/requests", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${validToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                itemId: 1,
                quantity: 20,
                notes: "Urgent"
            })
        });

        const res = await app.handle(req);
        expect(res.status).toBe(200);
        expect(mockInsert).toHaveBeenCalled();
    });

    it("PATCH /inventory/requests/:id/status - should approve and update inventory", async () => {
        // Mock request update returning APPROVED
        mockReturning.mockReturnValueOnce([{ id: 10, itemId: 1, status: "APPROVED", quantity: 20 }]);

        // Mock finding the item
        mockFindFirst.mockResolvedValue({ id: 1, quantity: 50 });

        const req = new Request("http://localhost/inventory/requests/10/status", {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${validToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ status: "APPROVED" })
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        // Expect one update for request status, one update for item quantity
        expect(mockUpdate).toHaveBeenCalledTimes(2);
    });
    it("POST /inventory/bulk - should add multiple items", async () => {
        mockReturning.mockReturnValue([{ id: 1 }, { id: 2 }]);

        const req = new Request("http://localhost/inventory/bulk", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${validToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify([
                { name: "Soap", quantity: 100, unit: "pcs", lowStockThreshold: 10 },
                { name: "Shampoo", quantity: 50, unit: "bottles", lowStockThreshold: 5 }
            ])
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data.count).toBe(2);
        expect(mockInsert).toHaveBeenCalled();
    });
});
