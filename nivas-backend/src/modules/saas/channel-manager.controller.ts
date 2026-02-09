import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { ChannelManagerService } from './channel-manager.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError, NotFoundError, BusinessLogicError } from '../../utils/errors';

export const channelManagerController = new Elysia({ prefix: '/channel-manager' })
    .use(authMiddleware)

    .get('/channels', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const channels = await ChannelManagerService.getChannelSettings(user.hotelId);
        return createResponse(channels, 'Channel mappings fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        detail: { summary: 'Get all channel connections', tags: ['SaaS'] }
    })
    .post('/channels', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const channel = await ChannelManagerService.createChannelSettings(user.hotelId, body);
        return createResponse(channel, 'Channel connection added successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        body: t.Object({
            channelCode: t.Union([
                t.Literal('BOOKING_COM'),
                t.Literal('EXPEDIA'),
                t.Literal('AGODA'),
                t.Literal('MMT'),
                t.Literal('GOIBIBO'),
                t.Literal('AIRBNB')
            ]),
            channelName: t.String(),
            apiKey: t.Optional(t.String()),
            apiSecret: t.Optional(t.String()),
            hotelCode: t.Optional(t.String()),
            syncRates: t.Optional(t.Boolean()),
            syncAvailability: t.Optional(t.Boolean()),
            syncReservations: t.Optional(t.Boolean()),
            rateMultiplier: t.Optional(t.Number()),
            minLeadTime: t.Optional(t.Number())
        }),
        detail: { summary: 'Add channel connection', tags: ['SaaS'] }
    })
    .patch('/channels/:id', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updated = await ChannelManagerService.updateChannelSettings(user.hotelId, parseInt(params.id), body);
        return createResponse(updated, 'Channel settings updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        body: t.Partial(t.Object({
            apiKey: t.String(),
            apiSecret: t.String(),
            hotelCode: t.String(),
            syncRates: t.Boolean(),
            syncAvailability: t.Boolean(),
            syncReservations: t.Boolean(),
            rateMultiplier: t.Number(),
            minLeadTime: t.Number(),
            isActive: t.Boolean()
        })),
        detail: { summary: 'Update channel settings', tags: ['SaaS'] }
    })
    .delete('/channels/:id', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        await ChannelManagerService.deleteChannelSettings(user.hotelId, parseInt(params.id));
        return createResponse(null, 'Channel disconnected');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        detail: { summary: 'Delete channel connection', tags: ['SaaS'] }
    })
    .post('/channels/:id/mappings', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const mapping = await ChannelManagerService.createRateMapping(user.hotelId, parseInt(params.id), body);
        return createResponse(mapping, 'Rate mapping added successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        body: t.Object({
            localRoomType: t.String(),
            channelRoomCode: t.String(),
            channelRatePlanCode: t.Optional(t.String()),
            priceAdjustment: t.Optional(t.Number()),
            adjustmentType: t.Optional(t.Union([t.Literal('FLAT'), t.Literal('PERCENTAGE')]))
        }),
        detail: { summary: 'Add rate mapping', tags: ['SaaS'] }
    })
    .post('/channels/:id/sync-inventory', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const result = await ChannelManagerService.syncInventory(user.hotelId, parseInt(params.id));
        return createResponse(result, 'Inventory sync triggered');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        detail: { summary: 'Sync inventory to channel', tags: ['SaaS'] }
    })
    .post('/channels/:id/sync-rates', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const result = await ChannelManagerService.syncRates(user.hotelId, parseInt(params.id));
        return createResponse(result, 'Rate sync triggered');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        detail: { summary: 'Sync rates to channel', tags: ['SaaS'] }
    })
    .get('/sync-logs', async ({ user, query }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const logs = await ChannelManagerService.getSyncLogs(user.hotelId, query.limit ? parseInt(query.limit) : 50);
        return createResponse(logs, 'Sync logs fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        query: t.Object({
            limit: t.Optional(t.String())
        }),
        detail: { summary: 'Get sync logs', tags: ['SaaS'] }
    })
    .post('/webhook/:channelCode', async ({ body, headers, params }) => {
        const channelCode = params.channelCode;
        const signature = headers['x-webhook-signature'] as string | undefined;

        // Validate webhook signature when configured
        if (!signature) {
            console.warn(`[ChannelManager] Webhook received for ${channelCode} without signature`);
        }

        // Validate basic payload structure
        if (!body || typeof body !== 'object') {
            return createResponse(null, 'Invalid webhook payload');
        }

        // Log the webhook for processing
        console.info(`[ChannelManager] Webhook received for channel: ${channelCode}`);

        // TODO: Process webhook payload based on channel type when OTA partnerships are established.
        // For now, acknowledge receipt.
        return createResponse({ channelCode, received: true }, 'Webhook acknowledged');
    }, {
        body: t.Object({}, { additionalProperties: true }),
        detail: { summary: 'OTA webhook endpoint (coming soon)', tags: ['SaaS'] }
    });
