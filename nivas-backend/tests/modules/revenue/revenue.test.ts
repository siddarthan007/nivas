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
            pricingRules: { findMany: mockFindMany },
            users: { findFirst: mock(() => Promise.resolve({ id: "admin-1", isActive: true, hotelId: 1 })) },
            hotels: { findFirst: mock(() => Promise.resolve({ timezone: 'Asia/Kathmandu' })) }
        },
        insert: mockInsert
    }
}));

// Mock Schema
import { mockedSchema } from "../../mocks/schema";
mock.module("../../../src/db/schema", () => mockedSchema);

// Mock Drizzle ORM
mock.module("drizzle-orm", () => {
    const mockFn = (...args: any[]) => ({ type: 'mock', args });
    return {
        eq: (col: any, val: any) => ({ type: 'eq', col, val }),
        and: (...args: any[]) => ({ type: 'and', args }),
        or: (...args: any[]) => ({ type: 'or', args }),
        desc: mockFn,
        asc: mockFn,
        sql: Object.assign((...args: any[]) => ({ type: 'sql', args }), { raw: mockFn, empty: mockFn, fromList: mockFn, append: mockFn }),
        count: mockFn,
        sum: mockFn,
        ne: mockFn,
        gt: mockFn,
        gte: mockFn,
        lt: mockFn,
        lte: mockFn,
        inArray: mockFn,
        notInArray: mockFn,
        isNull: mockFn,
        isNotNull: mockFn,
        between: mockFn,
        notBetween: mockFn,
        like: mockFn,
        ilike: mockFn,
        notLike: mockFn,
        notIlike: mockFn,
        exists: mockFn,
        notExists: mockFn,
        aliasedTable: mockFn,
        getTableColumns: mockFn,
        getTableName: mockFn,
        relations: mockFn,
    };
});

describe("Revenue - Pricing Controller", () => {
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

        const { pricingController } = await import("../../../src/modules/revenue/pricing.controller");
        app = createTestApp(pricingController);

        const { Elysia } = await import("elysia");
        const { jwt } = await import("@elysiajs/jwt");
        const { config } = await import("../../../src/config/env");
        const jwtApp = new Elysia().use(jwt({ name: 'jwt', secret: config.jwt.secret }));

        validToken = await (jwtApp as any).decorator.jwt.sign({
            id: "admin-1",
            hotelId: 1,
            type: "HOTEL_STAFF",
            permissions: ["ANALYTICS.VIEW_FINANCIALS", "SYSTEM.MANAGE_SETTINGS"]
        });
    });

    it("POST /revenue/pricing/check-rate - should calculate rate with percentage rule", async () => {
        // Mock a percentage bump rule
        mockFindMany.mockResolvedValue([{
            name: "Weekend Surge",
            adjustmentType: "PERCENTAGE",
            adjustmentValue: "10"
            // Start/End date Logic is handled by DB query, we assume service gets the rule
        }]);

        const req = new Request("http://localhost/revenue/pricing/check-rate", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${validToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                baseRate: 1000,
                date: "2026-01-10"
            })
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        // 1000 + 10% = 1100
        expect(body.data.finalRate).toBe(1100);
        expect(body.data.appliedRules).toContain("Weekend Surge");
    });

    it("POST /revenue/pricing/check-rate - should calculate rate with flat rule", async () => {
        // Mock a flat discount rule
        // Note: Logic sums them up. 
        mockFindMany.mockResolvedValue([{
            name: "Direct Booking Discount",
            adjustmentType: "FLAT",
            adjustmentValue: "-200"
        }]);

        const req = new Request("http://localhost/revenue/pricing/check-rate", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${validToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                baseRate: 1000,
                date: "2026-01-10"
            })
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        // 1000 - 200 = 800
        expect(body.data.finalRate).toBe(800);
    });

    it("POST /revenue/pricing/rules - should create pricing rule", async () => {
        mockReturning.mockReturnValue([{ id: 1, name: "New Year Surge" }]);

        const req = new Request("http://localhost/revenue/pricing/rules", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${validToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: "New Year Surge",
                type: "SEASONAL",
                adjustmentType: "PERCENTAGE",
                adjustmentValue: 20,
                startDate: "2026-01-01",
                endDate: "2026-01-05"
            })
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        if (res.status !== 200) console.log(body);

        expect(res.status).toBe(200);
        expect(mockInsert).toHaveBeenCalled();
    });
});
