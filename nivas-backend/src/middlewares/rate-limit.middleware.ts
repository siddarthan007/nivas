import { Elysia } from 'elysia';
import { rateLimit } from 'elysia-rate-limit';

export const rateLimitMiddleware = (app: any) =>
    app.use(rateLimit({
        duration: 60000,
        max: 100,
        errorResponse: 'Rate limit exceeded. Please try again later.'
    }));
