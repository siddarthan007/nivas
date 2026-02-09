import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";

import { config } from '../config/env';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { logAction } from '../modules/system/audit.service';
import { validateLicense, isLicenseValid, getLicenseErrorMessage, isExemptPath } from './license.middleware';

export type LicenseStatus = 'ACTIVE' | 'PAUSED' | 'REVOKED' | 'TRIAL' | 'EXPIRED' | 'PENDING_PAYMENT';

export interface User {
    id: string;
    hotelId: number | null;
    type: 'SUPER_ADMIN' | 'HOTEL_STAFF' | 'GUEST';
    permissions: string[];
    roomId?: number;
    role?: { name: string };
    licenseStatus?: LicenseStatus;
    licenseGraceEndsAt?: Date;
}

export const authMiddleware = (app: Elysia) => app.use(
    jwt({
        name: 'jwt',
        secret: config.jwt.secret
    })
).derive(async ({ jwt, cookie: { auth }, headers }): Promise<{ user: User | null }> => {
    const authHeader = headers['authorization'];
    const token = (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : auth?.value) as string | undefined;

    if (!token) {
        return { user: null }
    }

    const profile = await jwt.verify(token);
    if (!profile) {
        return { user: null };
    }

    // STAGE 2: Database Verification (Strict Security)
    // We verify the user exists, is active, and fetch fresh permissions
    // This ensures banned users are blocked immediately and role changes apply instantly
    const dbUser = await db.query.users.findFirst({
        where: eq(users.id, profile.id as string),
        with: { role: true }
    });

    if (!dbUser || !dbUser.isActive) {
        return { user: null };
    }

    // Refresh user object with DB data
    const user: User = {
        id: dbUser.id,
        hotelId: dbUser.hotelId,
        type: dbUser.userType as 'SUPER_ADMIN' | 'HOTEL_STAFF' | 'GUEST', // Strict usage of DB column
        permissions: (dbUser.role?.permissions as string[]) || [], // Fresh permissions
        roomId: undefined, // Guest logic separate
        role: { name: dbUser.role?.name || '' },
        licenseStatus: 'ACTIVE' // Handled by separate middleware
    };

    // STAGE 3: Fail-Safe Context Check
    // If not super admin, hotelId MUST be present
    if (user.type !== 'SUPER_ADMIN' && user.type !== 'GUEST' && !user.hotelId) {
        // This is a zombie user state (staff without hotel). Block.
        return { user: null };
    }

    return { user };
}).macro(({ onBeforeHandle }) => ({
    isSignedIn(enabled: boolean) {
        if (!enabled) return;

        onBeforeHandle(async ({ user, error, path, set }: { user: User | null; error: any; path: string; set: any }) => {
            if (!user) return error(401, "Unauthorized: Please login first.");

            // License Check Integration
            // Skip for Super Admin, Guests, or Exempt Paths (like billing)
            if (user.type === 'SUPER_ADMIN' || user.type === 'GUEST' || isExemptPath(path)) {
                return;
            }

            if (!user.hotelId) {
                return error(403, {
                    status: 'error',
                    code: 'NO_HOTEL_CONTEXT',
                    message: 'No hotel context found for user.'
                });
            }

            const licenseInfo = await validateLicense(user.hotelId);
            if (!isLicenseValid(licenseInfo)) {
                return error(403, {
                    status: 'error',
                    code: 'LICENSE_INVALID',
                    licenseStatus: licenseInfo.status,
                    message: getLicenseErrorMessage(licenseInfo),
                    expiresAt: licenseInfo.expiresAt,
                    graceEndsAt: licenseInfo.graceEndsAt
                });
            }
        });
    },
    hasPermission(requiredPermission: string) {
        onBeforeHandle(({ user, request, error }: { user: User | null; request: Request; error: any }) => {
            if (!user) return error(401, "Unauthorized");

            if (user.type === 'SUPER_ADMIN') return;

            // console.log('Checking permission:', requiredPermission, 'User permissions:', user.permissions);

            if (user.permissions.includes('*')) return; // Allow wildcard access

            if (!user.permissions.includes(requiredPermission)) {
                // SECURITY AUDIT: Log access violation
                logAction(
                    user.hotelId || 0,
                    user.id,
                    'ACCESS_DENIED',
                    'SECURITY',
                    undefined,
                    {
                        reason: 'Missing permission',
                        required: requiredPermission,
                        path: new URL(request.url).pathname,
                        method: request.method
                    }
                ).catch(console.error);

                return error(403, `Forbidden: Missing '${requiredPermission}' permission.`);
            }
        });
    },
}));