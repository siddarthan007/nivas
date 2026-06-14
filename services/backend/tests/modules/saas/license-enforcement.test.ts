import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Elysia } from 'elysia';
import { licenseMiddleware } from '../../../src/middlewares/license.middleware';

// Mock the database
const mockHotelData = {
    licenseStatus: 'ACTIVE',
    licenseExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    licenseGraceEndsAt: null,
    isActive: true
};

mock.module('../../../src/db', () => ({
    db: {
        query: {
            hotels: {
                findFirst: mock(() => Promise.resolve(mockHotelData))
            }
        },
        update: mock(() => ({
            set: mock(() => ({
                where: mock(() => Promise.resolve())
            }))
        }))
    }
}));

const createTestApp = (user: any) => {
    return new Elysia()
        .derive(() => ({ user }))
        .use(licenseMiddleware)
        .get('/api/v1/bookings', () => ({ status: 'success', data: [] }))
        .get('/api/v1/auth/login', () => ({ status: 'success' }))
        .get('/api/v1/saas-admin/tenants', () => ({ status: 'success', data: [] }))
        .get('/api/v1/super-admin/hotels', () => ({ status: 'success', data: [] }));
};

describe('Global License Enforcement', () => {
    describe('Active License', () => {
        it('should allow access with ACTIVE license', async () => {
            const user = { id: '1', hotelId: 1, type: 'HOTEL_STAFF', permissions: [] };
            const app = createTestApp(user);

            const response = await app.handle(
                new Request('http://localhost/api/v1/bookings')
            );

            expect(response.status).toBe(200);
        });
    });

    describe('Exempt Paths', () => {
        it('should allow auth endpoints without license check', async () => {
            const user = { id: '1', hotelId: 1, type: 'HOTEL_STAFF', permissions: [] };
            const app = createTestApp(user);

            const response = await app.handle(
                new Request('http://localhost/api/v1/auth/login')
            );

            expect(response.status).toBe(200);
        });

        it('should allow super-admin endpoints', async () => {
            const user = { id: '1', hotelId: null, type: 'SUPER_ADMIN', permissions: [] };
            const app = createTestApp(user);

            const response = await app.handle(
                new Request('http://localhost/api/v1/super-admin/hotels')
            );

            expect(response.status).toBe(200);
        });

        it('should allow saas-admin endpoints', async () => {
            const user = { id: '1', hotelId: null, type: 'SUPER_ADMIN', permissions: [] };
            const app = createTestApp(user);

            const response = await app.handle(
                new Request('http://localhost/api/v1/saas-admin/tenants')
            );

            expect(response.status).toBe(200);
        });
    });

    describe('User Type Bypass', () => {
        it('should bypass license check for SUPER_ADMIN', async () => {
            const user = { id: '1', hotelId: null, type: 'SUPER_ADMIN', permissions: [] };
            const app = createTestApp(user);

            const response = await app.handle(
                new Request('http://localhost/api/v1/bookings')
            );

            expect(response.status).toBe(200);
        });

        it('should bypass license check for GUEST', async () => {
            const user = { id: '1', hotelId: 1, type: 'GUEST', permissions: [], roomId: 101 };
            const app = createTestApp(user);

            const response = await app.handle(
                new Request('http://localhost/api/v1/bookings')
            );

            expect(response.status).toBe(200);
        });
    });

    describe('Unauthenticated Requests', () => {
        it('should allow unauthenticated requests (auth middleware handles)', async () => {
            const app = createTestApp(null);

            const response = await app.handle(
                new Request('http://localhost/api/v1/bookings')
            );

            // License middleware skips null users, auth middleware would block
            expect(response.status).toBe(200);
        });
    });
});

describe('License Status Enforcement', () => {
    describe('Invalid License Statuses', () => {
        const invalidStatuses = ['PAUSED', 'REVOKED', 'PENDING_PAYMENT'];

        invalidStatuses.forEach(status => {
            it(`should block access with ${status} license`, async () => {
                // This test documents expected behavior
                // The actual blocking is tested via unit tests
                const info = {
                    status: status as any,
                    expiresAt: null,
                    graceEndsAt: null,
                    isWithinGrace: false
                };

                // Import directly to test
                const { isLicenseValid } = await import('../../../src/middlewares/license.middleware');
                expect(isLicenseValid(info)).toBe(false);
            });
        });
    });

    describe('Expired License', () => {
        it('should allow access during grace period', async () => {
            const { isLicenseValid } = await import('../../../src/middlewares/license.middleware');

            const info = {
                status: 'EXPIRED' as const,
                expiresAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
                graceEndsAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
                isWithinGrace: true
            };

            expect(isLicenseValid(info)).toBe(true);
        });

        it('should block access after grace period', async () => {
            const { isLicenseValid } = await import('../../../src/middlewares/license.middleware');

            const info = {
                status: 'EXPIRED' as const,
                expiresAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
                graceEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
                isWithinGrace: false
            };

            expect(isLicenseValid(info)).toBe(false);
        });
    });
});

describe('Error Response Format', () => {
    it('should return proper error structure for invalid license', async () => {
        const { getLicenseErrorMessage } = await import('../../../src/middlewares/license.middleware');

        const info = {
            status: 'PAUSED' as const,
            expiresAt: null,
            graceEndsAt: null,
            isWithinGrace: false
        };

        const message = getLicenseErrorMessage(info);
        expect(message).toContain('paused');
        expect(message).toContain('support');
    });
});
