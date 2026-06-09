import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';
import { PERMISSIONS } from '../../config/permissions';
import { AiService } from '../../shared/ai.service';
import { AiAnalyticsService } from './ai-analytics.service';

export const aiController = new Elysia({ prefix: '/ai' })
    .use(authMiddleware)

    .get('/status', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        return createResponse({ enabled: await AiService.isEnabled(user.hotelId) }, 'AI status');
    }, {
        isSignedIn: true,
        detail: { summary: 'Is AI enabled for this hotel?', tags: ['AI'] }
    })

    .post('/ask', async ({ user, body }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const q = (body.question || '').trim();
        if (q.length < 3) throw new ValidationError('Please ask a question');
        if (q.length > 500) throw new ValidationError('Question too long');
        const result = await AiAnalyticsService.ask(user.hotelId, q);
        return createResponse(result, 'Answer');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ANALYTICS.VIEW_OPERATIONS,
        body: t.Object({ question: t.String() }),
        detail: { summary: 'Ask your hotel — NL analytics (RAG over scoped data)', tags: ['AI'] }
    });
