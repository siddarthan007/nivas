import { db } from '../../db';
import { rooms, users, subscriptions, roles } from '../../db/schema';
import { eq, and, count, sql } from 'drizzle-orm';
import { BusinessLogicError, ForbiddenError } from '../../utils/errors';
import { relationOne } from '../../utils/relation';

/** Route prefix → subscription package module id */
export const API_PATH_TO_MODULE: Record<string, string> = {
    '/rooms': 'rooms',
    '/bookings': 'bookings',
    '/housekeeping': 'housekeeping',
    '/operations/floor-plan': 'floor-plan',
    '/operations/tables': 'table-plan',
    '/guests': 'crm',
    '/crm': 'crm',
    '/corporate': 'crm',
    '/orders': 'orders',
    '/menu': 'menu',
    '/inventory': 'inventory',
    '/procurement': 'inventory',
    '/finance': 'finance',
    '/invoices': 'finance',
    '/billing': 'finance',
    '/credit-notes': 'finance',
    '/night-audit': 'finance',
    '/reports': 'reports',
    '/analytics': 'reports',
    '/staff': 'staff',
    '/iam': 'staff',
    '/users': 'staff',
    '/roles': 'roles',
    '/banquets': 'events',
    '/venues': 'venues',
    '/hr': 'staff',
    '/attendance': 'staff',
};

const FEATURE_TOGGLE_IDS = [
    'enableGuestPortal',
    'enableFonepay',
    'enableAi',
    'enableCbms',
    'enableBanquets',
    'enableHousekeeping',
    'enableInventory',
    'enableWhatsappNotifications',
] as const;

export const PlanLimitsService = {
    async getPackage(hotelId: number) {
        const sub = await db.query.subscriptions.findFirst({
            where: eq(subscriptions.hotelId, hotelId),
            with: { package: true },
        });
        return relationOne(sub?.package);
    },

    async assertCanAddRooms(hotelId: number, addCount = 1) {
        const pkg = await this.getPackage(hotelId);
        const max = pkg?.maxRooms;
        if (!max || max <= 0) return;
        const roomCount = await db
            .select({ total: count() })
            .from(rooms)
            .where(eq(rooms.hotelId, hotelId));
        const total = roomCount[0]?.total ?? 0;
        if (Number(total) + addCount > max) {
            throw new BusinessLogicError(`Room limit reached (${max}). Upgrade your plan to add more rooms.`);
        }
    },

    async assertCanAddUser(hotelId: number) {
        const pkg = await this.getPackage(hotelId);
        const max = pkg?.maxUsers;
        if (!max || max <= 0) return;
        const userCount = await db
            .select({ total: count() })
            .from(users)
            .where(and(eq(users.hotelId, hotelId), eq(users.isActive, true)));
        const total = userCount[0]?.total ?? 0;
        if (Number(total) >= max) {
            throw new BusinessLogicError(`Staff limit reached (${max}). Upgrade your plan to add more users.`);
        }
    },

    async assertRoleAllowed(hotelId: number, roleId: number) {
        const pkg = await this.getPackage(hotelId);
        const allowed = (pkg?.allowedRoles as string[]) || [];
        if (allowed.length === 0 || allowed.length >= 8) return;

        const role = await db.query.roles.findFirst({
            where: and(eq(roles.id, roleId), eq(roles.hotelId, hotelId)),
            columns: { name: true },
        });
        if (!role) return;

        const normalized = role.name.trim().toLowerCase();
        if (normalized === 'owner' || normalized === 'manager') return;

        const match = allowed.some(ar => {
            const a = ar.trim().toLowerCase();
            return a === normalized || normalized.includes(a) || a.includes(normalized);
        });
        if (!match) {
            throw new ForbiddenError(`Role "${role.name}" is not included in your subscription plan.`);
        }
    },

    async assertFeatureEnabled(hotelId: number, featureId: string) {
        const pkg = await this.getPackage(hotelId);
        const features = (pkg?.features as string[]) || [];
        if (features.length === 0) return;
        if (!features.includes(featureId)) {
            throw new ForbiddenError(`Feature "${featureId}" is not included in your plan.`);
        }
    },

    async validateFeatureToggle(hotelId: number, toggles: Record<string, boolean | undefined>) {
        for (const key of FEATURE_TOGGLE_IDS) {
            if (toggles[key] === true) {
                await this.assertFeatureEnabled(hotelId, key);
            }
        }
        if (toggles.enableHotel === true) {
            await this.assertModuleEnabled(hotelId, 'rooms');
        }
        if (toggles.enableFoodAndBeverage === true) {
            await this.assertModuleEnabled(hotelId, 'orders');
        }
    },

    async assertModuleEnabled(hotelId: number, moduleId: string) {
        const pkg = await this.getPackage(hotelId);
        const modules = (pkg?.modules as string[]) || [];
        if (modules.length === 0) return;
        if (!modules.includes(moduleId)) {
            throw new ForbiddenError(`Module "${moduleId}" is not included in your plan.`);
        }
    },

    async assertModuleForPath(hotelId: number, path: string) {
        const pkg = await this.getPackage(hotelId);
        const modules = (pkg?.modules as string[]) || [];
        if (modules.length === 0) return;

        for (const [prefix, moduleId] of Object.entries(API_PATH_TO_MODULE)) {
            if (path.startsWith(prefix) || path.includes(prefix)) {
                if (!modules.includes(moduleId)) {
                    throw new ForbiddenError(`Module "${moduleId}" is not included in your plan.`);
                }
                return;
            }
        }
    },
};
