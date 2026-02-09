import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { SaasSettingsService } from './saas-settings.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

export const saasSettingsController = new Elysia({ prefix: '/saas' })
    .use(authMiddleware)

    .get('/features', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const features = await SaasSettingsService.getTenantFeatures(user.hotelId);
        return createResponse(features, 'Tenant features fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        detail: { summary: 'Get tenant feature toggles', tags: ['SaaS'] }
    })

    .patch('/features', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updated = await SaasSettingsService.updateTenantFeatures(user.hotelId, body);
        return createResponse(updated, 'Tenant features updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        body: t.Partial(t.Object({
            enableMultiCurrency: t.Boolean(),
            enableChannelManager: t.Boolean(),
            enableAdvancedRevenue: t.Boolean(),
            enableSmsNotifications: t.Boolean(),
            enableWhatsappNotifications: t.Boolean(),
            enableEmailNotifications: t.Boolean(),
            enableBanquets: t.Boolean(),
            enablePosIntegration: t.Boolean(),
            enableInventory: t.Boolean(),
            enableHousekeeping: t.Boolean()
        })),
        detail: { summary: 'Update tenant feature toggles', tags: ['SaaS'] }
    })

    .get('/notifications', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const settings = await SaasSettingsService.getNotificationSettings(user.hotelId);
        return createResponse(settings, 'Notification settings fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        detail: { summary: 'Get notification settings', tags: ['SaaS'] }
    })

    .patch('/notifications', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updated = await SaasSettingsService.updateNotificationSettings(user.hotelId, body);
        return createResponse(updated, 'Notification settings updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        body: t.Partial(t.Object({
            smtpHost: t.String(),
            smtpPort: t.Number(),
            smtpUser: t.String(),
            smtpPassword: t.String(),
            smtpFromEmail: t.String(),
            smtpFromName: t.String(),

            smsProvider: t.Union([t.Literal('SPARROW'), t.Literal('AAKASH'), t.Literal('TWILIO')]),
            smsApiKey: t.String(),
            smsApiSecret: t.String(),
            smsSenderId: t.String(),

            whatsappProvider: t.Union([t.Literal('META'), t.Literal('TWILIO'), t.Literal('WATI')]),
            whatsappApiKey: t.String(),
            whatsappPhoneNumberId: t.String(),
            whatsappBusinessId: t.String(),

            bookingConfirmationTemplate: t.String(),
            checkInReminderTemplate: t.String(),
            paymentReceiptTemplate: t.String()
        })),
        detail: { summary: 'Update notification settings', tags: ['SaaS'] }
    })
    .post('/notifications/test', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const result = await SaasSettingsService.testNotificationChannel(user.hotelId, body.channel, body.testRecipient);
        return createResponse(result, result.message);
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        body: t.Object({
            channel: t.Union([t.Literal('SMS'), t.Literal('EMAIL'), t.Literal('WHATSAPP')]),
            testRecipient: t.String()
        }),
        detail: { summary: 'Test notification channel', tags: ['SaaS'] }
    })
    .get('/exchange-rates', async () => {
        const rates = await SaasSettingsService.getExchangeRates();
        return createResponse(rates, 'Exchange rates fetched successfully');
    }, {
        isSignedIn: true,
        detail: { summary: 'Get exchange rates', tags: ['SaaS'] }
    })
    .post('/exchange-rates', async ({ body }) => {
        const rate = await SaasSettingsService.createExchangeRate(body);
        return createResponse(rate, 'Exchange rate created successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        body: t.Object({
            baseCurrency: t.String(),
            targetCurrency: t.String(),
            rate: t.Number(),
            effectiveFrom: t.String(),
            effectiveTo: t.Optional(t.String()),
            source: t.Optional(t.Union([t.Literal('MANUAL'), t.Literal('NRB'), t.Literal('API')]))
        }),
        detail: { summary: 'Add exchange rate', tags: ['SaaS'] }
    })
    .get('/convert', async ({ query }) => {
        const result = await SaasSettingsService.convertCurrency(query.from, query.to, query.amount);
        return createResponse(result, 'Currency converted successfully');
    }, {
        isSignedIn: true,
        query: t.Object({
            from: t.String(),
            to: t.String(),
            amount: t.String()
        }),
        detail: { summary: 'Convert currency amount', tags: ['SaaS'] }
    })
    .patch('/hotel-currency', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updated = await SaasSettingsService.updateHotelCurrency(user.hotelId, body.currency);
        return createResponse({ currency: updated.currency }, 'Hotel currency updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        body: t.Object({
            currency: t.Union([t.Literal('NPR'), t.Literal('INR')])
        }),
        detail: { summary: 'Set hotel primary currency', tags: ['SaaS'] }
    });
