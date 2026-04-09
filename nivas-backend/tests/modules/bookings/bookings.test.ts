import { describe, expect, it, mock, beforeEach } from "bun:test";
import { createTestApp } from "../../test-utils";

// 1. Mock DB
const mockFindMany = mock();
const mockFindFirst = mock();
const mockGuestsFindFirst = mock();
const mockInsert = mock();
const mockValues = mock();
const mockReturning = mock();
const mockUpdate = mock();
const mockSet = mock();
const mockWhere = mock();
const mockUserFind = mock();
const mockSelect = mock();
const mockFrom = mock();
const mockCountWhere = mock();

const mockDb: any = {
    query: {
        bookings: { findMany: mockFindMany },
        hotels: { findFirst: mockFindFirst },
        rooms: { findFirst: mockFindFirst },
        guests: { findFirst: mockGuestsFindFirst },
        tenantFeatures: { findFirst: mockFindFirst },
        channelManagerSettings: { findMany: mockFindMany },
        users: { findFirst: mockUserFind }
    },
    insert: mockInsert,
    update: mockUpdate,
    select: mockSelect
};
// Setup select chain
mockSelect.mockReturnValue({ from: mockFrom });
mockFrom.mockReturnValue({ where: mockCountWhere });
mockCountWhere.mockResolvedValue([{ count: 10 }]);
mockDb.transaction = (cb: any) => cb(mockDb);

mock.module("../../../src/db", () => ({
    db: mockDb
}));

// Mock schema
mock.module("../../../src/db/schema", () => ({
    bookings: { name: "bookings" },
    rooms: { name: "rooms" },
    hotels: { name: "hotels" },
    guests: { name: "guests" },
    channelManagerSettings: { name: "channel_manager_settings" },
    channelSyncLogs: { name: "channel_sync_logs" },
    tenantFeatures: { name: "tenant_features" },
    users: { name: "users" }
}));

// 2. Mock Audit
const mockLogAction = mock();
mock.module("../../../src/modules/system/audit.service", () => ({
    logAction: mockLogAction
}));

// 3. Mock Notification Service
const mockSendBookingConfirmation = mock();
mock.module("../../../src/modules/notifications/notification-channel.service", () => ({
    NotificationChannelService: {
        sendBookingConfirmation: mockSendBookingConfirmation
    }
}));

// Import controller AFTER mocking
import { bookingsController } from "../../../src/modules/bookings/bookings.controller";

describe("Bookings Controller", () => {
    let app: any;
    let validToken: string;

    beforeEach(async () => {
        // Reset mocks
        mockFindMany.mockReset();
        mockFindFirst.mockReset();
        mockGuestsFindFirst.mockReset();
        mockInsert.mockReset();
        mockValues.mockReset();
        mockReturning.mockReset();
        mockUpdate.mockReset();
        mockSet.mockReset();
        mockWhere.mockReset();
        mockLogAction.mockReset();
        mockSendBookingConfirmation.mockReset();
        mockUserFind.mockReset();
        mockSelect.mockReset();
        mockFrom.mockReset();
        mockCountWhere.mockReset();

        // Re-setup select chain defaults
        mockSelect.mockReturnValue({ from: mockFrom });
        mockFrom.mockReturnValue({ where: mockCountWhere });
        mockCountWhere.mockResolvedValue([{ count: 10 }]);

        mockUserFind.mockResolvedValue({ id: "staff-1", isActive: true, hotelId: 1 });
        mockGuestsFindFirst.mockResolvedValue(null);
        mockSendBookingConfirmation.mockResolvedValue(true);

        // Setup chain for insert
        mockInsert.mockReturnValue({ values: mockValues });
        mockValues.mockReturnValue({ returning: mockReturning });

        // Setup chain for update
        mockUpdate.mockReturnValue({ set: mockSet });
        mockSet.mockReturnValue({ where: mockWhere });
        mockWhere.mockReturnValue({ returning: mockReturning });

        app = createTestApp(bookingsController);

        // Generate a valid token
        const { Elysia } = await import("elysia");
        const { jwt } = await import("@elysiajs/jwt");
        const { config } = await import("../../../src/config/env");
        const jwtApp = new Elysia().use(jwt({ name: 'jwt', secret: config.jwt.secret }));

        validToken = await (jwtApp as any).decorator.jwt.sign({
            id: "staff-1",
            hotelId: 1,
            type: "HOTEL_STAFF",
            permissions: ["*"]
        });
    });

    it("GET /bookings - should return list of bookings", async () => {
        const mockBookings = [{ id: "b1", guestName: "John" }];
        mockFindMany.mockResolvedValue(mockBookings);

        const req = new Request("http://localhost/bookings", {
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data).toEqual(mockBookings);
    });

    it("POST /bookings - should create booking successfully", async () => {
        mockFindMany.mockResolvedValue([]);
        mockFindFirst
            .mockResolvedValueOnce({ id: 1, name: "Test Hotel" })
            .mockResolvedValueOnce({ id: 101, number: "101", type: "Standard" });

        mockGuestsFindFirst.mockResolvedValue({
            id: "guest-1",
            fullName: "Alice",
            phone: "9812345678",
            idNumber: null
        });

        const newBooking = { id: "new-b1", guestName: "Alice", roomId: 101 };
        mockReturning.mockResolvedValue([newBooking]);

        const payload = {
            roomId: 101,
            guestName: "Alice",
            guestPhone: "9812345678",
            guestCount: 2,
            checkIn: "2025-05-01",
            checkOut: "2025-05-05",
            totalAmount: 5000
        };

        const req = new Request("http://localhost/bookings", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${validToken}`
            },
            body: JSON.stringify(payload)
        });

        const res = await app.handle(req);
        if (res.status !== 200) {
            console.log("Response Status:", res.status);
            console.log("Response Body:", await res.text());
        }
        expect(res.status).toBe(200);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data.id).toBe("new-b1");
        expect(mockInsert).toHaveBeenCalled();
        expect(mockLogAction).toHaveBeenCalled();
        expect(mockSendBookingConfirmation).toHaveBeenCalled();
    });

    it("POST /bookings - should fail if room occupied", async () => {
        mockFindMany.mockResolvedValue([{ id: "existing-b1", status: "CONFIRMED" }]);

        const payload = {
            roomId: 101,
            guestName: "Bob",
            guestPhone: "9812345678",
            guestCount: 1,
            checkIn: "2025-05-01",
            checkOut: "2025-05-02",
            totalAmount: 1000
        };

        const req = new Request("http://localhost/bookings", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${validToken}`
            },
            body: JSON.stringify(payload)
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(409);
        expect(body.message).toContain("Room not available");
    });
});
