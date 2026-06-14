import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { SettingsService } from './settings.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

export const settingsController = new Elysia({ prefix: '/settings' })
    .use(authMiddleware)
    .get('/', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const settings = await SettingsService.getSettings(user.hotelId);
        const payload = SettingsService.canViewFullSettings(user.permissions, user.type)
            ? settings
            : SettingsService.toStaffSettings(settings);
        return createResponse(payload, 'Hotel settings fetched successfully');
    }, {
        isSignedIn: true,
        detail: { summary: 'Get hotel settings', tags: ['Settings'] }
    })
    .patch('/branding', async ({ body, user, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const ip = request.headers.get('x-forwarded-for') || undefined;
        await SettingsService.updateBranding(user.hotelId, user.id, body, ip);
        return createResponse(null, 'Branding updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_TENANTS,
        body: t.Object({
            name: t.Optional(t.String()),
            logoUrl: t.Optional(t.String()),
            primaryColor: t.Optional(t.String()),
            secondaryColor: t.Optional(t.String())
        }),
        detail: { summary: 'Update branding', tags: ['Settings'] }
    })
    .patch('/contact', async ({ body, user, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const ip = request.headers.get('x-forwarded-for') || undefined;
        await SettingsService.updateContact(user.hotelId, user.id, body, ip);
        return createResponse(null, 'Contact information updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_TENANTS,
        body: t.Object({
            address: t.Optional(t.String()),
            phone: t.Optional(t.String()),
            email: t.Optional(t.String()),
            website: t.Optional(t.String()),
            latitude: t.Optional(t.String()),
            longitude: t.Optional(t.String())
        }),
        detail: { summary: 'Update contact info', tags: ['Settings'] }
    })
    .patch('/tax', async ({ body, user, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const ip = request.headers.get('x-forwarded-for') || undefined;
        const userRole = user!.role?.name ?? '';
        await SettingsService.updateTax(user.hotelId, user.id, userRole, user.type ?? '', body, ip, user.permissions);
        return createResponse(null, 'Tax settings updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_TENANTS,
        body: t.Object({
            panNumber: t.Optional(t.String()),
            vatNumber: t.Optional(t.String()),
            serviceChargeRate: t.Optional(t.Number({ minimum: 0, maximum: 100 })),
            taxRate: t.Optional(t.Number({ minimum: 0, maximum: 100 }))
        }),
        detail: { summary: 'Update tax settings', tags: ['Settings'] }
    })
    .patch('/invoice', async ({ body, user, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const ip = request.headers.get('x-forwarded-for') || undefined;
        await SettingsService.updateInvoice(user.hotelId, user.id, body, ip);
        return createResponse(null, 'Invoice settings updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_TENANTS,
        body: t.Object({
            prefix: t.Optional(t.String()),
            footerText: t.Optional(t.String()),
            terms: t.Optional(t.String()),
            config: t.Optional(t.Object({
                headerNote: t.Optional(t.String()),
                receiptFooter: t.Optional(t.String()),
                showLogo: t.Optional(t.Boolean()),
                showTaxBreakdown: t.Optional(t.Boolean()),
                showQr: t.Optional(t.Boolean()),
                paperWidth: t.Optional(t.String()),
                digitalMenu: t.Optional(t.Record(t.String(), t.Unknown())),
            })),
        }),
        detail: { summary: 'Update invoice settings', tags: ['Settings'] }
    })
    .patch('/features', async ({ body, user, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const ip = request.headers.get('x-forwarded-for') || undefined;
        await SettingsService.updateFeatures(user.hotelId, user.id, body, ip);
        return createResponse(null, 'Feature settings updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_TENANTS,
        body: t.Object({
            enableGuestPortal: t.Optional(t.Boolean()),
            enableFoodOrdering: t.Optional(t.Boolean()),
            enableHousekeeping: t.Optional(t.Boolean()),
            enableInventory: t.Optional(t.Boolean()),
            emailNotifications: t.Optional(t.Boolean()),
            smsNotifications: t.Optional(t.Boolean()),
            enableHotel: t.Optional(t.Boolean()),
            enableFoodAndBeverage: t.Optional(t.Boolean()),
            enableFonepay: t.Optional(t.Boolean()),
            enableBanquets: t.Optional(t.Boolean()),
        }),
        detail: { summary: 'Update feature toggles', tags: ['Settings'] }
    })
    .patch('/regional', async ({ body, user, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const ip = request.headers.get('x-forwarded-for') || undefined;
        await SettingsService.updateRegional(user.hotelId, user.id, body, ip);
        return createResponse(null, 'Regional settings updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_TENANTS,
        body: t.Object({
            currency: t.Optional(t.String()),
            timezone: t.Optional(t.String()),
            dateFormat: t.Optional(t.String()),
            fiscalYearStart: t.Optional(t.String()),
            checkInTime: t.Optional(t.String()),
            checkOutTime: t.Optional(t.String()),
        }),
        detail: { summary: 'Update regional settings', tags: ['Settings'] }
    })
    .get('/guest-portal', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const config = await SettingsService.getGuestPortalConfig(user.hotelId);
        return createResponse(config, 'Guest portal config fetched');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_TENANTS,
        detail: { summary: 'Get guest portal config', tags: ['Settings'] }
    })
    .patch('/guest-portal', async ({ body, user, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const ip = request.headers.get('x-forwarded-for') || undefined;
        await SettingsService.updateGuestPortalConfig(user.hotelId, user.id, body, ip);
        return createResponse(null, 'Guest portal config updated');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_TENANTS,
        body: t.Object({
            welcomeMessage: t.Optional(t.String()),
            wifiNetworks: t.Optional(t.Array(t.Object({ floor: t.String(), ssid: t.String(), password: t.String() }))),
            contactNumbers: t.Optional(t.Record(t.String(), t.String())),
            socialLinks: t.Optional(t.Record(t.String(), t.String())),
            customSections: t.Optional(t.Array(t.Object({ title: t.String(), content: t.String() }))),
            showBillBreakdown: t.Optional(t.Boolean()),
            showOrderProgress: t.Optional(t.Boolean()),
        }),
        detail: { summary: 'Update guest portal config', tags: ['Settings'] }
    })
    // Payment gateway / enabled methods. Readable by POS (ORDERS.CREATE) so the
    // till can render only the methods the hotel accepts.
    .get('/payment', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const config = await SettingsService.getPaymentConfig(user.hotelId);
        return createResponse(config, 'Payment config fetched');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ORDERS.CREATE,
        detail: { summary: 'Get payment config', tags: ['Settings'] }
    })
    .patch('/payment', async ({ body, user, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const ip = request.headers.get('x-forwarded-for') || undefined;
        await SettingsService.updatePaymentConfig(user.hotelId, user.id, body, ip);
        return createResponse(null, 'Payment config updated');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_TENANTS,
        body: t.Object({
            enabledMethods: t.Optional(t.Array(t.String())),
            fonepay: t.Optional(t.Object({
                merchantCode: t.Optional(t.String()),
                secretKey: t.Optional(t.String()),
                qrString: t.Optional(t.String()),
            })),
            paymentQr: t.Optional(t.Object({
                imageUrl: t.Optional(t.String()),
                label: t.Optional(t.String()),
            })),
            // Per-method QRs keyed by payment method (FONEPAY/ESEWA/KHALTI/...).
            paymentQrs: t.Optional(t.Record(t.String(), t.Object({
                imageUrl: t.Optional(t.String()),
                label: t.Optional(t.String()),
            }))),
            cancellation: t.Optional(t.Object({
                enabled: t.Optional(t.Boolean()),
                type: t.Optional(t.String()),
                value: t.Optional(t.Number()),
            })),
        }),
        detail: { summary: 'Update payment config', tags: ['Settings'] }
    })
    .get('/messaging', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        return createResponse(await SettingsService.getMessagingProviders(user.hotelId), 'Messaging providers');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        detail: { summary: 'Get SMS/Email provider config', tags: ['Settings'] }
    })
    .patch('/messaging', async ({ body, user, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const ip = request.headers.get('x-forwarded-for') || undefined;
        return createResponse(await SettingsService.updateMessagingProviders(user.hotelId, user.id, body, ip), 'Messaging providers updated');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        body: t.Object({
            sms: t.Optional(t.Object({
                provider: t.Optional(t.String()),
                senderId: t.Optional(t.String()),
                apiKey: t.Optional(t.String()),
                apiSecret: t.Optional(t.String()),
            })),
            email: t.Optional(t.Object({
                smtpHost: t.Optional(t.String()),
                smtpPort: t.Optional(t.Number()),
                smtpUser: t.Optional(t.String()),
                smtpFromEmail: t.Optional(t.String()),
                smtpFromName: t.Optional(t.String()),
                smtpPassword: t.Optional(t.String()),
            })),
            whatsapp: t.Optional(t.Object({
                provider: t.Optional(t.String()),
                phoneNumberId: t.Optional(t.String()),
                businessId: t.Optional(t.String()),
                apiKey: t.Optional(t.String()),
            })),
        }),
        detail: { summary: 'Update SMS/Email/WhatsApp provider config', tags: ['Settings'] }
    })
    .get('/notifications', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        return createResponse(await SettingsService.getNotificationConfig(user.hotelId), 'Notification config fetched');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_TENANTS,
        detail: { summary: 'Get notification config', tags: ['Settings'] }
    })
    .patch('/notifications', async ({ body, user, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const ip = request.headers.get('x-forwarded-for') || undefined;
        await SettingsService.updateNotificationConfig(user.hotelId, user.id, body, ip);
        return createResponse(null, 'Notification config updated');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_TENANTS,
        body: t.Object({
            events: t.Optional(t.Object({
                newBooking: t.Optional(t.Boolean()),
                checkout: t.Optional(t.Boolean()),
                newOrder: t.Optional(t.Boolean()),
                lowStock: t.Optional(t.Boolean()),
                housekeeping: t.Optional(t.Boolean()),
            })),
            messageChannels: t.Optional(t.Record(t.String(), t.Object({
                sms: t.Optional(t.Boolean()),
                email: t.Optional(t.Boolean()),
                whatsapp: t.Optional(t.Boolean()),
            }))),
            emailTemplates: t.Optional(t.Record(t.String(), t.String())),
        }),
        detail: { summary: 'Update notification config', tags: ['Settings'] }
    });
