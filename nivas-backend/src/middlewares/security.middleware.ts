import { Elysia } from 'elysia';

export const securityMiddleware = (app: Elysia) =>
    app.onRequest(({ set }) => {
        set.headers['X-Content-Type-Options'] = 'nosniff';
        set.headers['X-Frame-Options'] = 'DENY';
        set.headers['X-XSS-Protection'] = '1; mode=block';
        set.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';
        set.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline'; object-src 'none'; img-src 'self' data: https:;";
        set.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
        delete set.headers['x-powered-by'];
    });
