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
        return createResponse(settings, 'Hotel settings fetched successfully');
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
            website: t.Optional(t.String())
        }),
        detail: { summary: 'Update contact info', tags: ['Settings'] }
    })
    .patch('/tax', async ({ body, user, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const ip = request.headers.get('x-forwarded-for') || undefined;
        const userRole = user!.role?.name ?? '';
        await SettingsService.updateTax(user.hotelId, user.id, userRole, user.type ?? '', body, ip);
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
            terms: t.Optional(t.String())
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
    });
