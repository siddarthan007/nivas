import { db } from '../../db';
import { users, hotels, subscriptionPackages } from '../../db/schema';
import { BusinessLogicError } from '../../utils/errors';
import { eq, and } from 'drizzle-orm';
import { NotFoundError } from '../../utils/errors';
import { LicenseService } from './license.service';

export const SaasAdminService = {
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
                licenseStatus: hotel.licenseStatus ?? 'TRIAL'
            };
        });
    },

    async getTenantDetails(hotelId: number) {
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
    },

    async updateTenantDetails(hotelId: number, data: any) {
        const [updatedHotel] = await db.update(hotels)
            .set({
                ...data,
                updatedAt: new Date()
            })
            .where(eq(hotels.id, hotelId))
            .returning();

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
