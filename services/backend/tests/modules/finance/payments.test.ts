import { describe, expect, it, mock, beforeEach } from "bun:test";
import { createTestApp } from "../../test-utils";

// Mock DB
const mockInsert = mock();
const mockUpdate = mock();
const mockFindMany = mock();
const mockValues = mock();
const mockReturning = mock();
const mockSet = mock();
const mockWhere = mock();

const mockDb: any = {
    insert: mockInsert,
    update: mockUpdate,
    query: {
        payments: { findMany: mockFindMany },
        users: { findFirst: mock(() => Promise.resolve({ id: "admin-1", isActive: true, hotelId: 1 })) }
    }
};
mockDb.transaction = (cb: any) => cb(mockDb);

mock.module("../../../src/db", () => ({
    db: mockDb
}));

// Mock Schema
import { mockedSchema } from "../../mocks/schema";
mock.module("../../../src/db/schema", () => mockedSchema);

// Mock Audit Service
const mockLogAction = mock();
mock.module("../../../src/modules/system/audit.service", () => ({
    logAction: mockLogAction,
    AuditService: {
        log: mockLogAction
    }
}));

import { paymentsController } from "../../../src/modules/finance/payments.controller";

describe("Finance - Payments Controller", () => {
    let app: any;
    let validToken: string;

    beforeEach(async () => {
        mockInsert.mockReset();
        mockUpdate.mockReset();
        mockFindMany.mockReset();
        mockValues.mockReset();
        mockReturning.mockReset();
        mockSet.mockReset();
        mockWhere.mockReset();
        mockLogAction.mockReset();

        // Setup chains
        mockInsert.mockReturnValue({ values: mockValues });
        mockValues.mockReturnValue({ returning: mockReturning });

        mockUpdate.mockReturnValue({ set: mockSet });
        mockSet.mockReturnValue({ where: mockWhere });

        app = createTestApp(paymentsController);

        const { Elysia } = await import("elysia");
        const { jwt } = await import("@elysiajs/jwt");
        const { config } = await import("../../../src/config/env");
        const jwtApp = new Elysia().use(jwt({ name: 'jwt', secret: config.jwt.secret }));

        validToken = await (jwtApp as any).decorator.jwt.sign({
            id: "staff-1",
            hotelId: 1,
            type: "HOTEL_STAFF",
            permissions: ["FINANCE.RECORD_PAYMENT", "FINANCE.VIEW_RECORDS"]
        });
    });

    it("POST /finance/payments - should record payment and update booking", async () => {
        mockReturning.mockReturnValue([{ id: 1, amount: "1000" }]);

        const req = new Request("http://localhost/finance/payments", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${validToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                bookingId: "book-1",
                amount: 1000,
                paymentMethod: "CASH",
                notes: "Deposit"
            })
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        if (res.status !== 200) {
            console.log("Payment Error:", JSON.stringify(body, null, 2));
        }

        expect(res.status).toBe(200);
        expect(mockInsert).toHaveBeenCalled();
        expect(mockUpdate).toHaveBeenCalled(); // Should update booking invalidation
        expect(mockLogAction).toHaveBeenCalled();
    });

    it("GET /finance/payments - should list payments", async () => {
        mockFindMany.mockResolvedValue([
            { id: 1, amount: "1000", recordedBy: { fullName: "Staff" } }
        ]);

        const req = new Request("http://localhost/finance/payments", {
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data).toHaveLength(1);
    });
});
