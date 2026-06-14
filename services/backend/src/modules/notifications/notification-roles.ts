import { SYSTEM_ROLES } from '../../config/permissions';

export const MANAGER_ROLES = ['Owner', 'Manager', 'General Manager'] as const;

export type ManagerRole = typeof MANAGER_ROLES[number];

export function isManagerRole(role: string): boolean {
    return (MANAGER_ROLES as readonly string[]).includes(role);
}

/** Seeded role names used for notification targeting — must match SYSTEM_ROLES values. */
export const NOTIFY_ROLES = {
    KITCHEN: [SYSTEM_ROLES.KITCHEN_MANAGER, SYSTEM_ROLES.WAITER],
    FRONT_DESK: [SYSTEM_ROLES.RECEPTIONIST, SYSTEM_ROLES.FRONT_DESK],
    HOUSEKEEPING: [SYSTEM_ROLES.HOUSEKEEPER, SYSTEM_ROLES.HOUSEKEEPING_SUPERVISOR],
    MANAGEMENT: [SYSTEM_ROLES.OWNER, SYSTEM_ROLES.MANAGER],
    ACCOUNTING: [SYSTEM_ROLES.ACCOUNTANT],
} as const;
