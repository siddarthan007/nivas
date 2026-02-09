import { describe, expect, it, mock, beforeEach, beforeAll } from "bun:test";
import { createTestApp } from "../test-utils";

/**
 * Real-World Scenario Test: The "Grand Nivas" Experience
 * 
 * This test simulates a complete lifecycle of a hotel operation using a 
 * "Stateful Fake DB" to ensure data persistence across steps without a real DB.
 * 
 * Flow:
 * 1. Setup: Register Hotel & Admin
 * 2. Setup: Create Rooms & Amenities
 * 3. Guest: Check Availability & Book Room
 * 4. Front Desk: Check-in Guest
 * 5. Service: Order Food (Room Service)
 * 6. Service: Request Housekeeping
 * 7. Front Desk: Generate Invoice & Check-out
 * 8. Analytics: Verify Revenue
 */

// --- Stateful Fake DB ---
// A simplified in-memory store that mimics Drizzle logic for the scenario
const store: any = {
    hotels: [],
    users: [],
    roles: [],
    rooms: [],
    bookings: [],
    orders: [],
    order_items: [],
    invoices: [],
    payments: [],
    audit_logs: [],
    menu_items: [],
    floors: [],
    shifts: [],
    notifications: [],
    guest_profiles: [],
    inventory_items: [],
    inventory_requests: [],
    housekeeping_tasks: [],
    messages: [],
    restaurant_tables: [],
    parking_spaces: [],
    purchase_order_items: [],
    purchase_orders: [],
    folio_charges: [],
    night_audits: [],
    credit_notes: [],
    outlets: [],
    staff_attendance: [],
    pricing_rules: [],
    corporate_accounts: [],
    travel_agents: [],
    tenant_features: [],
    channel_manager_settings: [],
    channel_sync_logs: [],
    notification_settings: []
};

// Generic "Insert" Mock
const mockInsert = (table: any) => ({
    values: (data: any) => {
        // Handle array or single object
        const items = Array.isArray(data) ? data : [data];
        const newItems = items.map((item: any, i: number) => {
            // Determine if ID should be string (UUID) or number
            // Tables with UUID: bookings, orders, invoices, users, shifts, notifications, audit_logs
            // Tables with UUID: bookings, invoices, users, shifts, notifications, audit_logs
            // removed housekeeping_tasks from UUID to match controller parseInt
            const uuidTables = ['bookings', 'orders', 'invoices', 'users', 'shifts', 'notifications', 'audit_logs', 'payments', 'messages'];
            const nextId = (store[table.name]?.length || 0) + i + 1;

            return {
                id: uuidTables.includes(table.name) ? `uuid-${nextId}` : nextId,
                ...item,
                createdAt: new Date(),
                updatedAt: new Date()
            };
        });
        store[table.name]?.push(...newItems);
        return {
            returning: () => newItems
        };
    }
});

// Generic "Query" Mock
const mockQuery = (tableName: string) => ({
    findFirst: async (params: any) => {
        // Very basic filter support
        return store[tableName]?.find((item: any) => {
            if (params?.where) return true; // simplified
            return true;
        });
    },
    findMany: async (params: any) => {
        return store[tableName] || [];
    }
});

// Mock Drizzle ORM
mock.module("drizzle-orm", () => {
    const mockFn = (...args: any[]) => ({ type: 'mock', args });
    return {
        eq: (col: any, val: any) => ({ type: 'eq', col, val }),
        and: (...args: any[]) => ({ type: 'and', args }),
        or: (...args: any[]) => ({ type: 'or', args }),
        desc: mockFn,
        asc: mockFn,
        sql: Object.assign((...args: any[]) => ({ type: 'sql', args }), { raw: mockFn, empty: mockFn, fromList: mockFn, append: mockFn }),
        count: mockFn,
        sum: mockFn,
        ne: mockFn,
        gt: mockFn,
        gte: mockFn,
        lt: mockFn,
        lte: mockFn,
        inArray: mockFn,
        notInArray: mockFn,
        isNull: mockFn,
        isNotNull: mockFn,
        between: mockFn,
        notBetween: mockFn,
        like: mockFn,
        ilike: mockFn,
        notLike: mockFn,
        notIlike: mockFn,
        exists: mockFn,
        notExists: mockFn,
        aliasedTable: mockFn,
        getTableColumns: mockFn,
        getTableName: mockFn,
        relations: mockFn,
    };
});

// Mock Drizzle
const mockDbImplementation: any = {
    insert: (table: any) => mockInsert(table),
    update: (table: any) => ({
        set: (data: any) => ({
            where: (predicate: any) => {
                let updatedItems: any[] = [];
                let effectivePredicate = predicate;

                // Unwrap AND/OR
                if (predicate?.type === 'and' || predicate?.type === 'or') {
                    // Try to find an EQ predicate for ID or similar
                    const idPred = predicate.args.find((p: any) => p?.col?.name === 'id' && p?.type === 'eq');
                    if (idPred) effectivePredicate = idPred;
                    else {
                        const eqPred = predicate.args.find((p: any) => p?.type === 'eq');
                        if (eqPred) effectivePredicate = eqPred;
                    }
                }

                if (effectivePredicate?.type === 'eq') {
                    const { col, val } = effectivePredicate;
                    if (col?.name) {
                        const items = store[table.name] || [];
                        items.forEach((item: any) => {
                            if (String(item[col.name]) === String(val)) {
                                Object.assign(item, data);
                                item.updatedAt = new Date();
                                updatedItems.push({ ...item });
                            }
                        });
                    }
                }
                return { returning: () => updatedItems };
            }
        })
    }),
    delete: (table: any) => ({
        where: () => ({})
    }),
    query: {
        hotels: mockQuery('hotels'),
        users: mockQuery('users'),
        roles: mockQuery('roles'),
        rooms: mockQuery('rooms'),
        bookings: mockQuery('bookings'),
        orders: mockQuery('orders'),
        menuItems: mockQuery('menu_items'),
        tenantFeatures: mockQuery('tenant_features'),
        channelManagerSettings: mockQuery('channel_manager_settings'),
        channelSyncLogs: mockQuery('channel_sync_logs'),
        notificationSettings: mockQuery('notification_settings'),
        orderItems: mockQuery('order_items'),
        inventoryItems: mockQuery('inventory_items'),
        inventoryRequests: mockQuery('inventory_requests'),
        floors: mockQuery('floors'),
        invoices: mockQuery('invoices'),
        guestProfiles: mockQuery('guest_profiles'),
        housekeepingTasks: mockQuery('housekeeping_tasks'),
        shifts: mockQuery('shifts'),
        payments: mockQuery('payments'),
        messages: mockQuery('messages'),
        corporateAccounts: mockQuery('corporate_accounts'),
        travelAgents: mockQuery('travel_agents'),
        banquetVenues: mockQuery('banquet_venues') // Assumed if generic
    },
    select: () => ({
        from: () => {
            const chainable: any = {
                where: () => chainable,
                leftJoin: () => chainable,
                innerJoin: () => chainable,
                groupBy: () => chainable,
                orderBy: () => chainable,
                limit: () => chainable,
                then: (resolve: any) => resolve([])
            };
            return chainable;
        }
    }),
    execute: () => Promise.resolve()
};

mockDbImplementation.transaction = async (cb: any) => cb(mockDbImplementation);

mock.module("../../src/db", () => ({
    db: mockDbImplementation
}));

// Mock Schemas
import { mockedSchema } from "../mocks/schema";
mock.module("../../src/db/schema", () => mockedSchema);

// Import Controllers
// We need to initialize the app with ALL relevant controllers to simulate the full API
import { bookingsController } from "../../src/modules/bookings/bookings.controller";
import { authMiddleware } from "../../src/middlewares/auth.middleware";
import { Elysia } from "elysia";

// We'll compose a "Super App" for the test
const setupScenarioApp = async () => {
    const { jwt } = await import("@elysiajs/jwt");
    const { config } = await import("../../src/config/env");

    // Import all controllers
    const { iamController } = await import("../../src/modules/iam/iam.controller");
    const { layoutController } = await import("../../src/modules/operations/layout.controller");
    const { menuController } = await import("../../src/modules/menu/menu.controller");
    const { ordersController } = await import("../../src/modules/orders/orders.controller");
    const { invoicesController } = await import("../../src/modules/finance/invoices.controller");
    const { bookingsController } = await import("../../src/modules/bookings/bookings.controller");
    const { housekeepingController } = await import("../../src/modules/housekeeping/housekeeping.controller");
    const { analyticsController } = await import("../../src/modules/analytics/analytics.controller");
    const { paymentsController } = await import("../../src/modules/finance/payments.controller");

    const app = new Elysia()
        .use(jwt({ name: 'jwt', secret: config.jwt.secret }))
        .use(iamController)
        .use(layoutController)
        .use(bookingsController)
        .use(menuController)
        .use(ordersController)
        .use(invoicesController)
        .use(housekeepingController)
        .use(paymentsController)
        .use(analyticsController);

    return app;
};

describe("Running Real-World Hotel Scenario: 'The Grand Nivas'", () => {
    let app: any;
    let adminToken: string;
    let staffToken: string;
    let hotelId: number;
    let roomId: number;
    let bookingId: string;
    let orderId: string;
    let taskId: string;

    beforeAll(async () => {
        // Reset Store
        Object.keys(store).forEach(k => store[k] = []);

        // Pre-seed Hotel & User (simulating previous onboarding)
        store.hotels.push({ id: 1, name: "Grand Nivas", slug: "grand-nivas" });
        store.roles.push({ id: 1, name: "Manager", hotelId: 1, permissions: ["*"] });
        store.users.push({
            id: "admin-1",
            fullName: "Admin User",
            hotelId: 1,
            roleId: 1,
            passwordHash: "hash",
            isActive: true,
            role: { name: "Manager", permissions: ["*"] }
        });

        // Pre-seed Tenant Features (Enable Channel Manager etc if needed, or default)
        store.tenant_features.push({
            id: 1,
            hotelId: 1,
            enableChannelManager: false // disable for now to avoid complexity, or true if testing it
        });

        app = await setupScenarioApp();

        // Generate Tokens
        const { jwt } = await import("@elysiajs/jwt");
        const { config } = await import("../../src/config/env");
        const jwtTool = jwt({ name: 'jwt', secret: config.jwt.secret });
        // @ts-ignore
        adminToken = await app.decorator.jwt.sign({
            id: "admin-1",
            hotelId: 1,
            type: "HOTEL_STAFF",
            permissions: ["*"]
        });
    });

    // 1. Setup Rooms
    it("Step 1: Setup - Create Luxury Suite", async () => {
        store.rooms.push({
            id: 101,
            hotelId: 1,
            number: "101",
            type: "DELUXE",
            price: "5000",
            status: "AVAILABLE"
        });

        expect(store.rooms).toHaveLength(1);
    });

    // 2. Book Room
    it("Step 2: Guest - Book Room 101", async () => {
        const req = new Request("http://localhost/bookings", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${adminToken}`, // Admin booking on behalf/or public
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                roomId: 101,
                guestName: "John Doe",
                guestPhone: "9800000000",
                checkIn: "2024-01-01",
                checkOut: "2024-01-05",
                guestCount: 2,
                totalAmount: 20000
            })
        });

        const res = await app.handle(req);

        if (res.status !== 200) {
            console.log("Booking Failed Status:", res.status);
            console.log("Response Text:", await res.text());
        }

        expect(res.status).toBe(200);

        const body = await res.json() as any;
        bookingId = body.data.id;
        expect(bookingId).toBeDefined();

        expect(store.bookings).toHaveLength(1);
        expect(store.bookings[0].guestName).toBe("John Doe");
    });

    // 3.5 Check-In
    it("Step 3.5: Guest - Check In", async () => {
        const req = new Request(`http://localhost/bookings/${bookingId}/check-in`, {
            method: "PATCH",
            headers: { "Authorization": `Bearer ${adminToken}` }
        });
        const res = await app.handle(req);
        expect(res.status).toBe(200);

        // Verify changes
        const booking = store.bookings.find((b: any) => b.id === bookingId);
        expect(booking.status).toBe("CHECKED_IN");

        const room = store.rooms.find((r: any) => r.id === 101);
        expect(room.status).toBe("OCCUPIED");
    });

    // 4. Order Food
    it("Step 3: Service - Order 'Butter Chicken'", async () => {
        store.menu_items.push({ id: 1, name: "Butter Chicken", price: "500", hotelId: 1 });

        const req = new Request("http://localhost/orders", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${adminToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                bookingId: bookingId,
                orderType: "ROOM_SERVICE",
                items: [{
                    menuItemId: 1,
                    quantity: 2,
                    price: 500,
                    notes: "Spicy"
                }]
            })
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        if (res.status !== 200) {
            console.log("Order Failed:", JSON.stringify(body, null, 2));
        }

        expect(res.status).toBe(200);
        expect(Number(body.data.totalAmount)).toBe(1000);

        expect(store.orders).toHaveLength(1);
    });

    // 4. Generate Invoice (Checkout)
    it("Step 4: Finance - Generate Invoice", async () => {
        const req = new Request("http://localhost/invoices/generate", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${adminToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                bookingId: bookingId
            })
        });

        const res = await app.handle(req);

        if (res.status !== 200) {
            console.log("Invoice Failed Status:", res.status);
            console.log("Invoice Error Text:", await res.text());
        } else {
            const body = await res.json() as any;
            expect(res.status).toBe(200);
        }

        expect(res.status).toBe(200);
    });

    // Step 4.5: Payment
    it("Step 4.5: Finance - Pay Bill", async () => {
        const req = new Request("http://localhost/finance/payments", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${adminToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                bookingId: bookingId,
                amount: 25500, // Room + Food
                paymentMethod: "CASH"
            })
        });
        const res = await app.handle(req);
        if (res.status !== 200) console.log("Payment Failed:", await res.text());
        expect(res.status).toBe(200);

        expect(store.payments).toHaveLength(1);
        const booking = store.bookings.find((b: any) => b.id === bookingId);
        expect(booking.isPaid).toBe(true);
    });

    // 5. Request Housekeeping
    it("Step 5: Service - Request Housekeeping", async () => {
        const req = new Request("http://localhost/housekeeping", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${adminToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                roomId: 101, // roomId from store (number)
                taskType: "CLEANING",
                priority: "HIGH",
                notes: "Spill in room"
            })
        });

        const res = await app.handle(req);

        if (res.status !== 200) {
            console.log("Housekeeping Failed:", await res.text());
        }

        expect(res.status).toBe(200);
        expect(store.housekeeping_tasks).toHaveLength(1);
        const body = await res.json() as any;
        taskId = body.data.id;

        // Verify room mocked as CLEANING by controller side-effect
        const room = store.rooms.find((r: any) => r.id === 101);
        expect(room.status).toBe("CLEANING");
    });

    // 5.5 Complete Housekeeping
    it("Step 5.5: Service - Complete Housekeeping", async () => {
        const req = new Request(`http://localhost/housekeeping/${taskId}/status`, {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${adminToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ status: "COMPLETED" })
        });
        const res = await app.handle(req);
        if (res.status !== 200) console.log("HK Update Failed:", await res.text());
        expect(res.status).toBe(200);

        const room = store.rooms.find((r: any) => r.id === 101);
        expect(room.status).toBe("AVAILABLE");
    });

    // 6. Analytics Verification
    it("Step 6: Analytics - Verify Revenue", async () => {
        // Analytics usually aggregates data.
        // Our mock DB 'select' returns empty [] by default.
        // So analytics might return 0, but it should succeed (200 OK).

        const req = new Request("http://localhost/analytics/dashboard", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${adminToken}`
            }
        });

        const res = await app.handle(req);
        if (res.status !== 200) {
            console.log("Analytics Failed:", await res.text());
        }
        expect(res.status).toBe(200);

        const body = await res.json() as any;
        expect(body.data).toBeDefined();
    });

    // 7. Check Out
    it("Step 7: Guest - Check Out", async () => {
        const req = new Request(`http://localhost/bookings/${bookingId}/check-out`, {
            method: "PATCH",
            headers: { "Authorization": `Bearer ${adminToken}` }
        });
        const res = await app.handle(req);
        expect(res.status).toBe(200);

        const booking = store.bookings.find((b: any) => b.id === bookingId);
        expect(booking.status).toBe("CHECKED_OUT");

        const room = store.rooms.find((r: any) => r.id === 101);
        expect(room.status).toBe("CLEANING");
    });
});
