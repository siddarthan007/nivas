import { HttpError } from '../utils/errors';
import { logger } from '../shared/logger';

import type { Elysia } from 'elysia';

export const errorMiddleware = (app: Elysia) => {
    return app.onError(({ error, set, request }) => {
        const err = error instanceof Error ? error : new Error(String(error));

        const logPayload = {
            method: request.method,
            url: request.url,
            message: err.message,
            stack: err.stack,
        };

        if (err instanceof HttpError) {
            set.status = err.statusCode;
            if (err.statusCode >= 500) {
                logger.error(logPayload, `[${err.statusCode}] ${err.message}`);
            }
            return {
                status: 'error',
                message: err.message,
                code: err.code || 'INTERNAL_SERVER_ERROR'
            };
        }

        // Postgres exclusion constraint violation (double-booking)
        const pgError = error as any;
        if (pgError?.code === '23P01') {
            set.status = 409;
            return {
                status: 'error',
                message: 'Room not available for selected dates. The dates overlap with an existing booking.',
                code: 'CONFLICT'
            };
        }

        logger.error(logPayload, `[500] Unhandled: ${err.message}`);

        set.status = 500;
        return {
            status: 'error',
            message: 'Internal Server Error',
            code: 'INTERNAL_SERVER_ERROR',
        };
    });
};
