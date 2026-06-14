import { describe, expect, it, mock, beforeEach } from "bun:test";
import { createTestApp } from "../../test-utils";

// 1. Mock External Services Setup
const mockBillingSummary = mock();
const mockGenerateInvoice = mock();
const mockGetInvoiceData = mock();
const mockCbmsSync = mock();

mock.module("../../../src/modules/finance/billing.service", () => ({
    BillingService: {
        calculateBillingSummary: mockBillingSummary
    }
}));

mock.module("../../../src/modules/finance/invoice.service", () => ({
    InvoiceService: {
        generateInvoice: mockGenerateInvoice,
        getInvoiceData: mockGetInvoiceData
    }
}));

mock.module("../../../src/modules/finance/cbms.service", () => ({
    CbmsService: {
        syncInvoice: mockCbmsSync
    }
}));

// 2. Mock Database
const mockFindMany = mock();
const mockTransaction = mock();

mock.module("../../../src/db", () => ({
    db: {
        query: {
            invoices: { findMany: mockFindMany },
            users: {
                findFirst: mock(() => Promise.resolve({
                    id: "admin-1",
                    isActive: true,
                    hotelId: 1,
                    userType: "HOTEL_STAFF",
                    role: { name: "Accountant", permissions: ['*'] }
                }))
            }
        },
        transaction: mockTransaction
    }
}));

// Mock Schema
import { mockedSchema } from "../../mocks/schema";
mock.module("../../../src/db/schema", () => mockedSchema);

// Mock Log Action
const mockLogAction = mock();
mock.module("../../../src/modules/system/audit.service", () => ({
    logAction: mockLogAction
}));

// 3. Import Controller
import { invoicesController } from "../../../src/modules/finance/invoices.controller";

describe("Finance - Invoices Controller", () => {
    let app: any;
    let validToken: string;

    beforeEach(async () => {
        mockBillingSummary.mockReset();
        mockGenerateInvoice.mockReset();
        mockCbmsSync.mockReset();
        mockFindMany.mockReset();
        mockTransaction.mockReset();
        mockLogAction.mockReset();

        app = createTestApp(invoicesController);

        const { Elysia } = await import("elysia");
        const { jwt } = await import("@elysiajs/jwt");
        const { config } = await import("../../../src/config/env");
        const jwtApp = new Elysia().use(jwt({ name: 'jwt', secret: config.jwt.secret }));

        validToken = await (jwtApp as any).decorator.jwt.sign({
            id: "admin-1",
            hotelId: 1,
            type: "HOTEL_STAFF",
            permissions: ["*"]
        });
    });

    it("POST /invoices/generate - should generate invoice successfully", async () => {
        const mockInvoice = { id: "inv-1", invoiceNumber: "INV-001" };
        mockGenerateInvoice.mockResolvedValue({
            invoice: mockInvoice,
            grandTotal: 1230
        });
        mockCbmsSync.mockResolvedValue({ status: "success" });

        const req = new Request("http://localhost/invoices/generate", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${validToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                bookingId: "b1",
                doCheckout: true
            })
        });

        const res = await app.handle(req);
        if (res.status !== 200) {
            console.log(await res.text());
            return;
        }
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data.invoiceNumber).toBe("INV-001");
        expect(mockGenerateInvoice).toHaveBeenCalled();
        expect(mockCbmsSync).toHaveBeenCalled();
        expect(mockLogAction).toHaveBeenCalled();
    });

    it("GET /invoices - should list invoices", async () => {
        mockFindMany.mockResolvedValue([
            { id: "inv-1", invoiceNumber: "INV-001", grandTotal: "1230" }
        ]);

        const req = new Request("http://localhost/invoices", {
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data).toHaveLength(1);
    });
});
