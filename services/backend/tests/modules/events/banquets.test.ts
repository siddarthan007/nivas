import { describe, expect, it, mock, beforeEach } from "bun:test";
import { createTestApp } from "../../test-utils";

// 1. Mock DB
const mockFindMany = mock();
const mockFindFirst = mock();
const mockInsert = mock();
const mockUpdate = mock();
const mockValues = mock();
const mockReturning = mock();
const mockSet = mock();
const mockWhere = mock();

mock.module("../../../src/db", () => ({
    db: {
        query: {
            banquets: { findMany: mockFindMany, findFirst: mockFindFirst },
            banquetBookings: { findMany: mockFindMany, findFirst: mockFindFirst },
            users: { findFirst: mock(() => Promise.resolve({ id: "admin-1", isActive: true, hotelId: 1 })) }
        },
        insert: mockInsert,
        update: mockUpdate
    }
}));

// 2. Mock Schema
mock.module("../../../src/db/schema", () => ({
    banquets: { id: 'id', hotelId: 'hotelId' },
    banquetBookings: { id: 'id', hotelId: 'hotelId', banquetId: 'banquetId', eventDate: 'eventDate', status: 'status' }
}));

// Import controller AFTER mocking
import { banquetsController } from "../../../src/modules/events/banquets.controller";

describe("Events - Banquets Controller", () => {
    let app: any;
    let validToken: string;

    beforeEach(async () => {
        // Reset all mocks
        mockFindMany.mockReset();
        mockFindFirst.mockReset();
        mockInsert.mockReset();
        mockUpdate.mockReset();
        mockValues.mockReset();
        mockReturning.mockReset();
        mockSet.mockReset();
        mockWhere.mockReset();

        // Setup insert chain
        mockInsert.mockReturnValue({ values: mockValues });
        mockValues.mockReturnValue({ returning: mockReturning });

        // Setup update chain
        mockUpdate.mockReturnValue({ set: mockSet });
        mockSet.mockReturnValue({ where: mockWhere });
        mockWhere.mockReturnValue({ returning: mockReturning });

        app = createTestApp(banquetsController);

        // Generate a valid token
        const { Elysia } = await import("elysia");
        const { jwt } = await import("@elysiajs/jwt");
        const { config } = await import("../../../src/config/env");
        const jwtApp = new Elysia().use(jwt({ name: 'jwt', secret: config.jwt.secret }));

        validToken = await (jwtApp as any).decorator.jwt.sign({
            id: "admin-1",
            hotelId: 1,
            type: "HOTEL_STAFF",
            permissions: ["BANQUETS.CREATE", "BANQUETS.VIEW", "BANQUETS.UPDATE"]
        });
    });

    it("POST /banquets/venues - should create venue", async () => {
        mockReturning.mockResolvedValue([{ id: 1, name: "Grand Hall" }]);

        const req = new Request("http://localhost/banquets/venues", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${validToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: "Grand Hall",
                capacity: 500,
                area: "5000 sqft"
            })
        });

        const res = await app.handle(req);
        expect(res.status).toBe(200);
        expect(mockInsert).toHaveBeenCalled();
    });

    it("POST /banquets/bookings - should create booking", async () => {
        mockReturning.mockResolvedValue([{ id: 1, eventName: "Wedding" }]);

        const req = new Request("http://localhost/banquets/bookings", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${validToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                banquetId: 1,
                eventName: "Wedding",
                organizerName: "Jane Doe",
                organizerPhone: "9800000000",
                eventDate: "2024-12-25",
                startTime: "18:00",
                endTime: "22:00",
                expectedGuests: 200
            })
        });

        const res = await app.handle(req);
        expect(res.status).toBe(200);
        expect(mockInsert).toHaveBeenCalled();
    });

    it("GET /banquets/venues/:id/availability - should detect conflict", async () => {
        // Mock existing booking that overlaps
        mockFindMany.mockResolvedValue([
            { id: 1, startTime: "18:00", endTime: "22:00", status: "CONFIRMED" }
        ]);

        const req = new Request("http://localhost/banquets/venues/1/availability?date=2024-12-25&startTime=20:00&endTime=23:00", {
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data.isAvailable).toBe(false);
    });

    it("GET /banquets/venues/:id/availability - should allow non-overlapping", async () => {
        // Mock existing booking that doesn't overlap
        mockFindMany.mockResolvedValue([
            { id: 1, startTime: "18:00", endTime: "22:00", status: "CONFIRMED" }
        ]);

        const req = new Request("http://localhost/banquets/venues/1/availability?date=2024-12-25&startTime=14:00&endTime=17:00", {
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data.isAvailable).toBe(true);
    });
});
