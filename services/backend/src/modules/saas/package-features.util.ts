/**
 * Derives tenant_features flags from a subscription package.
 * Used on subscribe, trial, payment activation, and admin plan updates.
 */

export const PACKAGE_FEATURE_KEYS = [
    'enableSmsNotifications',
    'enableWhatsappNotifications',
    'enableEmailNotifications',
    'enableBanquets',
    'enablePosIntegration',
    'enableInventory',
    'enableHousekeeping',
    'enableGuestPortal',
    'enableFonepay',
    'enableCbms',
    'enableAi',
] as const;

/** Hotel / lodge front-office modules — can run without F&B or venues */
const HOTEL_MODULE_IDS = new Set([
    'rooms', 'bookings', 'housekeeping', 'floor-plan', 'guests', 'crm', 'gantt',
]);

/** Restaurant / standalone F&B — can run without hotel rooms */
const FB_MODULE_IDS = new Set([
    'orders', 'menu', 'pos', 'table-plan', 'kitchen',
]);

/** Venues, banquets, events — independent of hotel and restaurant */
const VENUE_MODULE_IDS = new Set(['events', 'venues', 'banquets']);

export type PackageLike = {
    features?: string[] | null;
    modules?: string[] | null;
};

export function buildTenantFeatureFlags(pkg: PackageLike): Record<string, boolean> {
    const featSet = new Set((pkg.features || []) as string[]);
    const moduleSet = new Set((pkg.modules || []) as string[]);

    const flags: Record<string, boolean> = {};
    for (const k of PACKAGE_FEATURE_KEYS) {
        flags[k] = featSet.has(k);
    }

    flags.enableHotel = [...moduleSet].some((m) => HOTEL_MODULE_IDS.has(m));
    flags.enableFoodAndBeverage = [...moduleSet].some((m) => FB_MODULE_IDS.has(m));
    flags.enableBanquets =
        featSet.has('enableBanquets') || [...moduleSet].some((m) => VENUE_MODULE_IDS.has(m));

    return flags;
}
