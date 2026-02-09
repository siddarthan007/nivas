
import { describe, expect, it, mock, beforeEach } from "bun:test";
import { TallyService } from "../../../src/modules/finance/tally.service";
import { JobService } from "../../../src/modules/system/job.service";
import { db } from "../../../src/db";
import { NotificationChannelService } from "../../../src/modules/notifications/notification-channel.service";

// Mock DB
// Mock DB
const mockDb = {
    query: {
        bookings: { findMany: mock(() => Promise.resolve([] as any[])) },
        purchaseOrders: { findMany: mock(() => Promise.resolve([] as any[])) },
        payments: { findMany: mock(() => Promise.resolve([] as any[])) },
        backgroundJobs: { findMany: mock(() => Promise.resolve([] as any[])) },
        hotels: { findFirst: mock(() => Promise.resolve({ id: 1, name: "Test Hotel", slug: "test" } as any)) }
    },
    insert: mock(() => ({ values: mock(() => Promise.resolve()) })),
    update: mock(() => ({
        set: mock(() => ({
            where: mock(() => ({
                returning: mock(() => Promise.resolve([{ id: 'job-1', type: 'SEND_REVIEW_REQUEST', attempts: 0, payload: { hotelId: 1, guestName: 'John', guestPhone: '9800000000' } }] as any[]))
            }))
        }))
    })),
};

// Mock NotificationChannelService
mock.module("../../../src/modules/notifications/notification-channel.service", () => ({
    NotificationChannelService: {
        send: mock(() => Promise.resolve({ success: true }))
    }
}));

mock.module("../../../src/db", () => ({ db: mockDb }));

describe("Compliance & Automation Tests", () => {

    beforeEach(() => {
        // Reset mocks if needed
    });

    it("should generate Tally Purchase XML", async () => {
        mockDb.query.purchaseOrders.findMany.mockResolvedValue([
            {
                poNumber: "PO-101",
                supplierName: "ABC Supplies",
                totalCost: "5000",
                updatedAt: new Date("2024-01-01"),
                items: [
                    { quantityReceived: 10, unitCost: "100", item: { category: "Food" } }
                ]
            }
        ] as any[]);

        const xml = await TallyService.generatePurchaseXml(1, "2024-01-01");
        expect(xml).toContain('<VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>');
        expect(xml).toContain('ABC Supplies');
        expect(xml).toContain('Food');
    });

    it("should generate Tally Receipt XML", async () => {
        mockDb.query.payments.findMany.mockResolvedValue([
            {
                amount: "1500",
                paymentMethod: "CASH",
                createdAt: new Date("2024-01-01"),
                booking: { room: { number: "101" }, guestName: "John Doe" }
            }
        ] as any[]);

        const xml = await TallyService.generateReceiptXml(1, "2024-01-01");
        expect(xml).toContain('<VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>');
        expect(xml).toContain('Room 101');
        expect(xml).toContain('John Doe');
    });

    it("should enqueue a background job", async () => {
        await JobService.enqueue(1, "TEST_JOB", { foo: "bar" }, 60);
        expect(mockDb.insert).toHaveBeenCalled();
        // Check if insert called with correct params (simplified check)
    });

    it("should process pending jobs", async () => {
        const job = {
            id: "job-1",
            type: "SEND_REVIEW_REQUEST",
            payload: { hotelId: 1, guestName: "John", guestPhone: "9800000000" }
        };

        mockDb.query.backgroundJobs.findMany.mockResolvedValue([job] as any[]);

        // Mock update to return chainable object


        const results = await JobService.processPendingJobs();
        expect(results.length).toBe(1);
        expect(results[0].status).toBe("COMPLETED");
    });
});
