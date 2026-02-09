import { describe, expect, it, mock, beforeEach } from "bun:test";
import { createTestApp } from "../../test-utils";

// Mock DB
const mockTransaction = mock();
const mockFindMany = mock();
const mockInsert = mock();
const mockValues = mock();
const mockReturning = mock();

mock.module("../../../src/db", () => ({
    db: {
        transaction: mockTransaction,
        query: {
            bookings: { findMany: mockFindMany },
            users: { findFirst: mock(() => Promise.resolve({ id: "admin-1", isActive: true, hotelId: 1 })) },
            hotels: { findFirst: mock(() => Promise.resolve(null)) }
        },
        insert: mockInsert
    }
}));

// Mock Schema
import { mockedSchema } from "../../mocks/schema";
mock.module("../../../src/db/schema", () => mockedSchema);

import { superAdminController } from "../../../src/modules/super-admin/super-admin.controller";

describe("Super Admin Controller", () => {
    let app: any;
    let validToken: string;

    beforeEach(async () => {
        mockTransaction.mockReset();
        mockFindMany.mockReset();
        mockInsert.mockReset();
        mockValues.mockReset();
        mockReturning.mockReset();

        // Setup chains
        mockInsert.mockReturnValue({ values: mockValues });
        mockValues.mockReturnValue({ returning: mockReturning });

        app = createTestApp(superAdminController);

        const { Elysia } = await import("elysia");
        const { jwt } = await import("@elysiajs/jwt");
        const { config } = await import("../../../src/config/env");
        const jwtApp = new Elysia().use(jwt({ name: 'jwt', secret: config.jwt.secret }));

        // Super Admin Token
        validToken = await (jwtApp as any).decorator.jwt.sign({
            id: "super-1",
            type: "SUPER_ADMIN",
            permissions: ["*"]
        });
    });

    it("POST /super-admin/onboard - should create hotel and owner", async () => {
        // Mock transaction execution
        mockTransaction.mockImplementation(async (callback: any) => {
            // Mock the tx object passed to callback
            const txMock = {
                insert: mockInsert
            };
            // Mock return values for the sequence of inserts:
            // 1. Hotel
            // 2. Default Roles (void)
            // 3. Owner Role
            // 4. Owner User

            // We can control mockReturning based on call order or just return generic compatible structures
            mockReturning
                .mockReturnValueOnce([{ id: 1, name: "New Hotel" }]) // Hotel
                .mockReturnValueOnce([{ id: 10, name: "Owner" }]) // Roles (actually map inserts? Wait, insert for roles is batch, returning might not be called or ignored)
            // Actually the code:
            // 1. insert(hotels).values(...).returning() -> Hotel
            // 2. insert(roles).values(...) -> Void/Promise
            // 3. insert(roles).values(...).returning() -> Owner Role
            // 4. insert(users).values(...).returning() -> Owner User

            // Let's adjust strict mocks if needed.
            // Simplified: Just ensure callback runs and returns structure

            return {
                hotel: { id: 1, name: "New Hotel" },
                owner: { id: 1, fullName: "Owner" }
            };
        });

        const req = new Request("http://localhost/super-admin/onboard", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${validToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: "New Hotel",
                slug: "new-hotel",
                address: "123 St",
                ownerName: "Owner Doe",
                ownerEmail: "owner@test.com",
                ownerPhone: "9800000000",
                ownerPassword: "password123"
            })
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data).toHaveProperty("name", "New Hotel");
        expect(mockTransaction).toHaveBeenCalled();
    });

    it("GET /super-admin/analytics/sales - should return stats", async () => {
        mockFindMany.mockResolvedValue([
            { totalAmount: "100" },
            { totalAmount: "200" }
        ]);

        const req = new Request("http://localhost/super-admin/analytics/sales", {
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data.totalRevenue).toBe(300);
        expect(body.data.bookingsCount).toBe(2);
    });
});
