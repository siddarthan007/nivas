import { db } from '../../db';
import { hotels, users, roles, bookings, tenantFeatures, subscriptions, subscriptionPackages, subscriptionPayments } from '../../db/schema';
import { eq, and, gte, sum, count, desc } from 'drizzle-orm';
import { BusinessLogicError, ForbiddenError, UnauthorizedError } from '../../utils/errors';
import { logAction } from '../system/audit.service';
import { NightAuditService } from '../scheduler/night-audit.service';
import { PERMISSIONS } from '../../config/permissions';

const DEFAULT_ROLES = [
    {
        name: 'Manager', level: 1, permissions: [
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
        ]
    },
    {
        name: 'Front Desk', level: 2, permissions: [
            ...Object.values(PERMISSIONS.BOOKINGS),
            ...Object.values(PERMISSIONS.GUESTS),
            PERMISSIONS.ROOMS.VIEW_STATUS,
            PERMISSIONS.ROOMS.UPDATE,
            PERMISSIONS.ORDERS.CREATE,
            PERMISSIONS.FINANCE.GENERATE_INVOICE,
            PERMISSIONS.FINANCE.RECORD_PAYMENT,
            PERMISSIONS.COMMUNICATIONS.SEND_MESSAGE,
            PERMISSIONS.COMMUNICATIONS.READ_MESSAGES,
        ]
    },
    {
        name: 'Kitchen Manager', level: 3, permissions: [
            ...Object.values(PERMISSIONS.ORDERS),
            PERMISSIONS.MENU.VIEW,
            PERMISSIONS.MENU.CREATE,
            PERMISSIONS.MENU.UPDATE,
            PERMISSIONS.INVENTORY.READ,
            PERMISSIONS.INVENTORY.REQUEST_STOCK,
            PERMISSIONS.COMMUNICATIONS.SEND_MESSAGE,
            PERMISSIONS.COMMUNICATIONS.READ_MESSAGES,
        ]
    },
    {
        name: 'Housekeeping Supervisor', level: 3, permissions: [
            ...Object.values(PERMISSIONS.HOUSEKEEPING),
            PERMISSIONS.ROOMS.VIEW_STATUS,
            PERMISSIONS.ROOMS.MANAGE_CLEANING,
            PERMISSIONS.INVENTORY.REQUEST_STOCK,
            PERMISSIONS.COMMUNICATIONS.SEND_MESSAGE,
            PERMISSIONS.COMMUNICATIONS.READ_MESSAGES,
        ]
    },
    {
        name: 'Waiter', level: 4, permissions: [
            PERMISSIONS.ORDERS.CREATE,
            PERMISSIONS.ORDERS.READ,
            PERMISSIONS.ORDERS.UPDATE_STATUS,
            PERMISSIONS.MENU.VIEW,
            PERMISSIONS.RESTAURANT.VIEW_TABLES,
            PERMISSIONS.COMMUNICATIONS.SEND_MESSAGE,
            PERMISSIONS.COMMUNICATIONS.READ_MESSAGES,
        ]
    },
    {
        name: 'Accountant', level: 2, permissions: [
            ...Object.values(PERMISSIONS.FINANCE),
            ...Object.values(PERMISSIONS.REPORTS),
            PERMISSIONS.ANALYTICS.VIEW_FINANCIALS,
            PERMISSIONS.INVENTORY.MANAGE_PROCUREMENT,
        ]
    },
    {
        name: 'Receptionist', level: 2, permissions: [
            ...Object.values(PERMISSIONS.BOOKINGS),
            ...Object.values(PERMISSIONS.GUESTS),
            PERMISSIONS.ROOMS.VIEW_STATUS,
            PERMISSIONS.ROOMS.UPDATE,
            PERMISSIONS.FINANCE.GENERATE_INVOICE,
            PERMISSIONS.FINANCE.RECORD_PAYMENT,
            PERMISSIONS.COMMUNICATIONS.SEND_MESSAGE,
            PERMISSIONS.COMMUNICATIONS.READ_MESSAGES,
        ]
    },
    {
        name: 'Housekeeper', level: 4, permissions: [
            PERMISSIONS.HOUSEKEEPING.VIEW_TASKS,
            PERMISSIONS.HOUSEKEEPING.UPDATE_STATUS,
            PERMISSIONS.ROOMS.VIEW_STATUS,
            PERMISSIONS.COMMUNICATIONS.SEND_MESSAGE,
            PERMISSIONS.COMMUNICATIONS.READ_MESSAGES,
        ]
    },
];

export const SuperAdminService = {
    async onboardHotel(data: {
        name: string;
        slug: string;
        logoUrl?: string;
        website?: string;
        address: string;
        phone?: string;
        panNumber?: string;
        vatNumber?: string;
        serviceChargeRate?: number | string;
        taxRate?: number | string;
        ownerName: string;
        ownerEmail: string;
        ownerPhone: string;
        ownerPassword: string;
        packageId?: number;
        billingCycle?: 'MONTHLY' | 'ANNUAL' | '2_YEAR' | '3_YEAR';
        trialDays?: number;
        maxRooms?: number;
        maxUsers?: number;
    }) {
        // Check if slug already exists
        const existingSlug = await db.query.hotels.findFirst({
            where: (hotels, { eq }) => eq(hotels.slug, data.slug)
        });
        if (existingSlug) {
            throw new BusinessLogicError(`Hotel with slug "${data.slug}" already exists`);
        }

        // Check if owner email already exists
        const existingEmail = await db.query.users.findFirst({
            where: (users, { eq }) => eq(users.email, data.ownerEmail)
        });
        if (existingEmail) {
            throw new BusinessLogicError(`User with email "${data.ownerEmail}" already exists`);
        }

        // Check if owner phone already exists
        if (data.ownerPhone) {
            const existingPhone = await db.query.users.findFirst({
                where: (users, { eq }) => eq(users.phone, data.ownerPhone)
            });
            if (existingPhone) {
                throw new BusinessLogicError(`User with phone "${data.ownerPhone}" already exists`);
            }
        }

        const result = await db.transaction(async (tx) => {
            const [newHotel] = await tx.insert(hotels).values({
                name: data.name,
                slug: data.slug,
                logoUrl: data.logoUrl,
                website: data.website,
                address: data.address,
                phone: data.phone,
                panNumber: data.panNumber,
                vatNumber: data.vatNumber,
                licenseKey: crypto.randomUUID(),
                isActive: true,
                serviceChargeRate: (typeof data.serviceChargeRate === 'string' && data.serviceChargeRate !== '' ? parseFloat(data.serviceChargeRate) / 100 : (data.serviceChargeRate ?? 0.10)).toString(),
                taxRate: (typeof data.taxRate === 'string' && data.taxRate !== '' ? parseFloat(data.taxRate) / 100 : (data.taxRate ?? 0.13)).toString(),
                email: data.ownerEmail,
                maxRooms: data.maxRooms ?? 50,
                maxUsers: data.maxUsers ?? 10
            }).returning();

            if (!newHotel) {
                throw new BusinessLogicError('Failed to create hotel');
            }

            // Create default roles for the hotel
            await tx.insert(roles).values(
                DEFAULT_ROLES.map(r => ({
                    hotelId: newHotel.id,
                    name: r.name,
                    level: r.level,
                    permissions: r.permissions
                }))
            );

            // Create Owner role with full permissions
            const [ownerRole] = await tx.insert(roles).values({
                hotelId: newHotel.id,
                name: 'Owner',
                level: 0,
                permissions: ['*']
            }).returning();

            if (!ownerRole) {
                throw new BusinessLogicError('Failed to create owner role');
            }

            // Create owner user
            const hashedPassword = await Bun.password.hash(data.ownerPassword);

            const [ownerUser] = await tx.insert(users).values({
                fullName: data.ownerName,
                email: data.ownerEmail,
                phone: data.ownerPhone,
                passwordHash: hashedPassword,
                hotelId: newHotel.id,
                roleId: ownerRole.id,
                userType: 'HOTEL_STAFF'
            }).returning();

            // Create default tenant features
            await tx.insert(tenantFeatures).values({
                hotelId: newHotel.id,
                enableEmailNotifications: true,
                enableInventory: true,
                enableHousekeeping: true,
                enableGuestPortal: true // Default enabled for now, or based on plan later
            });

            // Resolve package: use explicit packageId from request, or find TRIAL, or fallback
            let resolvedPkgId = data.packageId;
            if (!resolvedPkgId) {
                const trialPackage = await tx.query.subscriptionPackages.findFirst({
                    where: (sp, { eq }) => eq(sp.code, 'TRIAL')
                });
                resolvedPkgId = trialPackage?.id;
            }
            if (!resolvedPkgId) {
                const anyPackage = await tx.query.subscriptionPackages.findFirst();
                resolvedPkgId = anyPackage?.id;
            }

            // Load package details
            let resolvedPkgCode = 'STANDARD';
            let isTrial = !data.packageId;
            let pkgDetails: typeof subscriptionPackages.$inferSelect | undefined;
            if (resolvedPkgId) {
                pkgDetails = await tx.query.subscriptionPackages.findFirst({
                    where: (sp, { eq }) => eq(sp.id, resolvedPkgId!)
                });
                if (pkgDetails) {
                    resolvedPkgCode = pkgDetails.code;
                    isTrial = pkgDetails.code === 'TRIAL' || !data.packageId;
                }
            }

            if (!resolvedPkgId) {
                throw new BusinessLogicError('No subscription package available for onboarding');
            }
            const pkgId = resolvedPkgId; // narrowed

            const now = new Date();
            const billingCycle = data.billingCycle || 'MONTHLY';

            if (isTrial) {
                // Trial flow
                const trialDays = data.trialDays || pkgDetails?.trialDays || 14;
                const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

                await tx.update(hotels).set({
                    licenseStatus: 'TRIAL',
                    licenseExpiresAt: trialEndsAt,
                    planTier: resolvedPkgCode,
                }).where(eq(hotels.id, newHotel.id));

                await tx.insert(subscriptions).values({
                    hotelId: newHotel.id,
                    packageId: pkgId,
                    status: 'TRIAL',
                    billingCycle,
                    startDate: now,
                    trialEndsAt,
                });
            } else {
                // Paid plan flow
                const periodEnd = new Date(now);
                if (billingCycle === 'ANNUAL') {
                    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
                } else if (billingCycle === '2_YEAR') {
                    periodEnd.setFullYear(periodEnd.getFullYear() + 2);
                } else if (billingCycle === '3_YEAR') {
                    periodEnd.setFullYear(periodEnd.getFullYear() + 3);
                } else {
                    periodEnd.setMonth(periodEnd.getMonth() + 1);
                }

                const price = billingCycle === 'ANNUAL' || billingCycle === '2_YEAR' || billingCycle === '3_YEAR'
                    ? (pkgDetails?.annualPrice ?? pkgDetails?.monthlyPrice ?? '0')
                    : (pkgDetails?.monthlyPrice ?? '0');

                await tx.update(hotels).set({
                    licenseStatus: 'ACTIVE',
                    licenseExpiresAt: periodEnd,
                    planTier: resolvedPkgCode,
                }).where(eq(hotels.id, newHotel.id));

                const [subscription] = await tx.insert(subscriptions).values({
                    hotelId: newHotel.id,
                    packageId: pkgId,
                    status: 'ACTIVE',
                    billingCycle,
                    startDate: now,
                    currentPeriodStart: now,
                    currentPeriodEnd: periodEnd,
                }).returning();

                // Record payment
                if (subscription) {
                    await tx.insert(subscriptionPayments).values({
                        subscriptionId: subscription.id,
                        hotelId: newHotel.id,
                        amount: price,
                        currency: 'NPR',
                        paymentMethod: 'MANUAL',
                        status: 'COMPLETED',
                        periodStart: now,
                        periodEnd: periodEnd,
                        notes: `Onboard payment — ${billingCycle.toLowerCase()} ${resolvedPkgCode} plan`,
                    });
                }
            }

            return { hotel: newHotel, owner: ownerUser };
        });

        return result;
    },

    async getSalesAnalytics() {
        const end = new Date();
        const start = new Date();
        start.setMonth(start.getMonth() - 5); // Last 6 months
        start.setDate(1);
        start.setHours(0, 0, 0, 0);

        // Fetch subscription payments for SaaS license revenue (NOT hotel booking revenue)
        const saasPayments = await db.query.subscriptionPayments.findMany({
            where: (sp, { gte }) => gte(sp.createdAt, start)
        });

        // Fetch tenants for growth
        const tenantList = await db.query.hotels.findMany({
            where: (h, { gte }) => gte(h.createdAt, start)
        });

        // Active subscriptions count
        const activeSubscriptions = await db.query.subscriptions.findMany({
            where: (s, { eq }) => eq(s.status, 'ACTIVE')
        });

        // Group by Month
        const months: Record<string, { revenue: number, tenants: number }> = {};
        for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
            const monthKey = d.toLocaleString('default', { month: 'short' });
            months[monthKey] = { revenue: 0, tenants: 0 };
        }

        // Sum subscription payment amounts per month
        saasPayments.forEach(p => {
            const date = p.createdAt ? new Date(p.createdAt) : new Date();
            const month = date.toLocaleString('default', { month: 'short' });
            if (months[month]) {
                months[month].revenue += parseFloat(p.amount || '0');
            }
        });

        // New signups per month
        tenantList.forEach(t => {
            const date = t.createdAt ? new Date(t.createdAt) : new Date();
            const month = date.toLocaleString('default', { month: 'short' });
            if (months[month]) {
                months[month].tenants += 1;
            }
        });

        const revenueHistory = Object.keys(months).map(m => ({ month: m, amount: Math.round(months[m]?.revenue || 0) }));
        const tenantGrowth = Object.keys(months).map(m => ({ month: m, count: months[m]?.tenants || 0 }));

        const totalRevenue = saasPayments.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);

        return {
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            paymentsCount: saasPayments.length,
            activeSubscriptions: activeSubscriptions.length,
            avgPaymentValue: saasPayments.length > 0
                ? Math.round((totalRevenue / saasPayments.length) * 100) / 100
                : 0,
            period: '6_months',
            revenueHistory,
            tenantGrowth
        };
    },

    async triggerNightAudit(user: any, hotelIdPayload?: number, ip?: string) {
        let targetHotelId = user.hotelId;

        // If Super Admin, allow specifying hotelId
        if (user.type === 'SUPER_ADMIN') {
            if (hotelIdPayload) {
                targetHotelId = hotelIdPayload;
            } else {
                throw new BusinessLogicError('Hotel ID is required for Super Admin');
            }
        } else {
            // For regular users, enforce their own hotel
            if (!targetHotelId) {
                throw new UnauthorizedError('Unauthorized - Hotel context required');
            }
        }

        const canRunAudit = user.type === 'SUPER_ADMIN'
            || user.permissions?.includes('*')
            || user.permissions?.includes('operations:run_night_audit');

        if (!canRunAudit) {
            throw new ForbiddenError('Missing operations:run_night_audit permission');
        }

        const result = await NightAuditService.runAuditForHotel(targetHotelId!);

        // Audit log the action
        await logAction(
            targetHotelId!,
            user.id,
            'TRIGGER_NIGHT_AUDIT',
            'NIGHT_AUDIT',
            undefined,
            { triggeredBy: user.id, result: result.status },
            ip
        );

        return result;
    },

    async impersonateHotelOwner(currentUser: any, targetHotelId: number, jwt: any, ip?: string) {
        if (!currentUser || currentUser.type !== 'SUPER_ADMIN') {
            throw new ForbiddenError('Only Super Admins can impersonate');
        }

        // Find the owner of the hotel
        const ownerRole = await db.query.roles.findFirst({
            where: (roles, { eq, and }) => and(
                eq(roles.hotelId, targetHotelId),
                eq(roles.name, 'Owner')
            )
        });

        if (!ownerRole) {
            throw new BusinessLogicError('Hotel has no Owner role defined');
        }

        const ownerUser = await db.query.users.findFirst({
            where: (users, { eq, and }) => and(
                eq(users.hotelId, targetHotelId),
                eq(users.roleId, ownerRole.id)
            )
        });

        if (!ownerUser) {
            throw new BusinessLogicError('No owner user found for this hotel');
        }

        // Fetch hotel name for the impersonation response
        const hotel = await db.query.hotels.findFirst({
            where: (hotels, { eq }) => eq(hotels.id, targetHotelId)
        });

        // Generate Token for the Owner
        const impersonationId = crypto.randomUUID();
        const token = await jwt.sign({
            id: ownerUser.id,
            hotelId: ownerUser.hotelId,
            type: 'HOTEL_STAFF',
            permissions: ownerRole.permissions as string[],
            role: ownerRole.name,
            impersonation: true,
            impersonationId,
        });

        // Audit log the impersonation
        await logAction(
            targetHotelId,
            currentUser.id,
            'IMPERSONATE_HOTEL',
            'SECURITY',
            undefined,
            { targetHotel: targetHotelId, targetUser: ownerUser.id },
            ip
        );

        return {
            message: `Impersonating ${ownerUser.fullName} at ${hotel?.name || 'Hotel #' + targetHotelId}`,
            token,
            impersonationId,
            user: {
                id: ownerUser.id,
                fullName: ownerUser.fullName,
                email: ownerUser.email,
                role: 'Owner',
                hotelId: ownerUser.hotelId
            },
            hotelName: hotel?.name || 'Hotel #' + targetHotelId
        };
    }
};
