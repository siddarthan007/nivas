import { describe, expect, it, mock, beforeEach } from "bun:test";
import { createTestApp } from "../../test-utils";

// Mock DB with Universal Builder Pattern
const mockBuilder: any = {};
let responseQueue: any[] = [];

// The builder must be "thenable" to be awaited
mockBuilder.then = (resolve: any, reject: any) => {
    const response = responseQueue.shift();
    if (response instanceof Error) {
        if (reject) reject(response);
        return Promise.reject(response);
    }
    if (resolve) resolve(response || []);
    return Promise.resolve(response || []);
};

// Chain methods return the builder itself
mockBuilder.from = mock(() => mockBuilder);
mockBuilder.where = mock(() => mockBuilder);
mockBuilder.groupBy = mock(() => mockBuilder);
mockBuilder.orderBy = mock(() => mockBuilder);
mockBuilder.limit = mock(() => mockBuilder);

const mockSelect = mock(() => mockBuilder);

mock.module("../../../src/db", () => ({
    db: {
        select: mockSelect,
        // Mock query.nightAudits for occupancy endpoint
        query: {
            nightAudits: { findMany: mock() },
            users: { findFirst: mock(() => Promise.resolve({ id: 'admin-1', isActive: true, hotelId: 1 })) }
        }
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

import { db } from "../../../src/db"; // Import to access query mocks

describe("Analytics Controller", () => {
    let app: any;
    let validToken: string;

    beforeEach(async () => {
        responseQueue = []; // Clear queue
        mockSelect.mockClear();
        mockBuilder.from.mockClear();
        mockBuilder.where.mockClear();
        mockBuilder.groupBy.mockClear();
        mockBuilder.orderBy.mockClear();
        (db.query.nightAudits.findMany as any).mockReset();

        const { analyticsController } = await import("../../../src/modules/analytics/analytics.controller");
        app = createTestApp(analyticsController);

        const { Elysia } = await import("elysia");
        const { jwt } = await import("@elysiajs/jwt");
        const { config } = await import("../../../src/config/env");
        const jwtApp = new Elysia().use(jwt({ name: 'jwt', secret: config.jwt.secret }));

        validToken = await (jwtApp as any).decorator.jwt.sign({
            id: "admin-1",
            hotelId: 1,
            type: "HOTEL_STAFF",
            permissions: ["ANALYTICS.VIEW_OPERATIONS", "ANALYTICS.VIEW_FINANCIALS"]
        });
    });

    it("GET /analytics/dashboard - should return dashboard stats", async () => {
        // Queue responses in order of controller execution
        responseQueue = [
            [{ value: 5 }], // activeBookings
            [{ value: 2 }], // pendingOrders
            [{ value: "1500.50" }], // todayRevenue
            [{ status: "OCCUPIED", count: 5 }, { status: "VACANT", count: 10 }], // roomStatusBreakdown
            [{ value: 15 }], // totalRooms
            [{ value: 3 }], // pendingHousekeeping
            [{ value: 1 }], // checkIns
            [{ value: 0 }]  // checkOuts
        ];

        const req = new Request("http://localhost/analytics/dashboard", {
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        if (res.status !== 200) console.log(body);

        expect(res.status).toBe(200);
        expect(body.data.realtime.activeGuests).toBe(5);
        expect(body.data.realtime.occupancyRate).toBe(33.3);
        expect(body.data.today.revenue).toBe(1500.5);
    });

    it("GET /analytics/revenue - should return revenue metrics", async () => {
        responseQueue = [
            [{ date: "2024-01-01", total: "1000", count: 10 }], // dailyRevenue
            [{ method: "CASH", total: "500", count: 5 }], // revenueByMethod
            [{ value: "5000" }], // periodTotal
            [{ value: "4000" }]  // prevPeriodTotal
        ];

        const req = new Request("http://localhost/analytics/revenue", {
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data.summary.totalRevenue).toBe(5000);
        expect(body.data.summary.trend).toBe("UP");
    });

    it("GET /analytics/occupancy - should return occupancy stats", async () => {
        // This endpoint uses db.query.nightAudits AND db.select(rooms)

        // Mock nightAudit query
        (db.query.nightAudits.findMany as any).mockResolvedValue([
            { auditDate: "2024-01-01", occupancyPercentage: "80.0", totalRoomRevenue: "5000", totalFnbRevenue: "1000" }
        ]);

        // Queue responses for db.select calls
        responseQueue = [
            [{ type: "Standard", total: 10, occupied: 8 }] // roomTypeBreakdown
        ];

        const req = new Request("http://localhost/analytics/occupancy", {
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data.averageOccupancy).toBe("80.0");
        expect(body.data.currentOccupancy.Standard.occupied).toBe(8);
    });
});
