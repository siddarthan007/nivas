import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { SuperAdminService } from './super-admin.service';
import { createResponse } from '../../utils/response.helper';
import { UnauthorizedError, ForbiddenError } from '../../utils/errors';

export const superAdminController = new Elysia({ prefix: '/super-admin' })
    .use(authMiddleware)
    .post('/onboard', async ({ body }) => {
        const result = await SuperAdminService.onboardHotel(body);
        return createResponse(result.hotel, `Hotel "${result.hotel.name}" onboarded successfully`);
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_TENANTS,
        body: t.Object({
            name: t.String({ minLength: 1 }),
            // URL-safe slug — drives tenant resolution + guest-portal URLs.
            slug: t.String({ pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', minLength: 2 }),
            logoUrl: t.Optional(t.String()),
            website: t.Optional(t.String()),
            address: t.String(),
            phone: t.Optional(t.String()),
            panNumber: t.Optional(t.String()),
            vatNumber: t.Optional(t.String()),
            ownerName: t.String({ minLength: 1 }),
            ownerEmail: t.String({ format: 'email' }),
            ownerPhone: t.String(),
            ownerPassword: t.String({ minLength: 8 }),
            serviceChargeRate: t.Optional(t.String()),
            taxRate: t.Optional(t.String()),
            packageId: t.Optional(t.Number()),
            billingCycle: t.Optional(t.Union([t.Literal('MONTHLY'), t.Literal('ANNUAL'), t.Literal('2_YEAR'), t.Literal('3_YEAR')])),
            trialDays: t.Optional(t.Number()),
            maxRooms: t.Optional(t.Number()),
            maxUsers: t.Optional(t.Number()),
        }),
        detail: {
            summary: 'Onboard a new hotel (SaaS admin only)',
            tags: ['Super Admin']
        }
    })
    .get('/analytics/sales', async () => {
        const analytics = await SuperAdminService.getSalesAnalytics();
        return createResponse(analytics, 'Sales analytics fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.VIEW_SAAS_ANALYTICS,
        detail: {
            summary: 'Get sales analytics',
            tags: ['Super Admin']
        }
    })
    .post('/process-audit', async ({ user, body, request }) => {
        if (!user) throw new UnauthorizedError('Unauthorized');
        const ip = request.headers.get('x-forwarded-for') || undefined;
        const result = await SuperAdminService.triggerNightAudit(user, body.hotelId, ip);
        return createResponse(result, 'Night audit process completed');
    }, {
        isSignedIn: true,
        body: t.Object({
            hotelId: t.Optional(t.Number())
        }),
        detail: {
            summary: 'Manually trigger night audit for hotel',
            tags: ['Operations']
        }
    })
    .post('/impersonate', async ({ user, body, jwt, request, cookie }) => {
        const ip = request.headers.get('x-forwarded-for') || undefined;
        const result = await SuperAdminService.impersonateHotelOwner(user, body.hotelId, jwt, ip);

        const currentToken = request.headers.get('authorization')?.replace('Bearer ', '');
        if (cookie) {
            if (currentToken) {
                cookie.admin_backup_token?.set({
                    value: currentToken,
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict',
                    maxAge: 60 * 60 * 2,
                    path: '/'
                });
            }

            cookie.auth?.set({
                value: result.token,
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 60 * 60 * 2,
                path: '/'
            });

            cookie.impersonation_token?.set({
                value: result.token,
                httpOnly: false,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 60 * 5,
                path: '/'
            });

            cookie.impersonation_active?.set({
                value: 'true',
                httpOnly: false,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 60 * 60 * 2,
                path: '/'
            });

            cookie.impersonation_hotel?.set({
                value: result.hotelName || 'Hotel #' + body.hotelId,
                httpOnly: false,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 60 * 60 * 2,
                path: '/'
            });

            cookie.impersonation_id?.set({
                value: result.impersonationId,
                httpOnly: false,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 60 * 60 * 2,
                path: '/'
            });
        }

        return createResponse(result, result.message);
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.VIEW_SAAS_ANALYTICS,
        body: t.Object({
            hotelId: t.Number()
        }),
        detail: {
            summary: 'Impersonate a hotel owner (sets secure backup cookie)',
            tags: ['Super Admin']
        }
    })
    .post('/end-impersonate', async ({ cookie, user, jwt }) => {
        if (!user?.impersonation) {
            throw new ForbiddenError('Not in an impersonation session');
        }

        const backupToken = cookie?.admin_backup_token?.value;
        if (!backupToken) {
            cookie?.impersonation_active?.remove();
            cookie?.impersonation_hotel?.remove();
            cookie?.impersonation_token?.remove();
            cookie?.impersonation_id?.remove();
            cookie?.admin_backup_token?.remove();
            return createResponse({ restored: false }, 'No backup session found. Please login again.');
        }

        // Verify backup token is still valid (not expired / tampered)
        const backupProfile = await jwt.verify(backupToken as string);
        if (!backupProfile || backupProfile.type !== 'SUPER_ADMIN') {
            cookie?.admin_backup_token?.remove();
            cookie?.impersonation_active?.remove();
            cookie?.impersonation_hotel?.remove();
            cookie?.impersonation_token?.remove();
            cookie?.impersonation_id?.remove();
            return createResponse({ restored: false }, 'Backup session invalid or expired. Please login again.');
        }

        cookie?.admin_backup_token?.remove();
        cookie?.impersonation_active?.remove();
        cookie?.impersonation_hotel?.remove();
        cookie?.impersonation_token?.remove();
        cookie?.impersonation_id?.remove();

        cookie.auth?.set({
            value: backupToken,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/'
        });

        cookie.restored_token?.set({
            value: backupToken,
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 5,
            path: '/'
        });

        return createResponse(
            { restored: true, token: backupToken },
            'Admin session restored'
        );
    }, {
        isSignedIn: true,
        detail: {
            summary: 'End impersonation and restore admin session',
            tags: ['Super Admin']
        }
    })
    .get('/validate-impersonation', async ({ user }) => {
        const valid = user?.impersonation === true;
        return createResponse({ valid }, valid ? 'Impersonation session active' : 'Not in an impersonation session');
    }, {
        isSignedIn: true,
        detail: {
            summary: 'Validate current impersonation session',
            tags: ['Super Admin']
        }
    });