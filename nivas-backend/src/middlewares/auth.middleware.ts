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

    const profileId = profile.id as string | undefined;
    if (!profileId) {
        return { user: null };
    }

    // Guest tokens use synthetic IDs like "guest-{roomId}" — not real DB users.
    // Do not require profile.type === 'GUEST' (some JWT verify paths omit custom claims).
    if (profileId.startsWith('guest-') && profile.hotelId != null) {
        const fromClaim = typeof (profile as { roomId?: unknown }).roomId === 'number'
            ? (profile as { roomId: number }).roomId
            : NaN;
        const roomId = !Number.isNaN(fromClaim) ? fromClaim : parseInt(profileId.replace('guest-', ''), 10);
        if (Number.isNaN(roomId)) {
            return { user: null };
        }
        const user: User = {
            id: profileId,
            hotelId: profile.hotelId as number,
            type: 'GUEST',
            permissions: (profile.permissions as string[]) || [],
            roomId,
            role: { name: 'Guest' },
            licenseStatus: 'ACTIVE',
        };
        return { user };
    }

    // Staff/Admin tokens must have a valid UUID
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profileId)) {
        return { user: null };
    }

    let dbUser;
    try {
        dbUser = await db.query.users.findFirst({
            where: eq(users.id, profileId),
            with: { role: true }
        });
    } catch {
        return { user: null };
    }

    if (!dbUser || !dbUser.isActive) {
        return { user: null };
    }

    const user: User = {
        id: dbUser.id,
        hotelId: dbUser.hotelId,
        type: dbUser.userType as 'SUPER_ADMIN' | 'HOTEL_STAFF' | 'GUEST',
        permissions: (dbUser.role?.permissions as string[]) || [],
        roomId: undefined,
        role: { name: dbUser.role?.name || '' },
        licenseStatus: 'ACTIVE',
    };

    if (user.type !== 'SUPER_ADMIN' && user.type !== 'GUEST' && !user.hotelId) {
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