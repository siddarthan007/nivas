/**
 * Single source of truth for property-type module gating (hotel / F&B / banquets).
 * Used by ModuleGuard, Sidebar (via useModuleConfig), and Dashboard widgets/actions.
 */

export interface PropertyModuleConfig {
    enableHotel: boolean;
    enableFoodAndBeverage: boolean;
    enableBanquets: boolean;
}

export const HOTEL_ROUTE_PREFIXES = [
    '/hotel/rooms',
    '/hotel/bookings',
    '/hotel/housekeeping',
    '/hotel/operations/floor-plan',
    '/hotel/guests',
] as const;

export const FB_ROUTE_PREFIXES = [
    '/hotel/orders',
    '/hotel/menu',
    '/hotel/operations/tables',
    '/hotel/kitchen',
    '/hotel/pos',
] as const;

export const HOTEL_ONLY_NAV_IDS = new Set(['rooms', 'bookings', 'housekeeping', 'floor-plan', 'guests']);
export const FB_ONLY_NAV_IDS = new Set(['orders', 'menu', 'table-plan', 'kitchen', 'pos']);
export const BANQUET_ONLY_NAV_IDS = new Set(['events']);

export const HOTEL_ONLY_WIDGET_IDS = new Set([
    'occupied', 'vacant', 'arrivals', 'departures', 'checkins', 'dirty', 'advance',
]);

export const FB_ONLY_WIDGET_IDS = new Set([
    'totalOrders', 'qrOrders', 'menuItems', 'bestHour', 'orders', 'active-orders',
    'tables', 'menu', 'pending',
]);

export function isPathAllowedByPropertyModules(pathname: string, config: PropertyModuleConfig): boolean {
    if (HOTEL_ROUTE_PREFIXES.some(p => pathname.startsWith(p)) && !config.enableHotel) return false;
    if (FB_ROUTE_PREFIXES.some(p => pathname.startsWith(p)) && !config.enableFoodAndBeverage) return false;
    if (pathname.startsWith('/hotel/events') && !config.enableBanquets) return false;
    return true;
}

export function isNavIdAllowed(navId: string, config: PropertyModuleConfig): boolean {
    if (HOTEL_ONLY_NAV_IDS.has(navId) && !config.enableHotel) return false;
    if (FB_ONLY_NAV_IDS.has(navId) && !config.enableFoodAndBeverage) return false;
    if (BANQUET_ONLY_NAV_IDS.has(navId) && !config.enableBanquets) return false;
    return true;
}

export function isWidgetAllowed(widgetId: string, config: PropertyModuleConfig): boolean {
    if (HOTEL_ONLY_WIDGET_IDS.has(widgetId) && !config.enableHotel) return false;
    if (FB_ONLY_WIDGET_IDS.has(widgetId) && !config.enableFoodAndBeverage) return false;
    if (widgetId === 'events' && !config.enableBanquets) return false;
    return true;
}

export function isQuickActionAllowed(href: string, config: PropertyModuleConfig): boolean {
    return isPathAllowedByPropertyModules(href, config);
}
