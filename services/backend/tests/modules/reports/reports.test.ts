import { describe, expect, it, mock, beforeEach } from "bun:test";
import { createTestApp } from "../../test-utils";

// Mock DB
const mockFindMany = mock();
const mockSelect = mock();
const mockFrom = mock();
const mockWhere = mock();
const mockGroupBy = mock();

mock.module("../../../src/db", () => ({
    db: {
        query: {
            bookings: { findMany: mockFindMany },
            guestProfiles: { findMany: mockFindMany },
            users: { findFirst: mock(() => Promise.resolve({ id: "admin-1", isActive: true, hotelId: 1 })) }
        },
        select: mockSelect
    }
}));

// Mock schema
import { mockedSchema } from "../../mocks/schema";
mock.module("../../../src/db/schema", () => mockedSchema);

// Import controller
import { reportsController } from "../../../src/modules/reports/reports.controller";

describe("Reports Controller", () => {
    let app: any;
    let validToken: string;

    beforeEach(async () => {
        mockFindMany.mockReset();
        mockSelect.mockReset();
        mockFrom.mockReset();
        mockWhere.mockReset();
        mockGroupBy.mockReset();

        // Setup select chain
        mockSelect.mockReturnValue({ from: mockFrom });
        mockFrom.mockReturnValue({ where: mockWhere });

        // Mock where to be thenable (for queries ending at where) AND chainable (for groupBy)
        const mockWhereChain = {
            groupBy: mockGroupBy,
            // Thenable implementation for await
            then: (resolve: any) => resolve([{ count: 0 }])
        };
        mockWhere.mockReturnValue(mockWhereChain);

        // Default groupBy resolve
        mockGroupBy.mockResolvedValue([]);

        app = createTestApp(reportsController);

        const { Elysia } = await import("elysia");
        const { jwt } = await import("@elysiajs/jwt");
        const { config } = await import("../../../src/config/env");
        const jwtApp = new Elysia().use(jwt({ name: 'jwt', secret: config.jwt.secret }));

        validToken = await (jwtApp as any).decorator.jwt.sign({
            id: "admin-1",
            hotelId: 1,
            type: "HOTEL_STAFF",
            permissions: ["ANALYTICS.VIEW_FINANCIALS", "BOOKINGS.READ"]
        });
    });

    it("GET /reports/arrivals - should return arrivals list", async () => {
        const mockArrivals = [
            { id: "b1", guestName: "John", room: { number: "101" } }
        ];
        mockFindMany.mockResolvedValue(mockArrivals);

        const req = new Request("http://localhost/reports/arrivals", {
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data).toHaveLength(1);
        expect(body.data[0].guestName).toBe("John");
    });

    it("GET /reports/dsr - should return revenue data", async () => {
        // Mock revenue query
        const mockRevenue = [{ method: "CASH", total: "1000" }];
        mockGroupBy.mockResolvedValue(mockRevenue);

        // Mock occupancy query
        const mockOccupancy = [{ count: 5 }];

        // Mock where to be thenable (for queries ending at where) AND chainable (for groupBy)
        const mockWhereChain = {
            groupBy: mockGroupBy,
            // Thenable implementation for await (Occupancy)
            then: (resolve: any) => resolve(mockOccupancy)
        };
        mockWhere.mockReturnValue(mockWhereChain);

        const req = new Request("http://localhost/reports/dsr", {
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);

        // Debug
        if (res.status !== 200) {
            console.log(await res.text());
        }

        expect(res.status).toBe(200);
        const body = await res.json() as any;

        expect(body.data.totalRevenue).toBe(1000);
        expect(body.data.occupancy).toBe(5);
    });
});
