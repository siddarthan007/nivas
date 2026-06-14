import { Elysia } from 'elysia';
import { db } from '../db';
import { tenantFeatures } from '../db/schema';
import { eq } from 'drizzle-orm';
import { cache } from '../shared/redis';
import type { User } from './auth.middleware';

const EXEMPT_PREFIXES = [
    '/auth',
    '/guest',
    '/saas-billing',
    '/saas-admin',
    '/settings',
    '/notifications',
    '/profile',
    '/health',
    '/storage',
    '/crm',
];

/** Hotel-only API prefixes — blocked when enableHotel is false. */
const HOTEL_PREFIXES = [
    '/rooms',
    '/bookings',
    '/housekeeping',
    '/night-audit',
    '/billing/bookings',
    '/folio',
    '/operations/floor-plan',
];

const BANQUETS_PREFIXES = ['/banquets'];

/** F&B-only API prefixes — blocked when enableFoodAndBeverage is false. */
const FNB_PREFIXES = [
    '/orders',
    '/menu',
    '/tables',
    '/operations/tables',
    '/kitchen',
];

const featureCacheKey = (hotelId: number) => `tenant-features:${hotelId}`;

async function getTenantFeatures(hotelId: number) {
    const cached = await cache.getJSON<{ enableHotel: boolean; enableFoodAndBeverage: boolean; enableBanquets: boolean }>(featureCacheKey(hotelId));
    if (cached) return cached;

    const row = await db.query.tenantFeatures.findFirst({
        where: eq(tenantFeatures.hotelId, hotelId),
        columns: { enableHotel: true, enableFoodAndBeverage: true, enableBanquets: true },
    });
    const result = {
        enableHotel: row?.enableHotel ?? true,
        enableFoodAndBeverage: row?.enableFoodAndBeverage ?? true,
        enableBanquets: row?.enableBanquets ?? false,
    };
    await cache.setJSON(featureCacheKey(hotelId), result, 60);
    return result;
}

/**
 * Enforce tenant module toggles (restaurant-only / hotel-only / both).
 * Independent of plan gating — disabling a module returns 403 without affecting core flows.
 */
export const tenantFeatureMiddleware = new Elysia({ name: 'tenant-feature' })
    .onBeforeHandle(async (ctx) => {
        const { user, path, set } = ctx as typeof ctx & { user?: User | null };
        if (!user?.hotelId || user.type === 'SUPER_ADMIN') return;
        const apiPath = path.replace(/^\/api\/v1/, '') || path;
        if (EXEMPT_PREFIXES.some(p => apiPath.startsWith(p))) return;

        const features = await getTenantFeatures(user.hotelId);

        if (!features.enableHotel && HOTEL_PREFIXES.some(p => apiPath.startsWith(p))) {
            set.status = 403;
            return {
                status: 'error',
                code: 'MODULE_DISABLED',
                message: 'Hotel module is disabled for this property. Enable it in Settings → Features.',
            };
        }

        if (!features.enableFoodAndBeverage && FNB_PREFIXES.some(p => apiPath.startsWith(p))) {
            set.status = 403;
            return {
                status: 'error',
                code: 'MODULE_DISABLED',
                message: 'Food & Beverage module is disabled for this property. Enable it in Settings → Features.',
            };
        }

        if (!features.enableBanquets && BANQUETS_PREFIXES.some(p => apiPath.startsWith(p))) {
            set.status = 403;
            return {
                status: 'error',
                code: 'FEATURE_DISABLED',
                message: 'Banquets & events are disabled for this property. Enable them in Settings → Features.',
            };
        }
    });
