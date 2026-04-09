import { describe, expect, it, mock, beforeEach } from "bun:test";
import { createTestApp } from "../../test-utils";

const mockFindFirst = mock();
const mockUpdate = mock();
const mockSet = mock();
const mockWhere = mock();
const mockUsersFindFirst = mock();
const mockTenantFeaturesFindFirst = mock();

mock.module("../../../src/db", () => ({
    db: {
        query: {
            hotels: { findFirst: mockFindFirst },
            users: { findFirst: mockUsersFindFirst },
            tenantFeatures: { findFirst: mockTenantFeaturesFindFirst },
        },
        update: mockUpdate,
    },
}));

import { mockedSchema } from "../../mocks/schema";
mock.module("../../../src/db/schema", () => mockedSchema);

const mockLogAction = mock();
mock.module("../../../src/modules/system/audit.service", () => ({
    logAction: mockLogAction,
}));

import { settingsController } from "../../../src/modules/tenants/settings.controller";

describe("Tenants - Settings Controller", () => {
    let app: any;
    let validToken: string;

    beforeEach(async () => {
        mockFindFirst.mockReset();
        mockUpdate.mockReset();
        mockSet.mockReset();
        mockWhere.mockReset();
        mockLogAction.mockReset();
        mockUsersFindFirst.mockReset();
        mockTenantFeaturesFindFirst.mockReset();

        mockTenantFeaturesFindFirst.mockResolvedValue(null);
        mockUsersFindFirst.mockResolvedValue({
            id: "admin-1",
            isActive: true,
            hotelId: 1,
            type: "HOTEL_STAFF",
            role: { name: "Owner" },
            permissions: ["SYSTEM.MANAGE_TENANTS"],
        });

        mockUpdate.mockReturnValue({ set: mockSet });
        mockSet.mockReturnValue({ where: mockWhere });

        app = createTestApp(settingsController);

        const { Elysia } = await import("elysia");
        const { jwt } = await import("@elysiajs/jwt");
        const { config } = await import("../../../src/config/env");
        const jwtApp = new Elysia().use(jwt({ name: 'jwt', secret: config.jwt.secret }));

        validToken = await (jwtApp as any).decorator.jwt.sign({
            id: "owner-1",
            hotelId: 1,
            type: "HOTEL_STAFF",
            role: { name: "Owner" },
            permissions: ["SYSTEM.MANAGE_TENANTS"],
        });
    });

    it("GET /settings - should return all settings", async () => {
        mockFindFirst.mockResolvedValue({
            id: 1,
            name: "My Hotel",
            serviceChargeRate: "0.10",
            taxRate: "0.13",
        });

        const req = new Request("http://localhost/settings", {
            headers: { Authorization: `Bearer ${validToken}` },
        });

        const res = await app.handle(req);
        const body = await res.json() as any;

        expect(res.status).toBe(200);
        expect(body.data.branding.name).toBe("My Hotel");
        expect(body.data.tax.serviceChargeRate).toBe(10);
        expect(body.data.features.enableGuestPortal).toBe(false);
    });

    it("PATCH /settings/tax - should update tax settings and log action", async () => {
        const req = new Request("http://localhost/settings/tax", {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${validToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                serviceChargeRate: 12,
                taxRate: 15,
            }),
        });

        const res = await app.handle(req);
        expect(res.status).toBe(200);
        expect(mockUpdate).toHaveBeenCalled();
        expect(mockLogAction).toHaveBeenCalled();
    });

    it("PATCH /settings/tax - should fail for non-owner/manager", async () => {
        const { Elysia } = await import("elysia");
        const { jwt } = await import("@elysiajs/jwt");
        const { config } = await import("../../../src/config/env");
        const jwtApp = new Elysia().use(jwt({ name: 'jwt', secret: config.jwt.secret }));

        const staffToken = await (jwtApp as any).decorator.jwt.sign({
            id: "staff-1",
            hotelId: 1,
            type: "HOTEL_STAFF",
            role: { name: "Receptionist" },
            permissions: ["SYSTEM.MANAGE_TENANTS"],
        });

        mockUsersFindFirst.mockResolvedValue({
            id: "staff-1",
            isActive: true,
            hotelId: 1,
            type: "HOTEL_STAFF",
            role: { name: "Receptionist", permissions: ["SYSTEM.MANAGE_TENANTS"] },
            permissions: ["SYSTEM.MANAGE_TENANTS"],
        });

        const req = new Request("http://localhost/settings/tax", {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${staffToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ taxRate: 15 }),
        });

        const res = await app.handle(req);
        expect(res.status).toBe(403);
    });
});
