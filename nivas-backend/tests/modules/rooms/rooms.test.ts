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

const mockUserFind = mock();

mock.module("../../../src/db", () => ({
    db: {
        query: {
            rooms: { findMany: mockFindMany },
            users: { findFirst: mockUserFind }
        },
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete
    }
}));

// Mock Schema
import { mockedSchema } from "../../mocks/schema";
mock.module("../../../src/db/schema", () => mockedSchema);

import { roomsController } from "../../../src/modules/rooms/rooms.controller";

describe("Rooms Controller", () => {
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
        mockUserFind.mockReset();
        mockUserFind.mockResolvedValue({ id: 'admin-1', isActive: true, hotelId: 1 });

        // Setup chains
        mockInsert.mockReturnValue({ values: mockValues });
        mockValues.mockReturnValue({ returning: mockReturning });

        mockUpdate.mockReturnValue({ set: mockSet });
        mockSet.mockReturnValue({ where: mockWhere });
        mockWhere.mockReturnValue({ returning: mockReturning });

        mockDelete.mockReturnValue({ where: mockWhere });
        mockWhere.mockReturnValue({ returning: mockReturning });

        app = createTestApp(roomsController);

        const { Elysia } = await import("elysia");
        const { jwt } = await import("@elysiajs/jwt");
        const { config } = await import("../../../src/config/env");
        const jwtApp = new Elysia().use(jwt({ name: 'jwt', secret: config.jwt.secret }));

        validToken = await (jwtApp as any).decorator.jwt.sign({
            id: "admin-1",
            hotelId: 1,
            type: "HOTEL_STAFF",
            permissions: ["ROOMS.READ", "ROOMS.CREATE", "ROOMS.UPDATE", "ROOMS.DELETE"]
        });
    });

    it("GET /rooms - should list rooms", async () => {
        mockFindMany.mockResolvedValue([
            { id: 1, number: 101, type: "STANDARD" }
        ]);

        const req = new Request("http://localhost/rooms", {
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data).toHaveLength(1);
        expect(body.data[0].number).toBe(101);
    });

    it("POST /rooms - should create room", async () => {
        mockReturning.mockReturnValue([{ id: 1, number: 102 }]);

        const req = new Request("http://localhost/rooms", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${validToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                number: 102,
                type: "DELUXE",
                rate: 5000
            })
        });

        const res = await app.handle(req);

        expect(res.status).toBe(200);
        expect(mockInsert).toHaveBeenCalled();
    });

    it("POST /rooms/bulk - should create multiple rooms", async () => {
        mockReturning.mockReturnValue([{ id: 1 }, { id: 2 }]);

        const req = new Request("http://localhost/rooms/bulk", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${validToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify([
                { number: 103, type: "STANDARD" },
                { number: 104, type: "STANDARD" }
            ])
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data.count).toBe(2);
        expect(mockInsert).toHaveBeenCalled();
    });

    it("DELETE /rooms/:id - should delete room", async () => {
        mockReturning.mockReturnValue([{ id: 1 }]);

        const req = new Request("http://localhost/rooms/1", {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        expect(res.status).toBe(200);
        expect(mockDelete).toHaveBeenCalled();
    });
});
