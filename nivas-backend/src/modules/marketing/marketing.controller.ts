import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { MarketingService } from './marketing.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

const channel = t.Union([t.Literal('SMS'), t.Literal('EMAIL')]);
const segment = t.Union([t.Literal('ALL'), t.Literal('VIP'), t.Literal('HOTEL_GUEST'), t.Literal('RESTAURANT_CUSTOMER')]);

export const marketingController = new Elysia({ prefix: '/marketing' })
    .use(authMiddleware)
    .get('/templates', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        return createResponse(await MarketingService.listTemplates(user.hotelId), 'Templates fetched');
    }, { isSignedIn: true, hasPermission: PERMISSIONS.COMMUNICATIONS.SEND_MESSAGE, detail: { summary: 'List marketing templates', tags: ['Marketing'] } })
    .post('/templates', async ({ user, body }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        return createResponse(await MarketingService.createTemplate(user.hotelId, user.id, body), 'Template created');
    }, {
        isSignedIn: true, hasPermission: PERMISSIONS.COMMUNICATIONS.SEND_MESSAGE,
        body: t.Object({ name: t.String(), channel, subject: t.Optional(t.String()), body: t.String() }),
        detail: { summary: 'Create template', tags: ['Marketing'] }
    })
    .patch('/templates/:id', async ({ user, params, body }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        return createResponse(await MarketingService.updateTemplate(user.hotelId, parseInt(params.id), body), 'Template updated');
    }, {
        isSignedIn: true, hasPermission: PERMISSIONS.COMMUNICATIONS.SEND_MESSAGE,
        params: t.Object({ id: t.String() }),
        body: t.Object({ name: t.Optional(t.String()), channel: t.Optional(channel), subject: t.Optional(t.String()), body: t.Optional(t.String()) }),
        detail: { summary: 'Update template', tags: ['Marketing'] }
    })
    .delete('/templates/:id', async ({ user, params }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        return createResponse(await MarketingService.deleteTemplate(user.hotelId, parseInt(params.id)), 'Template deleted');
    }, { isSignedIn: true, hasPermission: PERMISSIONS.COMMUNICATIONS.SEND_MESSAGE, params: t.Object({ id: t.String() }), detail: { summary: 'Delete template', tags: ['Marketing'] } })
    .get('/preview', async ({ user, query }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        return createResponse(await MarketingService.previewSegment(user.hotelId, query.channel, query.segment), 'Segment preview');
    }, {
        isSignedIn: true, hasPermission: PERMISSIONS.COMMUNICATIONS.SEND_MESSAGE,
        query: t.Object({ channel, segment }),
        detail: { summary: 'Preview recipient count', tags: ['Marketing'] }
    })
    .post('/send', async ({ user, body, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const ip = request.headers.get('x-forwarded-for') || undefined;
        return createResponse(await MarketingService.sendCampaign(user.hotelId, user.id, body, ip), 'Campaign sent');
    }, {
        isSignedIn: true, hasPermission: PERMISSIONS.COMMUNICATIONS.SEND_MESSAGE,
        body: t.Object({
            channel, segment,
            subject: t.Optional(t.String()),
            body: t.Optional(t.String()),
            templateId: t.Optional(t.Number()),
        }),
        detail: { summary: 'Send a marketing campaign', tags: ['Marketing'] }
    });
