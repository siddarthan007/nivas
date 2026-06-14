import { Elysia, t } from 'elysia';
import { s } from '../../lib/schema';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { SaasAdminService } from './saas-admin.service';
import { PlatformSettingsService } from './platform-settings.service';
import { BackupService } from '../system/backup.service';
import { HotelStorageService } from '../analytics/hotel-storage.service';
import { createResponse } from '../../utils/response.helper';
import { LicenseNotificationService } from '../notifications/license-notification.service';
import { requirePassword } from '../../utils/password.guard';

export const saasAdminController = new Elysia({ prefix: '/saas-admin' })
    .use(authMiddleware)

    // Platform-wide SMS / Email gateway (shared by all tenants)
    .get('/platform-messaging', async () => {
        return createResponse(await PlatformSettingsService.get(), 'Platform messaging config');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.MANAGE_LICENSES,
        detail: { summary: 'Get platform SMS/Email gateway', tags: ['SaaS'] }
    })
    .patch('/platform-messaging', async ({ body }) => {
        return createResponse(await PlatformSettingsService.update(body), 'Platform messaging updated');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.MANAGE_LICENSES,
        body: t.Object({
            sms: t.Optional(t.Object({ provider: t.Optional(t.String()), senderId: t.Optional(t.String()), apiKey: t.Optional(t.String()), apiSecret: t.Optional(t.String()) })),
            email: t.Optional(t.Object({ smtpHost: t.Optional(t.String()), smtpPort: t.Optional(t.Number()), smtpUser: t.Optional(t.String()), smtpFromEmail: t.Optional(t.String()), smtpFromName: t.Optional(t.String()), smtpPassword: t.Optional(t.String()) })),
        }),
        detail: { summary: 'Update platform SMS/Email gateway', tags: ['SaaS'] }
    })

    // List all tenants with subscription status
    .get('/tenants', async () => {
        const data = await SaasAdminService.getAllTenants();
        return createResponse(data, 'Tenants fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.MANAGE_LICENSES,
        detail: { summary: 'List all tenants', tags: ['SaaS'] }
    })

    // Onboard new tenant
    .post('/tenants', async ({ body, user }) => {
        const result = await SaasAdminService.onboardTenant(body, user!.id);
        return createResponse(result, 'Tenant onboarded successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.MANAGE_LICENSES,
        body: t.Object({
            hotelName: t.String(),
            slug: t.String(),
            hotelEmail: t.Optional(t.String()),
            hotelPhone: t.Optional(t.String()),
            planTier: t.Optional(t.String()),
            adminName: t.String(),
            adminEmail: t.String(),
            adminPhone: t.String(),
            adminPassword: s.string({ minLength: 6 })
        }),
        detail: { summary: 'Onboard new tenant hotel', tags: ['SaaS'] }
    })

    // Record SaaS payment
    .post('/tenants/:hotelId/payments', async ({ params, body, user }) => {
        const payment = await SaasAdminService.recordSaaSPayment(parseInt(params.hotelId), body, user!.id);
        return createResponse(payment, 'SaaS payment recorded successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.MANAGE_SUBSCRIPTIONS,
        params: t.Object({ hotelId: t.String() }),
        body: t.Object({
            amount: t.String(),
            paymentMethod: t.Optional(t.String()),
            reference: t.Optional(t.String()),
            notes: t.Optional(t.String())
        }),
        detail: { summary: 'Record manual offline payment for SaaS', tags: ['SaaS'] }
    })

    // List available features
    .get('/features', () => {
        return createResponse(SaasAdminService.getAvailableFeatures(), 'Features fetched successfully');
    }, {
        detail: { summary: 'List available SaaS features', tags: ['SaaS'] }
    })

    // Support contacts shown to all hotels (configured here).
    .get('/support', async () => {
        return createResponse(await SaasAdminService.getSupportConfig(), 'Support config');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.MANAGE_LICENSES,
        detail: { summary: 'Get support contacts', tags: ['SaaS'] }
    })
    .patch('/support', async ({ body }) => {
        return createResponse(await SaasAdminService.setSupportConfig(body), 'Support contacts updated');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.MANAGE_LICENSES,
        body: t.Object({ email: t.Optional(t.String()), phone: t.Optional(t.String()), whatsapp: t.Optional(t.String()), hours: t.Optional(t.String()) }),
        detail: { summary: 'Update support contacts', tags: ['SaaS'] }
    })

    // Billing contacts shown on SaaS invoices (configured here).
    .get('/billing', async () => {
        return createResponse(await PlatformSettingsService.getBillingConfig(), 'Billing config');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.MANAGE_LICENSES,
        detail: { summary: 'Get billing contacts', tags: ['SaaS'] }
    })
    .patch('/billing', async ({ body }) => {
        return createResponse(await PlatformSettingsService.updateBillingConfig(body), 'Billing contacts updated');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.MANAGE_LICENSES,
        body: t.Object({ name: t.Optional(t.String()), email: t.Optional(t.String()), phone: t.Optional(t.String()), pan: t.Optional(t.String()), vat: t.Optional(t.String()), address: t.Optional(t.String()) }),
        detail: { summary: 'Update billing contacts', tags: ['SaaS'] }
    })

    // Database storage report (biggest tables)
    .get('/database-stats', async () => {
        return createResponse(await SaasAdminService.getDatabaseStats(), 'Database stats');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.MANAGE_LICENSES,
        detail: { summary: 'Database storage usage by table', tags: ['SaaS'] }
    })

    // --- Database backups ---
    .get('/backups', async () => {
        return createResponse({ settings: await BackupService.getSettings(), backups: await BackupService.list() }, 'Backups');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.MANAGE_LICENSES,
        detail: { summary: 'List DB backups + schedule', tags: ['SaaS'] }
    })
    .post('/backups', async () => {
        return createResponse(await BackupService.create(), 'Backup created');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.MANAGE_LICENSES,
        detail: { summary: 'Create a DB backup now', tags: ['SaaS'] }
    })
    .patch('/backups/settings', async ({ body }) => {
        return createResponse(await BackupService.setSettings(body), 'Backup schedule updated');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.MANAGE_LICENSES,
        body: t.Object({ autoEnabled: t.Optional(t.Boolean()), frequency: t.Optional(t.Union([t.Literal('DAILY'), t.Literal('WEEKLY')])) }),
        detail: { summary: 'Update automatic backup schedule', tags: ['SaaS'] }
    })
    .delete('/backups/:filename', async ({ params }) => {
        const result = await BackupService.deleteBackup(params.filename);
        return createResponse(result, 'Backup deleted');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.MANAGE_LICENSES,
        params: t.Object({ filename: t.String() }),
        detail: { summary: 'Delete a backup file', tags: ['SaaS'] }
    })
    .get('/backups/:filename/url', async ({ params }) => {
        const result = await BackupService.refreshDownloadUrl(params.filename);
        return createResponse(result, 'Download URL refreshed');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.MANAGE_LICENSES,
        params: t.Object({ filename: t.String() }),
        detail: { summary: 'Refresh presigned download URL', tags: ['SaaS'] }
    })

    // List available modules
    .get('/modules', () => {
        return createResponse(SaasAdminService.getAvailableModules(), 'Modules fetched successfully');
    }, {
        detail: { summary: 'List available SaaS modules', tags: ['SaaS'] }
    })

    // List available roles
    .get('/available-roles', () => {
        return createResponse(SaasAdminService.getAvailableRoles(), 'Roles fetched successfully');
    }, {
        detail: { summary: 'List available plan roles', tags: ['SaaS'] }
    })

    // List all packages (Admin View)
    .get('/packages', async () => {
        const packages = await SaasAdminService.getCreatePackages(true);
        return createResponse(packages, 'Packages fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.MANAGE_PACKAGES,
        detail: { summary: 'List all subscription packages', tags: ['SaaS'] }
    })

    // Create a new package (Super Admin)
    .post('/packages', async ({ body }) => {
        const created = await SaasAdminService.createPackage(body);
        return createResponse(created, `Package "${created.name}" created`);
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.MANAGE_PACKAGES,
        body: t.Object({
            name: t.String(),
            code: t.String(),
            description: t.Optional(t.String()),
            monthlyPrice: t.Number(),
            annualPrice: t.Optional(t.Number()),
            maxRooms: t.Optional(t.Number()),
            maxUsers: t.Optional(t.Number()),
            features: t.Optional(t.Array(t.String())),
            modules: t.Optional(t.Array(t.String())),
            allowedRoles: t.Optional(t.Array(t.String())),
            trialDays: t.Optional(t.Number())
        }),
        detail: { summary: 'Create subscription package', tags: ['SaaS'] }
    })

    // Update a package
    .patch('/packages/:id', async ({ params, body }) => {
        const updated = await SaasAdminService.updatePackage(parseInt(params.id), body);
        return createResponse(updated, `Package "${updated.name}" updated`);
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.MANAGE_PACKAGES,
        params: t.Object({ id: t.String() }),
        body: t.Object({
            name: t.Optional(t.String()),
            description: t.Optional(t.String()),
            monthlyPrice: t.Optional(t.Number()),
            annualPrice: t.Optional(t.Number()),
            maxRooms: t.Optional(t.Number()),
            maxUsers: t.Optional(t.Number()),
            features: t.Optional(t.Array(t.String())),
            modules: t.Optional(t.Array(t.String())),
            allowedRoles: t.Optional(t.Array(t.String())),
            trialDays: t.Optional(t.Number()),
            isActive: t.Optional(t.Boolean())
        }),
        detail: { summary: 'Update subscription package', tags: ['SaaS'] }
    })

    // Get tenant details with subscription info
    .get('/tenants/:hotelId', async ({ params }) => {
        const data = await SaasAdminService.getTenantDetails(parseInt(params.hotelId));
        return createResponse(data, 'Tenant details fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.MANAGE_LICENSES,
        params: t.Object({ hotelId: t.String() }),
        detail: { summary: 'Get tenant details', tags: ['SaaS'] }
    })

    // Per-tenant usage (DB record counts + bucket storage) — SaaS-admin analytics.
    .get('/tenants/:hotelId/usage', async ({ params }) => {
        return createResponse(await HotelStorageService.getUsage(parseInt(params.hotelId)), 'Tenant usage');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.MANAGE_LICENSES,
        params: t.Object({ hotelId: t.String() }),
        detail: { summary: 'Per-tenant storage + record usage', tags: ['SaaS'] }
    })

    // Update tenant details
    .patch('/tenants/:hotelId', async ({ params, body }) => {
        const updatedHotel = await SaasAdminService.updateTenantDetails(parseInt(params.hotelId), body);
        return createResponse(updatedHotel, 'Hotel details updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.MANAGE_SUBSCRIPTIONS,
        params: t.Object({ hotelId: t.String() }),
        body: t.Object({
            name: t.Optional(t.String()),
            address: t.Optional(t.String()),
            phone: t.Optional(t.String()),
            email: t.Optional(t.String()),
            website: t.Optional(t.String()),
            logoUrl: t.Optional(t.String()),
            primaryColor: t.Optional(t.String()),
            secondaryColor: t.Optional(t.String()),
            panNumber: t.Optional(t.String()),
            vatNumber: t.Optional(t.String()),
            serviceChargeRate: t.Optional(t.String()), // Decimal as string
            taxRate: t.Optional(t.String()),
            maxRooms: t.Optional(t.Number()),
            maxUsers: t.Optional(t.Number()),
            planTier: t.Optional(t.String())
        }),
        detail: { summary: 'Update tenant details', tags: ['SaaS'] }
    })

    // Pause a tenant's license
    .post('/tenants/:hotelId/pause', async ({ params, body, user, request }) => {
        const ip = request.headers.get('x-forwarded-for') || undefined;
        const hotel = await SaasAdminService.pauseLicense(parseInt(params.hotelId), user!.id, body.reason, ip);
        return createResponse({ licenseStatus: 'PAUSED' }, `License for "${hotel?.name ?? 'Hotel'}" has been paused`);
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.MANAGE_LICENSES,
        params: t.Object({ hotelId: t.String() }),
        body: t.Object({ reason: t.Optional(t.String()) }),
        detail: { summary: 'Pause tenant license', tags: ['SaaS'] }
    })

    // Resume a paused license
    .post('/tenants/:hotelId/resume', async ({ params, body, user, request }) => {
        const ip = request.headers.get('x-forwarded-for') || undefined;
        const hotel = await SaasAdminService.resumeLicense(parseInt(params.hotelId), user!.id, body.reason, ip);
        return createResponse({ licenseStatus: 'ACTIVE' }, `License for "${hotel?.name ?? 'Hotel'}" has been resumed`);
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.MANAGE_LICENSES,
        params: t.Object({ hotelId: t.String() }),
        body: t.Object({ reason: t.Optional(t.String()) }),
        detail: { summary: 'Resume paused license', tags: ['SaaS'] }
    })

    // Revoke a tenant's license
    .post('/tenants/:hotelId/revoke', async ({ params, body, user, request }) => {
        // Step-up: even a super-admin must re-enter their password to revoke a tenant.
        await requirePassword(user!.id, body.confirmPassword);
        const ip = request.headers.get('x-forwarded-for') || undefined;
        const hotel = await SaasAdminService.revokeLicense(parseInt(params.hotelId), user!.id, body.reason, ip);
        return createResponse({ licenseStatus: 'REVOKED' }, `License for "${hotel?.name ?? 'Hotel'}" has been revoked`);
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.MANAGE_LICENSES,
        params: t.Object({ hotelId: t.String() }),
        body: t.Object({ reason: t.String(), confirmPassword: t.String() }),
        detail: { summary: 'Revoke tenant license', tags: ['SaaS'] }
    })

    // Grant trial access
    .post('/tenants/:hotelId/grant-trial', async ({ params, body, user, request }) => {
        const ip = request.headers.get('x-forwarded-for') || undefined;
        const { trialEndsAt } = await SaasAdminService.grantTrial(
            parseInt(params.hotelId), user!.id, body.days, body.packageId, ip
        );
        return createResponse({ licenseStatus: 'TRIAL', trialEndsAt }, `Trial access granted for ${body.days ?? 14} days`);
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.MANAGE_LICENSES,
        params: t.Object({ hotelId: t.String() }),
        body: t.Object({
            days: t.Optional(t.Number({ minimum: 1, maximum: 365 })),
            packageId: t.Optional(t.Number())
        }),
        detail: { summary: 'Grant trial access to tenant', tags: ['SaaS'] }
    })

    // Activate license after payment
    .post('/tenants/:hotelId/activate', async ({ params, body, user, request }) => {
        const ip = request.headers.get('x-forwarded-for') || undefined;
        const { expiresAt } = await SaasAdminService.activateLicense(
            parseInt(params.hotelId), user!.id, body.billingCycle ?? 'MONTHLY', ip
        );
        return createResponse({ licenseStatus: 'ACTIVE', expiresAt }, `License activated until ${expiresAt.toISOString().split('T')[0]}`);
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.MANAGE_LICENSES,
        params: t.Object({ hotelId: t.String() }),
        body: t.Object({
            billingCycle: t.Optional(t.Union([t.Literal('MONTHLY'), t.Literal('ANNUAL')]))
        }),
        detail: { summary: 'Activate tenant license', tags: ['SaaS'] }
    })

    // Extend license
    .post('/tenants/:hotelId/extend', async ({ params, body, user, request }) => {
        try {
            const ip = request.headers.get('x-forwarded-for') || undefined;
            const { newExpiry } = await SaasAdminService.extendLicense(parseInt(params.hotelId), user!.id, body.days, ip);
            return createResponse({ licenseExpiresAt: newExpiry }, `License extended by ${body.days} days`);
        } catch (err: any) {
            console.error('[SaasAdmin] Extend License Error:', err);
            throw err;
        }
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.MANAGE_LICENSES,
        params: t.Object({ hotelId: t.String() }),
        body: t.Object({ days: t.Number({ minimum: 1, maximum: 1825 }) }), // Increased to 5 years
        detail: { summary: 'Extend tenant license', tags: ['SaaS'] }
    })

    // List users for a tenant
    .get('/tenants/:hotelId/users', async ({ params }) => {
        const data = await SaasAdminService.getTenantUsers(parseInt(params.hotelId));
        return createResponse(data, 'Tenant users fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.MANAGE_SUBSCRIPTIONS, // Using broad permission
        params: t.Object({ hotelId: t.String() }),
        detail: { summary: 'List tenant users', tags: ['SaaS'] }
    })

    // Reset tenant user password (Support)
    .patch('/tenants/:hotelId/users/:userId/password', async ({ params, body }) => {
        const updatedUser = await SaasAdminService.resetTenantUserPassword(parseInt(params.hotelId), params.userId, body.password);
        return createResponse(null, `Password reset for user ${updatedUser.email}`);
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.MANAGE_SUBSCRIPTIONS,
        params: t.Object({
            hotelId: t.String(),
            userId: t.String()
        }),
        body: t.Object({ password: s.string({ minLength: 6 }) }),
        detail: { summary: 'Reset tenant user password', tags: ['SaaS'] }
    })

    // Trigger license expiry check (sends notifications to all near-expiry hotels)
    .post('/check-expiring-licenses', async () => {
        await LicenseNotificationService.checkExpiringLicenses();
        await LicenseNotificationService.checkGracePeriodLicenses();
        return createResponse(null, 'License expiry check completed and notifications sent');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.MANAGE_LICENSES,
        detail: { summary: 'Check and notify expiring licenses', tags: ['SaaS'] }
    })

    // Send manual notification to a specific tenant about license
    .post('/tenants/:hotelId/notify-expiry', async ({ params }) => {
        const hotelId = parseInt(params.hotelId);
        const hotel = await SaasAdminService.getTenantDetails(hotelId);
        const hotelData = hotel.hotel;

        if (hotelData.licenseExpiresAt) {
            const daysLeft = Math.ceil((new Date(hotelData.licenseExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            await LicenseNotificationService.sendExpiryWarning(
                hotelId,
                hotelData.name,
                new Date(hotelData.licenseExpiresAt),
                Math.max(0, daysLeft)
            );
            return createResponse(null, `Expiry notification sent to ${hotelData.name}`);
        }
        return createResponse(null, 'No expiry date set for this hotel');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SAAS_ADMIN.MANAGE_LICENSES,
        params: t.Object({ hotelId: t.String() }),
        detail: { summary: 'Send manual expiry notification', tags: ['SaaS'] }
    });
