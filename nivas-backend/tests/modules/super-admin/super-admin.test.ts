import { describe, expect, it, mock, beforeEach } from "bun:test";
import { createTestApp } from "../../test-utils";

const mockTransaction = mock();
const mockInsert = mock();
const mockValues = mock();
const mockReturning = mock();
const mockHotelFindMany = mock();
const mockSubscriptionPaymentsFindMany = mock();
const mockSubscriptionsFindMany = mock();

mock.module("../../../src/db", () => ({
    db: {
        transaction: mockTransaction,
        query: {
            users: {
                findFirst: mock(() => Promise.resolve({
                    id: "super-1",
                    isActive: true,
                    hotelId: null,
                    userType: "SUPER_ADMIN",
                    role: { name: "Super Admin", permissions: ['*'] }
                }))
            },
            hotels: {
                findFirst: mock(() => Promise.resolve(null)),
                findMany: mockHotelFindMany
            },
            subscriptionPayments: {
                findMany: mockSubscriptionPaymentsFindMany
            },
            subscriptions: {
                findMany: mockSubscriptionsFindMany
            }
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
        mockInsert.mockReset();
        mockValues.mockReset();
        mockReturning.mockReset();
        mockHotelFindMany.mockReset();
        mockSubscriptionPaymentsFindMany.mockReset();
        mockSubscriptionsFindMany.mockReset();

        mockInsert.mockReturnValue({ values: mockValues });
        mockValues.mockReturnValue({ returning: mockReturning });

        app = createTestApp(superAdminController);

        const { Elysia } = await import("elysia");
        const { jwt } = await import("@elysiajs/jwt");
        const { config } = await import("../../../src/config/env");
        const jwtApp = new Elysia().use(jwt({ name: 'jwt', secret: config.jwt.secret }));

        validToken = await (jwtApp as any).decorator.jwt.sign({
            id: "super-1",
            type: "SUPER_ADMIN",
            permissions: ["*"]
        });
    });

    it("POST /super-admin/onboard - should create hotel and owner", async () => {
        mockTransaction.mockImplementation(async () => ({
            hotel: { id: 1, name: "New Hotel" },
            owner: { id: 1, fullName: "Owner" }
        }));

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
        mockSubscriptionPaymentsFindMany.mockResolvedValue([
            { amount: "100", createdAt: new Date("2026-01-10T00:00:00.000Z") },
            { amount: "200", createdAt: new Date("2026-02-10T00:00:00.000Z") }
        ]);
        mockHotelFindMany.mockResolvedValue([
            { id: 1, isActive: true, createdAt: new Date("2026-01-01T00:00:00.000Z") },
            { id: 2, isActive: false, createdAt: new Date("2026-02-01T00:00:00.000Z") }
        ]);
        mockSubscriptionsFindMany.mockResolvedValue([
            { id: "sub-1", status: "ACTIVE" }
        ]);

        const req = new Request("http://localhost/super-admin/analytics/sales", {
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data.totalRevenue).toBe(300);
        expect(body.data.paymentsCount).toBe(2);
        expect(body.data.activeSubscriptions).toBe(1);
    });
});
