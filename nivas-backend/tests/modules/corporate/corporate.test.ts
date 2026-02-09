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
            corporateAccounts: { findMany: mockFindMany },
            travelAgents: { findMany: mockFindMany },
            users: { findFirst: mock(() => Promise.resolve({ id: "admin-1", isActive: true, hotelId: 1 })) }
        },
        insert: mockInsert
    }
}));

// Mock Schema
mock.module("../../../src/db/schema", () => ({
    corporateAccounts: { name: "corporate_accounts" },
    travelAgents: { name: "travel_agents" }
}));

import { corporateController } from "../../../src/modules/corporate/corporate.controller";

describe("CRM - Corporate Controller", () => {
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

        app = createTestApp(corporateController);

        const { Elysia } = await import("elysia");
        const { jwt } = await import("@elysiajs/jwt");
        const { config } = await import("../../../src/config/env");
        const jwtApp = new Elysia().use(jwt({ name: 'jwt', secret: config.jwt.secret }));

        validToken = await (jwtApp as any).decorator.jwt.sign({
            id: "admin-1",
            hotelId: 1,
            type: "HOTEL_STAFF",
            permissions: ["CRM.MANAGE_GUESTS"]
        });
    });

    it("GET /crm/companies - should list companies", async () => {
        mockFindMany.mockResolvedValue([
            { id: 1, companyName: "Acme Corp" }
        ]);

        const req = new Request("http://localhost/crm/companies", {
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data).toHaveLength(1);
        expect(body.data[0].companyName).toBe("Acme Corp");
    });

    it("POST /crm/companies - should create company", async () => {
        mockReturning.mockReturnValue([{ id: 1, companyName: "Acme Corp" }]);

        const req = new Request("http://localhost/crm/companies", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${validToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                companyName: "Acme Corp",
                contactPerson: "John Smith",
                email: "john@acme.com"
            })
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(mockInsert).toHaveBeenCalled();
    });

    it("GET /crm/agents - should list travel agents", async () => {
        mockFindMany.mockResolvedValue([
            { id: 1, name: "Agent Smith" }
        ]);

        const req = new Request("http://localhost/crm/agents", {
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        expect(res.status).toBe(200);
    });

    it("POST /crm/agents - should create travel agent", async () => {
        mockReturning.mockReturnValue([{ id: 1, name: "Agent Smith" }]);

        const req = new Request("http://localhost/crm/agents", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${validToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: "Agent Smith",
                agencyName: "Top Travel",
                commissionRate: 0.15
            })
        });

        const res = await app.handle(req);
        expect(res.status).toBe(200);
        expect(mockInsert).toHaveBeenCalled();
    });
});
