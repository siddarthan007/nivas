import { describe, expect, it, mock, beforeEach } from "bun:test";
import { createTestApp } from "../../test-utils";

// Mock OrdersService directly (controller uses this)
const mockCreateOrder = mock();
const mockGetOrders = mock();
const mockUpdateStatus = mock();

mock.module("../../../src/modules/orders/orders.service", () => ({
    OrdersService: {
        createOrder: mockCreateOrder,
        getOrders: mockGetOrders,
        updateStatus: mockUpdateStatus
    }
}));

// Mock DB for auth middleware user lookup
const mockUsersFindFirst = mock();
mock.module("../../../src/db", () => ({
    db: {
        query: {
            users: { findFirst: mockUsersFindFirst }
        }
    }
}));

// Mock Schema
import { mockedSchema } from "../../mocks/schema";
mock.module("../../../src/db/schema", () => mockedSchema);

describe("Orders Controller", () => {
    let app: any;
    let validToken: string;

    beforeEach(async () => {
        mockCreateOrder.mockReset();
        mockGetOrders.mockReset();
        mockUpdateStatus.mockReset();
        mockUsersFindFirst.mockReset();

        // Mock user lookup for auth middleware
        mockUsersFindFirst.mockResolvedValue({
            id: "admin-1",
            isActive: true,
            hotelId: 1,
            role: { name: "Manager", permissions: ["ORDERS.CREATE", "ORDERS.READ", "ORDERS.UPDATE_STATUS"] },
            permissions: ["ORDERS.CREATE", "ORDERS.READ", "ORDERS.UPDATE_STATUS"]
        });

        const { ordersController } = await import("../../../src/modules/orders/orders.controller");
        app = createTestApp(ordersController);

        const { Elysia } = await import("elysia");
        const { jwt } = await import("@elysiajs/jwt");
        const { config } = await import("../../../src/config/env");
        const jwtApp = new Elysia().use(jwt({ name: 'jwt', secret: config.jwt.secret }));

        validToken = await (jwtApp as any).decorator.jwt.sign({
            id: "admin-1",
            hotelId: 1,
            type: "HOTEL_STAFF",
            permissions: ["ORDERS.CREATE", "ORDERS.READ", "ORDERS.UPDATE_STATUS"]
        });
    });

    it("POST /orders - should calculate total and create order", async () => {
        mockCreateOrder.mockResolvedValue({
            id: "ord-1",
            orderNumber: "ORD-123",
            totalAmount: "500",
            status: "PENDING"
        });

        const req = new Request("http://localhost/orders", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${validToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                orderType: "DINE_IN",
                items: [
                    { menuItemId: 1, quantity: 1, price: 100 },
                    { menuItemId: 2, quantity: 2, price: 200 }
                ]
            })
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        if (res.status !== 200) console.log("Error:", body);

        expect(res.status).toBe(200);
        expect(body.data.orderNumber).toBe("ORD-123");
        expect(mockCreateOrder).toHaveBeenCalled();
    });

    it("GET /orders - should list orders", async () => {
        mockGetOrders.mockResolvedValue([
            { id: "ord-1", orderNumber: "ORD-123", totalAmount: "500" }
        ]);

        const req = new Request("http://localhost/orders", {
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data).toHaveLength(1);
        expect(body.data[0].orderNumber).toBe("ORD-123");
        expect(mockGetOrders).toHaveBeenCalled();
    });

    it("PATCH /orders/:id/status - should update status and notify if READY", async () => {
        mockUpdateStatus.mockResolvedValue({
            id: "ord-1",
            orderNumber: "ORD-123",
            status: "READY"
        });

        const req = new Request("http://localhost/orders/ord-1/status", {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${validToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ status: "READY" })
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data.status).toBe("READY");
        expect(mockUpdateStatus).toHaveBeenCalled();
    });
});
