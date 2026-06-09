import { Elysia, t } from 'elysia';
import { db } from '../../db';
import { reviews, hotels } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { createResponse } from '../../utils/response.helper';
import { ValidationError, NotFoundError } from '../../utils/errors';
import { PERMISSIONS } from '../../config/permissions';
import { ReviewsService } from './reviews.service';
import { AiService } from '../../shared/ai.service';

export const reviewsController = new Elysia({ prefix: '/reviews' })
    .use(authMiddleware)

    // Staff: list reviews (filter by sentiment/source)
    .get('/', async ({ user, query }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const data = await ReviewsService.list(user.hotelId, { sentiment: query.sentiment, source: query.source, limit: query.limit ? parseInt(query.limit) : undefined });
        return createResponse(data, 'Reviews');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ANALYTICS.VIEW_OPERATIONS,
        query: t.Object({ sentiment: t.Optional(t.String()), source: t.Optional(t.String()), limit: t.Optional(t.String()) }),
        detail: { summary: 'List reviews', tags: ['Reviews'] }
    })

    // Staff: sentiment + recurring-complaint insights
    .get('/insights', async ({ user, query }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        return createResponse(await ReviewsService.insights(user.hotelId, query.days ? parseInt(query.days) : 90), 'Review insights');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ANALYTICS.VIEW_OPERATIONS,
        query: t.Object({ days: t.Optional(t.String()) }),
        detail: { summary: 'Review sentiment + recurring complaints', tags: ['Reviews'] }
    })

    // Staff: manually add an imported review (Google/OTA paste)
    .post('/', async ({ user, body }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        return createResponse(await ReviewsService.create(user.hotelId, body), 'Review added');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ANALYTICS.VIEW_OPERATIONS,
        body: t.Object({
            guestName: t.Optional(t.String()),
            rating: t.Optional(t.Number({ minimum: 1, maximum: 5 })),
            comment: t.Optional(t.String({ maxLength: 4000 })),
            source: t.Optional(t.String()),
            externalId: t.Optional(t.String()),
        }),
        detail: { summary: 'Add an external review', tags: ['Reviews'] }
    })

    // Staff: draft an on-brand reply (AI if configured, else a template — zero cost)
    .post('/:id/draft-reply', async ({ user, params }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const review = await db.query.reviews.findFirst({ where: and(eq(reviews.id, parseInt(params.id)), eq(reviews.hotelId, user.hotelId)) });
        if (!review) throw new NotFoundError('Review');
        const hotel = await db.query.hotels.findFirst({ where: eq(hotels.id, user.hotelId), columns: { name: true } });
        const hotelName = hotel?.name || 'our hotel';

        let draft = await AiService.generate(
            user.hotelId,
            `You write short, warm, professional public replies to hotel guest reviews for "${hotelName}". 2-4 sentences. Thank the guest, address their specific points, and for complaints apologise sincerely and state a concrete improvement. No markdown.`,
            `Rating: ${review.rating ?? 'n/a'}/5\nReview: "${review.comment || ''}"\nWrite the reply.`,
            300,
        );
        // Free fallback when AI is not configured.
        if (!draft) {
            const name = review.guestName ? `Dear ${review.guestName}, ` : 'Dear guest, ';
            draft = review.sentiment === 'NEGATIVE'
                ? `${name}thank you for your honest feedback, and we're sorry your stay fell short of expectations. We're addressing the issues you raised and would value the chance to host you better next time. — ${hotelName}`
                : `${name}thank you so much for the kind words! We're delighted you enjoyed your stay and look forward to welcoming you back. — ${hotelName}`;
        }
        const saved = await ReviewsService.saveReply(user.hotelId, review.id, draft, false);
        return createResponse({ draft, review: saved, aiUsed: await AiService.isEnabled(user.hotelId) }, 'Reply drafted');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ANALYTICS.VIEW_OPERATIONS,
        params: t.Object({ id: t.String() }),
        detail: { summary: 'AI-draft a reply (template fallback)', tags: ['Reviews'] }
    });
