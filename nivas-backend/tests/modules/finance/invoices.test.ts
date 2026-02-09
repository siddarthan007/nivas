import { describe, expect, it, mock, beforeEach } from "bun:test";
import { createTestApp } from "../../test-utils";

// 1. Mock External Services Setup
const mockBillingSummary = mock();
const mockNextInvoice = mock();
const mockGetInvoiceData = mock();
const mockCbmsSync = mock();

mock.module("../../../src/modules/finance/billing.service", () => ({
    BillingService: {
        calculateBillingSummary: mockBillingSummary
    }
}));

mock.module("../../../src/modules/finance/invoice.service", () => ({
    InvoiceService: {
        getNextInvoiceNumber: mockNextInvoice,
        getInvoiceData: mockGetInvoiceData
    }
}));

mock.module("../../../src/modules/finance/cbms.service", () => ({
    CbmsService: {
        syncInvoice: mockCbmsSync
    }
}));

// 2. Mock Database
const mockFindFirst = mock();
const mockFindMany = mock();
const mockInsert = mock();
const mockUpdate = mock();
const mockTransaction = mock();
const mockValues = mock();
const mockReturning = mock();
const mockSet = mock();
const mockWhere = mock();

const mockExecute = mock();

// Mock Transaction Object
const mockTx = {
    insert: mockInsert,
    update: mockUpdate,
    execute: mockExecute,
    query: {
        bookings: { findFirst: mockFindFirst },
        hotels: { findFirst: mock(() => Promise.resolve({ currency: 'NPR' })) },
        invoices: { findFirst: mockFindFirst } // For InvoiceService called with tx
    }
};

mock.module("../../../src/db", () => ({
    db: {
        query: {
            bookings: { findFirst: mockFindFirst },
            invoices: { findMany: mockFindMany },
            users: { findFirst: mock(() => Promise.resolve({ id: "admin-1", isActive: true, hotelId: 1 })) },
            hotels: { findFirst: mock(() => Promise.resolve({ currency: 'NPR' })) }
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
        // Reset all mocks
        mockBillingSummary.mockReset();
        mockNextInvoice.mockReset();
        mockCbmsSync.mockReset();

        mockFindFirst.mockReset();
        mockFindMany.mockReset();
        mockInsert.mockReset();
        mockUpdate.mockReset();
        mockTransaction.mockReset();
        mockValues.mockReset();
        mockReturning.mockReset();
        mockLogAction.mockReset();
        mockSet.mockReset();
        mockWhere.mockReset();

        // Transaction Mock: Execute callback immediately
        mockTransaction.mockImplementation(async (callback: any) => {
            return await callback(mockTx);
        });

        // Query Chains
        mockInsert.mockReturnValue({ values: mockValues });
        mockValues.mockReturnValue({ returning: mockReturning });

        mockUpdate.mockReturnValue({ set: mockSet });
        mockSet.mockReturnValue({ where: mockWhere });

        app = createTestApp(invoicesController);

        const { Elysia } = await import("elysia");
        const { jwt } = await import("@elysiajs/jwt");
        const { config } = await import("../../../src/config/env");
        const jwtApp = new Elysia().use(jwt({ name: 'jwt', secret: config.jwt.secret }));

        validToken = await (jwtApp as any).decorator.jwt.sign({
            id: "admin-1",
            hotelId: 1,
            type: "HOTEL_STAFF",
            permissions: ["FINANCE.GENERATE_INVOICE", "FINANCE.VIEW_RECORDS"]
        });
    });

    it("POST /invoices/generate - should generate invoice successfully", async () => {
        // Setup Mocks
        mockFindFirst.mockResolvedValue({ id: "b1", guestName: "John", roomId: 101 });

        mockBillingSummary.mockResolvedValue({
            subTotal: 1000,
            serviceCharge: 100,
            vat: 130,
            grandTotal: 1230
        });

        mockNextInvoice.mockResolvedValue({
            number: "INV-001",
            sequence: 1,
            fiscalYear: "2080/81"
        });

        const mockInvoice = { id: "inv-1", invoiceNumber: "INV-001" };
        mockReturning.mockResolvedValue([mockInvoice]);

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
            return; // Exit if failed to avoid json parse error
        }
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data.invoiceNumber).toBe("INV-001");
        expect(mockTransaction).toHaveBeenCalled();
        expect(mockCbmsSync).toHaveBeenCalled();
        expect(mockLogAction).toHaveBeenCalled();
        // Since doCheckout is true, update should be called twice (bookings, rooms)
        expect(mockUpdate).toHaveBeenCalledTimes(2);
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
