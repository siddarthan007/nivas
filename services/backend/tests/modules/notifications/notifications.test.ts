import { describe, expect, it, mock, beforeEach } from "bun:test";
import { createTestApp } from "../../test-utils";

// Mock NotificationsService directly (controller uses this, not store)
const mockGetUserNotifications = mock();
const mockMarkAsRead = mock();
const mockMarkAllRead = mock();

mock.module("../../../src/modules/notifications/notifications.service", () => ({
    NotificationsService: {
        getUserNotifications: mockGetUserNotifications,
        markAsRead: mockMarkAsRead,
        markAllRead: mockMarkAllRead
    }
}));

// Mock db for auth middleware user lookup
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

import { notificationsController } from "../../../src/modules/notifications/notifications.controller";

describe("Notifications Controller", () => {
    let app: any;
    let validToken: string;

    beforeEach(async () => {
        mockGetUserNotifications.mockReset();
        mockMarkAsRead.mockReset();
        mockMarkAllRead.mockReset();
        mockUsersFindFirst.mockReset();

        // Mock user lookup for auth middleware
        mockUsersFindFirst.mockResolvedValue({
            id: "user-1",
            isActive: true,
            hotelId: 1,
            role: { name: "Receptionist", permissions: [] },
            permissions: []
        });

        app = createTestApp(notificationsController);

        const { Elysia } = await import("elysia");
        const { jwt } = await import("@elysiajs/jwt");
        const { config } = await import("../../../src/config/env");
        const jwtApp = new Elysia().use(jwt({ name: 'jwt', secret: config.jwt.secret }));

        validToken = await (jwtApp as any).decorator.jwt.sign({
            id: "user-1",
            hotelId: 1,
            type: "HOTEL_STAFF",
            role: { name: "Receptionist" }
        });
    });

    it("GET /notifications - should list notifications", async () => {
        mockGetUserNotifications.mockResolvedValue([
            { id: "notif-1", message: "New Order" }
        ]);

        const req = new Request("http://localhost/notifications", {
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data).toHaveLength(1);
        expect(mockGetUserNotifications).toHaveBeenCalled();
    });

    it("PATCH /notifications/:id/read - should mark as read", async () => {
        mockMarkAsRead.mockResolvedValue(undefined);

        const req = new Request("http://localhost/notifications/notif-1/read", {
            method: "PATCH",
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        expect(res.status).toBe(200);
        expect(mockMarkAsRead).toHaveBeenCalled();
    });

    it("POST /notifications/read-all - should mark all as read", async () => {
        mockMarkAllRead.mockResolvedValue(undefined);

        const req = new Request("http://localhost/notifications/read-all", {
            method: "POST",
            headers: { "Authorization": `Bearer ${validToken}` }
        });

        const res = await app.handle(req);
        expect(res.status).toBe(200);
        expect(mockMarkAllRead).toHaveBeenCalled();
    });
});
