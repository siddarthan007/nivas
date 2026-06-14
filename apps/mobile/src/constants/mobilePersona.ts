/** Tab ids returned by backend `profile.mobile.tabs` */
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

/** @deprecated Legacy API tab id — mapped to profile in the app */
export type LegacyMobileTabId = MobileTabId | 'more';

export type MobilePersonaId =
    | 'owner'
    | 'manager'
    | 'receptionist'
    | 'waiter'
    | 'housekeeping'
    | 'kitchen';

export interface MobileCapabilities {
    viewFinancialAnalytics?: boolean;
    viewOperationsAnalytics?: boolean;
    manageProcurement?: boolean;
    pos?: boolean;
    kitchenQueue?: boolean;
    housekeepingTasks?: boolean;
    bookings?: boolean;
    approveAttendance?: boolean;
    paymentQr?: boolean;
}

export interface MobilePersonaPayload {
    persona: MobilePersonaId;
    tabs: LegacyMobileTabId[];
    capabilities: MobileCapabilities;
}

export const TAB_ROUTE_MAP: Record<MobileTabId, { name: string; href: string }> = {
    home: { name: 'Home', href: '' },
    orders: { name: 'Orders', href: 'orders' },
    housekeeping: { name: 'Rooms', href: 'housekeeping' },
    kitchen: { name: 'Kitchen', href: 'kitchen' },
    procurement: { name: 'Procurement', href: 'procurement' },
    analytics: { name: 'Analytics', href: 'analytics' },
    messages: { name: 'Chat', href: 'messages' },
    notifications: { name: 'Alerts', href: 'notifications' },
    profile: { name: 'Profile', href: 'profile' },
    attendance: { name: 'Attendance', href: 'attendance' },
};

/** Fallback when profile has no mobile block (older API / offline). */
export function fallbackPersonaFromRole(roleName: string): MobilePersonaPayload {
    const role = roleName?.trim() || '';
    const map: Record<string, MobilePersonaId> = {
        Owner: 'owner',
        Accountant: 'owner',
        Manager: 'manager',
        'Front Desk': 'receptionist',
        Receptionist: 'receptionist',
        Waiter: 'waiter',
        Housekeeper: 'housekeeping',
        'Housekeeping Supervisor': 'housekeeping',
        'Kitchen Manager': 'kitchen',
    };
    const persona = map[role] ?? 'receptionist';
    const tabsByPersona: Record<MobilePersonaId, MobileTabId[]> = {
        owner: ['home', 'attendance', 'analytics', 'profile', 'notifications'],
        manager: ['home', 'attendance', 'orders', 'housekeeping', 'profile', 'notifications'],
        receptionist: ['home', 'attendance', 'orders', 'profile', 'notifications'],
        waiter: ['home', 'attendance', 'orders', 'profile', 'notifications'],
        housekeeping: ['home', 'attendance', 'housekeeping', 'profile', 'notifications'],
        kitchen: ['home', 'attendance', 'kitchen', 'profile', 'notifications'],
    };
    return { persona, tabs: tabsByPersona[persona], capabilities: {
        paymentQr: persona === 'manager' || persona === 'receptionist' || persona === 'waiter',
    } };
}
