import { PERMISSIONS, SYSTEM_ROLES } from './permissions';

/** Simplified mobile staff personas — each role maps to one focused experience. */
export type MobilePersonaId =
    | 'owner'
    | 'manager'
    | 'receptionist'
    | 'waiter'
    | 'housekeeping'
    | 'kitchen';

export type MobileTabId =
    | 'home'
    | 'orders'
    | 'housekeeping'
    | 'kitchen'
    | 'procurement'
    | 'analytics'
    | 'messages'
    | 'notifications'
    | 'profile'
    | 'attendance';

const ROLE_PERSONA_MAP: Record<string, MobilePersonaId> = {
    [SYSTEM_ROLES.OWNER]: 'owner',
    [SYSTEM_ROLES.ACCOUNTANT]: 'owner',
    [SYSTEM_ROLES.MANAGER]: 'manager',
    [SYSTEM_ROLES.FRONT_DESK]: 'receptionist',
    [SYSTEM_ROLES.RECEPTIONIST]: 'receptionist',
    [SYSTEM_ROLES.WAITER]: 'waiter',
    [SYSTEM_ROLES.HOUSEKEEPER]: 'housekeeping',
    [SYSTEM_ROLES.HOUSEKEEPING_SUPERVISOR]: 'housekeeping',
    [SYSTEM_ROLES.KITCHEN_MANAGER]: 'kitchen',
};

/** Default tab order per persona — mobile only shows what the role needs. */
const PERSONA_TABS: Record<MobilePersonaId, MobileTabId[]> = {
    owner: ['home', 'attendance', 'analytics', 'profile', 'notifications'],
    manager: ['home', 'attendance', 'orders', 'housekeeping', 'profile', 'notifications'],
    receptionist: ['home', 'attendance', 'orders', 'profile', 'notifications'],
    waiter: ['home', 'attendance', 'orders', 'profile', 'notifications'],
    housekeeping: ['home', 'attendance', 'housekeeping', 'profile', 'notifications'],
    kitchen: ['home', 'attendance', 'kitchen', 'profile', 'notifications'],
};

/** Permission required to show each tab (any match). */
const TAB_PERMISSIONS: Record<MobileTabId, string[]> = {
    home: [],
    orders: [
        PERMISSIONS.ORDERS.READ,
        PERMISSIONS.ORDERS.CREATE,
        PERMISSIONS.RESTAURANT.VIEW_TABLES,
    ],
    housekeeping: [
        PERMISSIONS.HOUSEKEEPING.VIEW,
        PERMISSIONS.HOUSEKEEPING.VIEW_TASKS,
        PERMISSIONS.ROOMS.MANAGE_CLEANING,
    ],
    kitchen: [PERMISSIONS.ORDERS.READ, PERMISSIONS.ORDERS.UPDATE_STATUS],
    procurement: [
        PERMISSIONS.INVENTORY.MANAGE_PROCUREMENT,
        PERMISSIONS.INVENTORY.REQUEST_STOCK,
        PERMISSIONS.INVENTORY.READ,
    ],
    analytics: [
        PERMISSIONS.ANALYTICS.VIEW_FINANCIALS,
        PERMISSIONS.ANALYTICS.VIEW_OPERATIONS,
        PERMISSIONS.REPORTS.VIEW_SALES,
    ],
    messages: [PERMISSIONS.COMMUNICATIONS.READ_MESSAGES],
    notifications: [PERMISSIONS.NOTIFICATIONS.VIEW],
    profile: [],
    attendance: [],
};

function hasAnyPermission(permissions: string[], required: string[]): boolean {
    if (permissions.includes('*')) return true;
    if (required.length === 0) return true;
    return required.some(p => permissions.includes(p));
}

export function resolveMobilePersona(roleName: string | undefined | null, permissions: string[] = []) {
    const persona: MobilePersonaId = ROLE_PERSONA_MAP[roleName ?? ''] ?? 'receptionist';
    const candidateTabs = PERSONA_TABS[persona];
    const tabs = candidateTabs.filter(tab => hasAnyPermission(permissions, TAB_PERMISSIONS[tab]));

  return {
        persona,
        tabs,
        capabilities: {
            viewFinancialAnalytics: hasAnyPermission(permissions, [PERMISSIONS.ANALYTICS.VIEW_FINANCIALS]),
            viewOperationsAnalytics: hasAnyPermission(permissions, [PERMISSIONS.ANALYTICS.VIEW_OPERATIONS, PERMISSIONS.REPORTS.VIEW_SALES]),
            manageProcurement: hasAnyPermission(permissions, [PERMISSIONS.INVENTORY.MANAGE_PROCUREMENT]),
            pos: hasAnyPermission(permissions, [PERMISSIONS.ORDERS.CREATE, PERMISSIONS.RESTAURANT.VIEW_TABLES]),
            kitchenQueue: hasAnyPermission(permissions, [PERMISSIONS.ORDERS.UPDATE_STATUS]),
            housekeepingTasks: hasAnyPermission(permissions, [PERMISSIONS.HOUSEKEEPING.VIEW_TASKS, PERMISSIONS.HOUSEKEEPING.UPDATE_STATUS]),
            bookings: hasAnyPermission(permissions, [PERMISSIONS.BOOKINGS.READ]),
            approveAttendance: hasAnyPermission(permissions, [PERMISSIONS.USERS.UPDATE]),
            paymentQr: persona === 'manager' || persona === 'receptionist' || persona === 'waiter'
                || hasAnyPermission(permissions, [PERMISSIONS.FINANCE.RECORD_PAYMENT, PERMISSIONS.ORDERS.CREATE]),
        },
    };
}
