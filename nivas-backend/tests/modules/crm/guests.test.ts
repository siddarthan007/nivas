import { describe, expect, it, mock, beforeEach } from "bun:test";
import { createTestApp } from "../../test-utils";

// Mock DB
const mockFindMany = mock();
const mockFindFirst = mock();
const mockUpdate = mock();
const mockValues = mock();
const mockReturning = mock();
const mockSet = mock();
const mockWhere = mock();

mock.module("../../../src/db", () => ({
    db: {
        query: {
            guestProfiles: { findMany: mockFindMany, findFirst: mockFindFirst },
            bookings: { findMany: mockFindMany },
            users: { findFirst: mock(() => Promise.resolve({ id: "admin-1", isActive: true, hotelId: 1 })) }
        },
        update: mockUpdate
    }
}));

// Mock Schema
import { mockedSchema } from "../../mocks/schema";
mock.module("../../../src/db/schema", () => mockedSchema);

import { guestsController } from "../../../src/modules/crm/guests.controller";

describe("CRM - Guests Controller", () => {
    let app: any;
    let validToken: string;

    beforeEach(async () => {
        mockFindMany.mockReset();
        mockFindFirst.mockReset();
        mockUpdate.mockReset();
        mockValues.mockReset();
        mockReturning.mockReset();
        mockSet.mockReset();
        mockWhere.mockReset();

        // Setup chains
        mockUpdate.mockReturnValue({ set: mockSet });
        mockSet.mockReturnValue({ where: mockWhere });
        mockWhere.mockReturnValue({ returning: mockReturning });

        app = createTestApp(guestsController);

        const { Elysia } = await import("elysia");
        const { jwt } = await import("@elysiajs/jwt");
        const { config } = await import("../../../src/config/env");
        const jwtApp = new Elysia().use(jwt({ name: 'jwt', secret: config.jwt.secret }));

        validToken = await (jwtApp as any).decorator.jwt.sign({
            id: "admin-1",
            hotelId: 1,
            type: "HOTEL_STAFF",
            permissions: ["GUESTS.VIEW_DETAILS", "GUESTS.CHECK_IN"]
        });
    });

    it("GET /guests - should list guests", async () => {
        mockFindMany.mockResolvedValue([
            { id: "guest-1", fullName: "John Doe", phone: "9800000000" }
        ]);

        const req = new Request("http://localhost/guests", {
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data).toHaveLength(1);
        expect(mockFindMany).toHaveBeenCalled();
    });

    it("GET /guests/:id/history - should return history", async () => {
        // Mock Guest finding
        mockFindFirst.mockResolvedValue({
            id: "guest-1",
            fullName: "John Doe",
            phone: "9800000000"
        });

        // Mock Bookings finding
        mockFindMany.mockResolvedValue([
            { id: "bk-1", status: "CHECKED_OUT" }
        ]);

        const req = new Request("http://localhost/guests/guest-1/history", {
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data.profile.fullName).toBe("John Doe");
        expect(body.data.history).toHaveLength(1);
    });

    it("PATCH /guests/:id - should update profile", async () => {
        mockReturning.mockReturnValue([{
            id: "guest-1",
            isVip: true
        }]);

        const req = new Request("http://localhost/guests/guest-1", {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${validToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ isVip: true })
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data.isVip).toBe(true);
        expect(mockUpdate).toHaveBeenCalled();
    });
});
