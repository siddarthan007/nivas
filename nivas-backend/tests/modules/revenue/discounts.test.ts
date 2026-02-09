import { describe, expect, it, mock, beforeEach, setSystemTime } from "bun:test";
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
            discountRules: { findMany: mockFindMany },
            users: { findFirst: mock(() => Promise.resolve({ id: "admin-1", isActive: true, hotelId: 1 })) }
        },
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete
    }
}));

// Mock Schema
mock.module("../../../src/db/schema", () => ({
    discountRules: { name: "discount_rules" }
}));

import { discountsController } from "../../../src/modules/revenue/discounts.controller";

describe("Revenue - Discounts Controller", () => {
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

        app = createTestApp(discountsController);

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

    it("POST /discounts - should create discount rule", async () => {
        mockReturning.mockReturnValue([{ id: 1, name: "Happy Hour" }]);

        const req = new Request("http://localhost/discounts", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${validToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: "Happy Hour",
                discountType: "PERCENTAGE",
                discountValue: 20,
                daysOfWeek: [1, 2, 3]
            })
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(mockInsert).toHaveBeenCalled();
    });

    it("GET /discounts/active - should filter active rules correctly", async () => {
        // Set fixed time: Monday (Day 1), 10:00 AM
        setSystemTime(new Date("2024-01-01T10:00:00"));

        const allRules = [
            { id: 1, name: "Always Active", isActive: true },
            { id: 2, name: "Monday Discount", isActive: true, daysOfWeek: [1], startTime: "09:00", endTime: "11:00" },
            { id: 3, name: "Tuesday Discount", isActive: true, daysOfWeek: [2] }, // Should fail day check
            { id: 4, name: "Expired Time", isActive: true, daysOfWeek: [1], startTime: "08:00", endTime: "09:00" }, // Should fail time check
            { id: 5, name: "Future Date", isActive: true, startDate: "2024-02-01" } // Should fail date check
        ];

        mockFindMany.mockResolvedValue(allRules);

        const req = new Request("http://localhost/discounts/active", {
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        // Should include ID 1 & 2 only
        expect(body.data).toHaveLength(2);
        expect(body.data.map((r: any) => r.id)).toContain(1);
        expect(body.data.map((r: any) => r.id)).toContain(2);

        // Cleanup system time
        setSystemTime();
    });

    it("DELETE /discounts/:id - should delete rule", async () => {
        const req = new Request("http://localhost/discounts/1", {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        expect(res.status).toBe(200);
        expect(mockDelete).toHaveBeenCalled();
    });
});
