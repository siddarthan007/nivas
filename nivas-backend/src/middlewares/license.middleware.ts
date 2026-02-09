import { Elysia } from 'elysia';
import { db } from '../db';
import { hotels } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { User } from './auth.middleware';

export type LicenseStatus = 'ACTIVE' | 'PAUSED' | 'REVOKED' | 'TRIAL' | 'EXPIRED' | 'PENDING_PAYMENT';

export interface LicenseInfo {
    status: LicenseStatus;
    expiresAt: Date | null;
    graceEndsAt: Date | null;
    isWithinGrace: boolean;
}

const GRACE_PERIOD_HOURS = 24;

const LICENSE_EXEMPT_PATHS = [
    '/api/v1/auth',
    '/api/v1/guest-auth',
    '/api/v1/saas-billing/my-subscription',
    '/api/v1/saas-billing/packages',
    '/api/v1/saas-admin',
    '/api/v1/super-admin',
    '/api/v1/settings',
];

export function isExemptPath(path: string): boolean {
    return LICENSE_EXEMPT_PATHS.some(exempt => path.startsWith(exempt));
}

export async function validateLicense(hotelId: number): Promise<LicenseInfo> {
    const hotel = await db.query.hotels.findFirst({
        where: eq(hotels.id, hotelId),
        columns: {
            licenseStatus: true,
            licenseExpiresAt: true,
            licenseGraceEndsAt: true,
            isActive: true
        }
    });

    if (!hotel) {
        return {
            status: 'REVOKED',
            expiresAt: null,
            graceEndsAt: null,
            isWithinGrace: false
        };
    }

    const now = new Date();
    const status = (hotel.licenseStatus as LicenseStatus) || 'TRIAL';
    const expiresAt = hotel.licenseExpiresAt;
    const graceEndsAt = hotel.licenseGraceEndsAt;

    let isWithinGrace = false;
    if (status === 'EXPIRED' && graceEndsAt && now < graceEndsAt) {
        isWithinGrace = true;
    }

    if (status === 'ACTIVE' && expiresAt && now > expiresAt) {
        const graceEnd = new Date(expiresAt.getTime() + GRACE_PERIOD_HOURS * 60 * 60 * 1000);

        await db.update(hotels)
            .set({
                licenseStatus: 'EXPIRED',
                licenseGraceEndsAt: graceEnd,
                updatedAt: new Date()
            })
            .where(eq(hotels.id, hotelId));

        return {
            status: 'EXPIRED',
            expiresAt,
            graceEndsAt: graceEnd,
            isWithinGrace: now < graceEnd
        };
    }

    if (status === 'TRIAL' && expiresAt && now > expiresAt) {
        const graceEnd = new Date(expiresAt.getTime() + GRACE_PERIOD_HOURS * 60 * 60 * 1000);

        await db.update(hotels)
            .set({
                licenseStatus: 'EXPIRED',
                licenseGraceEndsAt: graceEnd,
                updatedAt: new Date()
            })
            .where(eq(hotels.id, hotelId));

        return {
            status: 'EXPIRED',
            expiresAt,
            graceEndsAt: graceEnd,
            isWithinGrace: now < graceEnd
        };
    }

    return {
        status,
        expiresAt,
        graceEndsAt,
        isWithinGrace
    };
}

export function isLicenseValid(licenseInfo: LicenseInfo): boolean {
    const { status, isWithinGrace } = licenseInfo;

    switch (status) {
        case 'ACTIVE':
        case 'TRIAL':
            return true;
        case 'EXPIRED':
            return isWithinGrace;
        case 'PAUSED':
        case 'REVOKED':
        case 'PENDING_PAYMENT':
            return false;
        default:
            return false;
    }
}

export function getLicenseErrorMessage(licenseInfo: LicenseInfo): string {
    const { status, graceEndsAt, isWithinGrace } = licenseInfo;

    switch (status) {
        case 'EXPIRED':
            if (isWithinGrace && graceEndsAt) {
                const hoursLeft = Math.ceil((graceEndsAt.getTime() - Date.now()) / (1000 * 60 * 60));
                return `License expired. Grace period ends in ${hoursLeft} hours. Please renew your subscription.`;
            }
            return 'License has expired. Please renew your subscription to continue.';
        case 'PAUSED':
            return 'Your subscription is paused. Please contact support or make a payment to resume.';
        case 'REVOKED':
            return 'Your license has been revoked. Please contact support.';
        case 'PENDING_PAYMENT':
            return 'Payment pending. Please complete your subscription payment to continue.';
        default:
            return 'Invalid license status. Please contact support.';
    }
}

/**
 * Global license middleware - automatically validates license for all hotel staff requests
 * Super admins and guests bypass this check
 * Exempt paths are not checked
 */
export const licenseMiddleware = (app: Elysia) => app.onBeforeHandle(async ({ path, set, ...ctx }) => {
    const user = (ctx as any).user as User | null;

    // Skip for unauthenticated requests
    if (!user) return;

    // Skip for exempt paths
    if (isExemptPath(path)) return;

    // Super admins always bypass license checks
    if (user.type === 'SUPER_ADMIN') return;

    // Guests don't have hotel-level license restrictions
    if (user.type === 'GUEST') return;

    // Hotel staff must have a valid license
    if (!user.hotelId) {
        set.status = 403;
        return {
            status: 'error',
            code: 'NO_HOTEL_CONTEXT',
            message: 'No hotel context found for user.'
        };
    }

    const licenseInfo = await validateLicense(user.hotelId);

    if (!isLicenseValid(licenseInfo)) {
        set.status = 403;
        return {
            status: 'error',
            code: 'LICENSE_INVALID',
            licenseStatus: licenseInfo.status,
            message: getLicenseErrorMessage(licenseInfo),
            expiresAt: licenseInfo.expiresAt,
            graceEndsAt: licenseInfo.graceEndsAt
        };
    }
});
