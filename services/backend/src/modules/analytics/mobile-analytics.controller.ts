import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { MobileAnalyticsService } from './mobile-analytics.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

export const mobileAnalyticsController = new Elysia({ prefix: '/mobile-analytics' })
    .use(authMiddleware)
    .post('/events', async ({ user, body }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }
        await MobileAnalyticsService.ingest(user.hotelId, user.id, body.events);
        return createResponse(null, 'Events recorded');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ANALYTICS.VIEW_OPERATIONS,
        body: t.Object({
            events: t.Array(t.Object({
                type: t.Union([t.Literal('screen_view'), t.Literal('action'), t.Literal('error'), t.Literal('session')]),
                name: t.String(),
                timestamp: t.String(),
                metadata: t.Optional(t.Record(t.String(), t.Any())),
                durationMs: t.Optional(t.Number()),
            }))
        }),
        detail: { summary: 'Ingest mobile analytics events', tags: ['Analytics'] }
    })
    .get('/summary', async ({ user, query }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }
        const days = Math.min(90, Math.max(1, parseInt(query.days ?? '7')));
        const data = await MobileAnalyticsService.getSummary(user.hotelId, days);
        return createResponse(data, 'Mobile analytics summary');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ANALYTICS.VIEW_OPERATIONS,
        query: t.Object({ days: t.Optional(t.String()) }),
        detail: { summary: 'Get mobile analytics summary', tags: ['Analytics'] }
    });
