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

    // IRD CBMS credentials — only usable when the plan feature enableCbms is on.
    .get('/ai', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const feats = await SaasSettingsService.getTenantFeatures(user.hotelId);
        if (!(feats as any)?.enableAi) return createResponse({ available: false }, 'AI not enabled on this plan');
        return createResponse({ available: true, ...(await SaasSettingsService.getAiConfig(user.hotelId)) }, 'AI config');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        detail: { summary: 'Get AI engine config', tags: ['SaaS'] }
    })
    .patch('/ai', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const feats = await SaasSettingsService.getTenantFeatures(user.hotelId);
        if (!(feats as any)?.enableAi) throw new ValidationError('AI is not enabled on your plan');
        return createResponse(await SaasSettingsService.setAiConfig(user.hotelId, body), 'AI config updated');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        body: t.Partial(t.Object({ enabled: t.Boolean(), model: t.String(), apiKey: t.String() })),
        detail: { summary: 'Update AI engine config (Gemini key)', tags: ['SaaS'] }
    })
    .get('/cbms', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const feats = await SaasSettingsService.getTenantFeatures(user.hotelId);
        if (!(feats as any)?.enableCbms) return createResponse({ available: false }, 'CBMS not enabled on this plan');
        return createResponse({ available: true, ...(await SaasSettingsService.getCbmsConfig(user.hotelId)) }, 'CBMS config');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        detail: { summary: 'Get IRD CBMS config', tags: ['SaaS'] }
    })
    .patch('/cbms', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const feats = await SaasSettingsService.getTenantFeatures(user.hotelId);
        if (!(feats as any)?.enableCbms) throw new ValidationError('CBMS is not enabled on your plan');
        const updated = await SaasSettingsService.setCbmsConfig(user.hotelId, body);
        return createResponse(updated, 'CBMS config updated');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        body: t.Partial(t.Object({
            enabled: t.Boolean(),
            username: t.String(),
            password: t.String(),
            sellerPan: t.String(),
            isRealtime: t.Boolean(),
        })),
        detail: { summary: 'Update IRD CBMS config', tags: ['SaaS'] }
    })

    .patch('/features', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updated = await SaasSettingsService.updateTenantFeatures(user.hotelId, body);
        return createResponse(updated, 'Tenant features updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        body: t.Partial(t.Object({
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
    });
