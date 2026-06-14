import { db } from '../../db';
import { roles, users } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { PERMISSIONS, SYSTEM_ROLES } from '../../config/permissions';
import { resolveMobilePersona } from '../../config/mobile-persona';
import { UnauthorizedError, ForbiddenError } from '../../utils/errors';
import type { User } from '../../middlewares/auth.middleware';

/**
 * Access Control Service
 * Manages Roles, Permissions, and System Security Policies
 */
export const AccessControlService = {
    /**
     * Seeds the default system roles for a new hotel (Tenant)
     * This ensures every hotel starts with a robust set of predefined roles.
     */
    async seedDefaultRoles(hotelId: number) {
        const staffNotifications = [
            PERMISSIONS.NOTIFICATIONS.VIEW,
            PERMISSIONS.NOTIFICATIONS.MARK_READ,
        ];

        const defaultRoles = [
            {
                name: SYSTEM_ROLES.OWNER,
                level: 0,
                permissions: Object.values(PERMISSIONS).flatMap(group => Object.values(group)), // All permissions
            },
            {
                name: SYSTEM_ROLES.MANAGER,
                level: 1,
                permissions: [
                    ...Object.values(PERMISSIONS.BOOKINGS),
                    ...Object.values(PERMISSIONS.GUESTS),
                    ...Object.values(PERMISSIONS.ROOMS),
                    ...Object.values(PERMISSIONS.ORDERS),
                    ...Object.values(PERMISSIONS.HOUSEKEEPING),
                    ...Object.values(PERMISSIONS.REPORTS),
                    ...Object.values(PERMISSIONS.INVENTORY),
                    PERMISSIONS.FINANCE.VIEW_RECORDS,
                    PERMISSIONS.FINANCE.GENERATE_INVOICE,
                    PERMISSIONS.USERS.READ,
                    PERMISSIONS.USERS.CREATE,
                    PERMISSIONS.SHIFTS.VIEW_ALL,
                    PERMISSIONS.ANALYTICS.VIEW_OPERATIONS,
                    PERMISSIONS.RESTAURANT.VIEW_TABLES,
                    ...staffNotifications,
                ]
            },
            {
                name: SYSTEM_ROLES.FRONT_DESK,
                level: 2,
                permissions: [
                    ...Object.values(PERMISSIONS.BOOKINGS),
                    ...Object.values(PERMISSIONS.GUESTS),
                    PERMISSIONS.ROOMS.VIEW_STATUS,
                    PERMISSIONS.ROOMS.UPDATE,
                    PERMISSIONS.ORDERS.CREATE,
                    PERMISSIONS.ORDERS.READ,
                    PERMISSIONS.RESTAURANT.VIEW_TABLES,
                    PERMISSIONS.FINANCE.GENERATE_INVOICE,
                    PERMISSIONS.FINANCE.RECORD_PAYMENT,
                    PERMISSIONS.COMMUNICATIONS.SEND_MESSAGE,
                    ...staffNotifications,
                ]
            },
            {
                name: SYSTEM_ROLES.RECEPTIONIST,
                level: 2,
                permissions: [
                    ...Object.values(PERMISSIONS.BOOKINGS),
                    ...Object.values(PERMISSIONS.GUESTS),
                    PERMISSIONS.ROOMS.VIEW_STATUS,
                    PERMISSIONS.ROOMS.UPDATE,
                    PERMISSIONS.ORDERS.CREATE,
                    PERMISSIONS.ORDERS.READ,
                    PERMISSIONS.RESTAURANT.VIEW_TABLES,
                    PERMISSIONS.FINANCE.GENERATE_INVOICE,
                    PERMISSIONS.FINANCE.RECORD_PAYMENT,
                    PERMISSIONS.COMMUNICATIONS.SEND_MESSAGE,
                    PERMISSIONS.COMMUNICATIONS.READ_MESSAGES,
                    ...staffNotifications,
                ]
            },
            {
                name: SYSTEM_ROLES.HOUSEKEEPER,
                level: 4,
                permissions: [
                    PERMISSIONS.HOUSEKEEPING.VIEW,
                    PERMISSIONS.HOUSEKEEPING.VIEW_TASKS,
                    PERMISSIONS.HOUSEKEEPING.UPDATE_STATUS,
                    PERMISSIONS.ROOMS.VIEW_STATUS,
                    PERMISSIONS.COMMUNICATIONS.SEND_MESSAGE,
                    PERMISSIONS.COMMUNICATIONS.READ_MESSAGES,
                    ...staffNotifications,
                ]
            },
            {
                name: SYSTEM_ROLES.ACCOUNTANT,
                level: 2,
                permissions: [
                    ...Object.values(PERMISSIONS.FINANCE),
                    ...Object.values(PERMISSIONS.REPORTS),
                    PERMISSIONS.ANALYTICS.VIEW_FINANCIALS,
                    PERMISSIONS.INVENTORY.MANAGE_PROCUREMENT,
                ]
            },
            {
                name: SYSTEM_ROLES.HOUSEKEEPING_SUPERVISOR,
                level: 3,
                permissions: [
                    ...Object.values(PERMISSIONS.HOUSEKEEPING),
                    PERMISSIONS.ROOMS.VIEW_STATUS,
                    PERMISSIONS.ROOMS.MANAGE_CLEANING,
                    PERMISSIONS.INVENTORY.REQUEST_STOCK,
                    PERMISSIONS.COMMUNICATIONS.SEND_MESSAGE,
                    PERMISSIONS.COMMUNICATIONS.READ_MESSAGES,
                    ...staffNotifications,
                ]
            },
            {
                name: SYSTEM_ROLES.KITCHEN_MANAGER,
                level: 3,
                permissions: [
                    PERMISSIONS.ORDERS.READ,
                    PERMISSIONS.ORDERS.UPDATE_STATUS,
                    PERMISSIONS.MENU.VIEW,
                    PERMISSIONS.INVENTORY.READ,
                    PERMISSIONS.INVENTORY.REQUEST_STOCK,
                    PERMISSIONS.COMMUNICATIONS.SEND_MESSAGE,
                    PERMISSIONS.COMMUNICATIONS.READ_MESSAGES,
                    ...staffNotifications,
                ]
            },
            {
                name: SYSTEM_ROLES.WAITER,
                level: 4,
                permissions: [
                    PERMISSIONS.ORDERS.CREATE,
                    PERMISSIONS.ORDERS.READ,
                    PERMISSIONS.ORDERS.UPDATE_STATUS,
                    PERMISSIONS.MENU.VIEW,
                    PERMISSIONS.RESTAURANT.VIEW_TABLES,
                    PERMISSIONS.COMMUNICATIONS.SEND_MESSAGE,
                    PERMISSIONS.COMMUNICATIONS.READ_MESSAGES,
                    ...staffNotifications,
                ]
            }
        ];

        for (const role of defaultRoles) {
            // Check if role exists
            const existing = await db.query.roles.findFirst({
                where: and(eq(roles.hotelId, hotelId), eq(roles.name, role.name))
            });

            if (!existing) {
                await db.insert(roles).values({
                    hotelId,
                    name: role.name,
                    level: role.level,
                    permissions: role.permissions as string[]
                });
            } else if (existing.level === 99) {
                // Update existing role with correct level if it was defaulted
                await db.update(roles)
                    .set({ level: role.level })
                    .where(eq(roles.id, existing.id));
            }
        }
    },

    /**
     * Strictly enforces a permission check, throwing error if failed.
     * Useful for deep service-layer checks where middleware might be bypassed or insufficient context.
     */
    enforce(user: User | null, requiredPermission: string) {
        if (!user) throw new UnauthorizedError('User not authenticated');

        if (user.type === 'SUPER_ADMIN') return; // Pass

        if (!user.permissions.includes(requiredPermission)) {
            throw new ForbiddenError(`Access Denied: Missing ${requiredPermission}`);
        }
    },

    /**
     * Checks if a user is a System Owner or Super Admin
     */
    isSystemOwner(user: User) {
        return user.type === 'SUPER_ADMIN' || user.role?.name === SYSTEM_ROLES.OWNER;
    }
};
