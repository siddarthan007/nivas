import { db } from '../../db';
import { users, hotels, subscriptionPackages } from '../../db/schema';
import { HttpError, BusinessLogicError } from '../../utils/errors';
import { eq, and, sql } from 'drizzle-orm';
import { NotFoundError, UnauthorizedError } from '../../utils/errors';
import { LicenseService } from './license.service';
import { saasPayments, roles, platformSettings, subscriptions, tenantFeatures } from '../../db/schema';
import { AccessControlService } from '../system/access-control.service';

export const SaasAdminService = {
    /** Platform support contacts (shown to hotels in the support panel). */
    async getSupportConfig() {
        const ps: any = await db.query.platformSettings.findFirst({ where: eq(platformSettings.id, 1), columns: { supportConfig: true } });
        const c = (ps?.supportConfig || {}) as any;
        return { email: c.email || '', phone: c.phone || '', whatsapp: c.whatsapp || '', hours: c.hours || '' };
    },

    async setSupportConfig(data: { email?: string; phone?: string; whatsapp?: string; hours?: string }) {
        const ps: any = await db.query.platformSettings.findFirst({ where: eq(platformSettings.id, 1), columns: { supportConfig: true } });
        const next = { ...((ps?.supportConfig || {}) as any) };
        for (const k of ['email', 'phone', 'whatsapp', 'hours'] as const) if (data[k] !== undefined) next[k] = data[k];
        await db.insert(platformSettings).values({ id: 1, supportConfig: next } as any)
            .onConflictDoUpdate({ target: platformSettings.id, set: { supportConfig: next, updatedAt: new Date() } });
        return this.getSupportConfig();
    },

    /** Database storage report — biggest tables by on-disk size (for capacity planning). */
    async getDatabaseStats() {
        const rows: any = await db.execute(sql`
            SELECT c.relname AS table,
                   pg_total_relation_size(c.oid) AS bytes,
                   pg_size_pretty(pg_total_relation_size(c.oid)) AS size
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
            ORDER BY pg_total_relation_size(c.oid) DESC
            LIMIT 25`);
        const arr = ((rows?.rows ?? rows) as any[]) || [];
        const totalBytes = arr.reduce((s, r) => s + Number(r.bytes || 0), 0);

        // Exact COUNT(*) per table — stats estimates (reltuples/n_live_tup) read 0
        // until autovacuum analyzes a table, which is wrong on a fresh DB. Cheap
        // here (small DB, admin-only, cached). Names come from pg_class → safe to quote.
        const tables = await Promise.all(arr.map(async (r) => {
            let rowCount = 0;
            try {
                const c: any = await db.execute(sql.raw(`SELECT count(*)::int AS n FROM "${String(r.table).replace(/"/g, '')}"`));
                rowCount = Number(((c?.rows ?? c) as any[])[0]?.n || 0);
            } catch { /* view/perm issue → 0 */ }
            return { table: r.table, size: r.size, bytes: Number(r.bytes || 0), estRows: rowCount };
        }));
        return { totalBytes, tables };
    },

    async getAllTenants() {
        const allHotels = await db.query.hotels.findMany({
            columns: {
                id: true,
                name: true,
                slug: true,
                email: true,
                phone: true,
                isActive: true,
                licenseStatus: true,
                licenseExpiresAt: true,
                licenseGraceEndsAt: true,
                planTier: true,
                maxRooms: true,
                maxUsers: true,
                logoUrl: true,
                address: true,
                website: true,
                panNumber: true,
                vatNumber: true,
                serviceChargeRate: true,
                taxRate: true,
                createdAt: true
            },
            with: {
                users: {
                    with: { role: true }
                }
            },
            orderBy: (h, { desc }) => [desc(h.createdAt)]
        });

        return allHotels.map(hotel => {
            const owner = hotel.users.find(u => u.role?.name === 'Owner');
            // Remove users list from response to keep it clean, but use owner email if hotel email is missing
            const { users, ...hotelData } = hotel;
            return {
                ...hotelData,
                email: hotel.email || owner?.email || '',
                ownerName: owner?.fullName || '',
                licenseStatus: hotel.licenseStatus ?? 'TRIAL'
            };
        });
    },

    async onboardTenant(data: any, createdById: string) {
        return await db.transaction(async (tx) => {
            // 1. Create Hotel
            const [hotel] = await tx.insert(hotels).values({
                name: data.hotelName,
                slug: data.slug,
                email: data.hotelEmail,
                phone: data.hotelPhone,
                planTier: data.planTier,
                licenseStatus: 'TRIAL',
                licenseExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days trial
            }).returning();
            if (!hotel) throw new Error('Failed to create hotel');

            // 2. Create Owner Role
            const [role] = await tx.insert(roles).values({
                hotelId: hotel.id,
                name: 'Owner',
                level: 0,
                permissions: ['*'] // wildcard permission for owner
            }).returning();
            if (!role) throw new Error('Failed to create role');

            // 3. Seed default system roles (Manager, Front Desk, etc.)
            await AccessControlService.seedDefaultRoles(hotel.id);

            // 4. Create Admin User
            const hashedPassword = await Bun.password.hash(data.adminPassword);
            const [user] = await tx.insert(users).values({
                hotelId: hotel.id,
                fullName: data.adminName,
                email: data.adminEmail,
                phone: data.adminPhone,
                passwordHash: hashedPassword,
                userType: 'HOTEL_STAFF',
                roleId: role.id
            }).returning();
            if (!user) throw new Error('Failed to create user');

            return { hotel, user };
        });
    },

    async recordSaaSPayment(hotelId: number, data: any, createdById: string) {
        const [payment] = await db.insert(saasPayments).values({
            hotelId,
            amount: data.amount,
            paymentMethod: data.paymentMethod,
            reference: data.reference,
            notes: data.notes
        }).returning();

        return payment;
    },

    async getTenantDetails(hotelId: number) {
        try {
            const hotel = await LicenseService.getHotel(hotelId);
            const subscription = await LicenseService.getSubscription(hotelId);

            const usersCount = await db.query.users.findMany({
                where: and(eq(users.hotelId, hotelId), eq(users.isActive, true)),
                columns: { id: true }
            });

            return {
                hotel: { ...hotel, licenseStatus: hotel.licenseStatus ?? 'TRIAL' },
                subscription,
                usersCount: usersCount.length
            };
        } catch (err: any) {
            if (err instanceof BusinessLogicError || err instanceof NotFoundError) throw err;
            throw new HttpError(`Failed to load tenant details: ${err.message}`, 500, 'TENANT_DETAILS_ERROR');
        }
    },

    async updateTenantDetails(hotelId: number, data: any) {
        const allowed = ['name', 'slug', 'email', 'phone', 'address', 'website', 'logoUrl', 'panNumber', 'vatNumber', 'currency', 'checkInTime', 'checkOutTime', 'taxRate', 'serviceChargeRate', 'isActive', 'planTier', 'maxRooms', 'maxUsers'];
        const updateData: any = {};
        for (const key of allowed) {
            if (data[key] !== undefined) updateData[key] = data[key];
        }
        const [updatedHotel] = await db.update(hotels)
            .set({
                ...updateData,
                updatedAt: new Date()
            })
            .where(eq(hotels.id, hotelId))
            .returning();

        // ownerName lives on the owner USER (users.fullName), not hotels — update it.
        if (data.ownerName !== undefined && String(data.ownerName).trim()) {
            const owner = await db.query.users.findFirst({
                where: and(eq(users.hotelId, hotelId), eq(users.userType, 'HOTEL_STAFF')),
                with: { role: true },
                orderBy: (u, { asc }) => [asc(u.createdAt)],
            });
            const ownerUser = owner?.role?.name === 'Owner' ? owner
                : (await db.query.users.findFirst({ where: and(eq(users.hotelId, hotelId)), with: { role: true } }));
            if (ownerUser) {
                await db.update(users).set({ fullName: String(data.ownerName).trim() }).where(eq(users.id, ownerUser.id));
            }
        }

        return updatedHotel;
    },

    async pauseLicense(hotelId: number, userId: string, reason?: string, ip?: string) {
        return await LicenseService.pauseLicense(hotelId, userId, reason, ip);
    },

    async resumeLicense(hotelId: number, userId: string, reason?: string, ip?: string) {
        return await LicenseService.resumeLicense(hotelId, userId, reason, ip);
    },

    async revokeLicense(hotelId: number, userId: string, reason: string, ip?: string) {
        return await LicenseService.revokeLicense(hotelId, userId, reason, ip);
    },

    async grantTrial(hotelId: number, userId: string, days?: number, packageId?: number, ip?: string) {
        return await LicenseService.grantTrial(hotelId, userId, days, packageId, ip);
    },

    async activateLicense(hotelId: number, userId: string, billingCycle: 'MONTHLY' | 'ANNUAL', ip?: string) {
        return await LicenseService.activateLicense(hotelId, userId, billingCycle, ip);
    },

    async extendLicense(hotelId: number, userId: string, days: number, ip?: string) {
        return await LicenseService.extendLicense(hotelId, userId, days, ip);
    },

    async getTenantUsers(hotelId: number) {
        const tenantUsers = await db.query.users.findMany({
            where: eq(users.hotelId, hotelId),
            with: { role: true }
        });

        return tenantUsers.map(({ passwordHash, ...u }) => u);
    },

    async resetTenantUserPassword(hotelId: number, userId: string, password: string) {
        const hashedPassword = await Bun.password.hash(password);

        const [updatedUser] = await db.update(users)
            .set({
                passwordHash: hashedPassword,
                updatedAt: new Date()
            })
            .where(and(
                eq(users.id, userId),
                eq(users.hotelId, hotelId)
            ))
            .returning();

        if (!updatedUser) throw new NotFoundError('User');
        return updatedUser;
    },

    // Package Management (Moved from SaasBillingService)
    async getCreatePackages(isAdmin = false) {
        if (isAdmin) {
            return await db.query.subscriptionPackages.findMany({
                orderBy: (pkg, { asc }) => [asc(pkg.monthlyPrice)]
            });
        }
        return await db.query.subscriptionPackages.findMany({
            where: eq(subscriptionPackages.isActive, true),
            orderBy: (pkg, { asc }) => [asc(pkg.monthlyPrice)]
        });
    },

    async createPackage(data: any) {
        try {
            const [created] = await db.insert(subscriptionPackages).values({
                name: data.name,
                code: data.code,
                description: data.description,
                monthlyPrice: data.monthlyPrice.toString(),
                annualPrice: data.annualPrice?.toString(),
                maxRooms: data.maxRooms,
                maxUsers: data.maxUsers,
                features: data.features ?? [],
                modules: data.modules ?? [],
                allowedRoles: data.allowedRoles ?? [],
                trialDays: data.trialDays ?? 14
            }).returning();
            if (!created) throw new BusinessLogicError('Failed to create package');
            return created;
        } catch (error: any) {
            if (error.code === '23505') { // Unique violation
                throw new BusinessLogicError(`Plan code "${data.code}" already exists`);
            }
            throw error;
        }
    },

    async updatePackage(id: number, data: any) {
        const existing = await db.query.subscriptionPackages.findFirst({
            where: eq(subscriptionPackages.id, id)
        });
        if (!existing) throw new NotFoundError('Subscription package');

        const [updated] = await db.update(subscriptionPackages)
            .set({
                name: data.name,
                description: data.description,
                monthlyPrice: data.monthlyPrice?.toString(),
                annualPrice: data.annualPrice?.toString(),
                maxRooms: data.maxRooms,
                maxUsers: data.maxUsers,
                features: data.features,
                modules: data.modules,
                allowedRoles: data.allowedRoles,
                trialDays: data.trialDays,
                isActive: data.isActive,
                updatedAt: new Date()
            })
            .where(eq(subscriptionPackages.id, id))
            .returning();

        if (!updated) throw new BusinessLogicError('Failed to update package');

        // Propagate the new feature set to every hotel on this plan so a plan edit
        // (e.g. turning AI on) reflects immediately. Full sync across known flags.
        const FEATURE_KEYS = ['enableMultiCurrency', 'enableChannelManager', 'enableAdvancedRevenue', 'enableSmsNotifications', 'enableWhatsappNotifications', 'enableEmailNotifications', 'enableBanquets', 'enablePosIntegration', 'enableInventory', 'enableHousekeeping', 'enableGuestPortal', 'enableFonepay', 'enableCbms', 'enableAi'];
        const featSet = new Set(((updated.features || []) as string[]));
        const flags: Record<string, boolean> = {};
        for (const k of FEATURE_KEYS) flags[k] = featSet.has(k);
        const subs = await db.query.subscriptions.findMany({ where: eq(subscriptions.packageId, id), columns: { hotelId: true } });
        for (const s of subs) {
            if (!s.hotelId) continue;
            const ex = await db.query.tenantFeatures.findFirst({ where: eq(tenantFeatures.hotelId, s.hotelId) });
            if (ex) await db.update(tenantFeatures).set({ ...flags, updatedAt: new Date() }).where(eq(tenantFeatures.hotelId, s.hotelId));
            else await db.insert(tenantFeatures).values({ hotelId: s.hotelId, ...flags });
        }
        return updated;
    },

    getAvailableFeatures() {
        return [
            { id: 'enableMultiCurrency', label: 'Multi-Currency Support', category: 'Core' },
            { id: 'enableChannelManager', label: 'Channel Manager', category: 'Core' },
            { id: 'enableAdvancedRevenue', label: 'Advanced Revenue Management', category: 'Core' },
            { id: 'enableSmsNotifications', label: 'SMS Notifications', category: 'Notifications' },
            { id: 'enableWhatsappNotifications', label: 'WhatsApp Notifications', category: 'Notifications' },
            { id: 'enableEmailNotifications', label: 'Email Notifications', category: 'Notifications' },
            { id: 'enableBanquets', label: 'Banquet Management', category: 'Modules' },
            { id: 'enablePosIntegration', label: 'POS Integration', category: 'Modules' },
            { id: 'enableInventory', label: 'Inventory Management', category: 'Modules' },
            { id: 'enableHousekeeping', label: 'Housekeeping', category: 'Modules' },
            { id: 'enableGuestPortal', label: 'Guest Portal', category: 'Modules' },
            { id: 'enableFonepay', label: 'Fonepay Payments (Nepal)', category: 'Payments' },
            { id: 'enableCbms', label: 'IRD CBMS Sync (Nepal)', category: 'Compliance' },
            { id: 'enableAi', label: 'AI Engine (analytics + concierge)', category: 'AI' },
        ];
    },

    getAvailableModules() {
        return [
            { id: 'rooms', label: 'Rooms Management', category: 'Core' },
            { id: 'bookings', label: 'Bookings', category: 'Core' },
            { id: 'orders', label: 'Orders / F&B', category: 'Core' },
            { id: 'menu', label: 'Menu Management', category: 'Core' },
            { id: 'housekeeping', label: 'Housekeeping', category: 'Operations' },
            { id: 'gantt', label: 'Booking Calendar', category: 'Core' },
            { id: 'floor-plan', label: 'Floor Plan', category: 'Operations' },
            { id: 'table-plan', label: 'Table Plan', category: 'Operations' },
            { id: 'inventory', label: 'Inventory', category: 'Operations' },
            { id: 'reports', label: 'Reports & Analytics', category: 'Analytics' },
            { id: 'staff', label: 'Staff Management', category: 'HR' },
            { id: 'roles', label: 'Roles & Permissions', category: 'HR' },
            { id: 'finance', label: 'Finance', category: 'Analytics' },
            { id: 'revenue', label: 'Revenue Management', category: 'Analytics' },
            { id: 'crm', label: 'CRM / Guest Management', category: 'CRM' },
            { id: 'events', label: 'Events & Banquets', category: 'Operations' },
            { id: 'kitchen', label: 'Kitchen Display', category: 'Operations' },
            { id: 'messages', label: 'Messaging', category: 'Communications' },
            { id: 'attendance', label: 'Attendance', category: 'HR' },
            { id: 'procurement', label: 'Procurement', category: 'Operations' },
            { id: 'channel-manager', label: 'Channel Manager', category: 'Distribution' },
        ];
    },

    getAvailableRoles() {
        return [
            { id: 'Owner', label: 'Hotel Owner' },
            { id: 'General Manager', label: 'General Manager' },
            { id: 'Front Desk Manager', label: 'Front Desk Manager' },
            { id: 'Receptionist', label: 'Receptionist' },
            { id: 'Housekeeper', label: 'Housekeeper' },
            { id: 'Housekeeping Supervisor', label: 'Housekeeping Supervisor' },
            { id: 'Waiter', label: 'Waiter' },
            { id: 'Chef', label: 'Chef' },
            { id: 'F&B Manager', label: 'F&B Manager' },
            { id: 'Accountant', label: 'Accountant' },
            { id: 'Revenue Manager', label: 'Revenue Manager' },
            { id: 'Maintenance', label: 'Maintenance Staff' },
            { id: 'Night Auditor', label: 'Night Auditor' },
            { id: 'Concierge', label: 'Concierge' },
        ];
    }
};
