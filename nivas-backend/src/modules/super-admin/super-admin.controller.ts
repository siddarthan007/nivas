import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { SuperAdminService } from './super-admin.service';
import { createResponse } from '../../utils/response.helper';
import { UnauthorizedError } from '../../utils/errors';

export const superAdminController = new Elysia({ prefix: '/super-admin' })
    .use(authMiddleware)
    // Hotel onboarding (public endpoint for SaaS admin)
    .post('/onboard', async ({ body }) => {
        const result = await SuperAdminService.onboardHotel(body);
        return createResponse(result.hotel, `Hotel "${result.hotel.name}" onboarded successfully`);
    }, {
        body: t.Object({
            name: t.String(),
            slug: t.String(),
            logoUrl: t.Optional(t.String()),
            address: t.String(),
            ownerName: t.String(),
            ownerEmail: t.String(),
            ownerPhone: t.String(),
            ownerPassword: t.String({ minLength: 6 }),
            serviceChargeRate: t.Optional(t.Number()),
            taxRate: t.Optional(t.Number()),
            packageId: t.Optional(t.Number()),
            trialDays: t.Optional(t.Number()),
        }),
        detail: {
            summary: 'Onboard a new hotel (SaaS admin only)',
            tags: ['Super Admin']
        }
    })
    // Sales analytics placeholder
    .get('/analytics/sales', async ({ user }) => {
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
    // Manual night audit trigger
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
    // Impersonate Hotel Owner - with secure HttpOnly cookie backup
    .post('/impersonate', async ({ user, body, jwt, request, cookie }) => {
        const ip = request.headers.get('x-forwarded-for') || undefined;
        const result = await SuperAdminService.impersonateHotelOwner(user, body.hotelId, jwt, ip);

        // Store original admin token in HttpOnly cookie for secure restoration
        const currentToken = request.headers.get('authorization')?.replace('Bearer ', '');
        if (cookie) {
            if (currentToken) {
                cookie.admin_backup_token?.set({
                    value: currentToken,
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict',
                    maxAge: 60 * 60 * 2, // 2 hours max impersonation
                    path: '/'
                });
            }

            // Set the auth cookie to the OWNER's token so the backend
            // resolves the owner identity on subsequent requests
            cookie.auth?.set({
                value: result.token,
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 60 * 60 * 2,
                path: '/'
            });

            // CRITICAL: Set the owner token in a non-HttpOnly cookie so the
            // frontend can read it on page reload and store it in localStorage.
            // This is the reliable token delivery mechanism (bypasses JSON response parsing).
            cookie.impersonation_token?.set({
                value: result.token,
                httpOnly: false,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 60 * 5, // Short-lived: 5 minutes (just needs to survive page reload)
                path: '/'
            });

            // Set impersonation flag
            cookie.impersonation_active?.set({
                value: 'true',
                httpOnly: false,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 60 * 60 * 2,
                path: '/'
            });

            // Store hotel name for banner
            cookie.impersonation_hotel?.set({
                value: result.hotelName || 'Hotel #' + body.hotelId,
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
        hasPermission: PERMISSIONS.SYSTEM.VIEW_SAAS_ANALYTICS, // Ensures SUPER_ADMIN level
        body: t.Object({
            hotelId: t.Number()
        }),
        detail: {
            summary: 'Impersonate a hotel owner (sets secure backup cookie)',
            tags: ['Super Admin']
        }
    })

    // End impersonation and restore admin session
    .post('/end-impersonate', async ({ cookie }) => {
        const backupToken = cookie?.admin_backup_token?.value;

        if (!backupToken) {
            return createResponse({ restored: false }, 'No backup session found');
        }

        // Clear impersonation cookies
        cookie?.admin_backup_token?.remove();
        cookie?.impersonation_active?.remove();
        cookie?.impersonation_hotel?.remove();
        cookie?.impersonation_token?.remove();

        // Restore the auth cookie with the admin token
        cookie.auth?.set({
            value: backupToken,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/'
        });

        // Set a non-HttpOnly cookie with the admin token so the frontend
        // can read it after page reload (same pattern as impersonation_token)
        cookie.restored_token?.set({
            value: backupToken,
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 5, // 5 minutes, just needs to survive page reload
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
    });