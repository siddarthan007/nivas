import { HttpError } from '../utils/errors';
import { logger } from '../shared/logger';

export const errorMiddleware = (app: any) => {
    return app.onError(({ error, set, request }: any) => {
        const logPayload = {
            method: request.method,
            url: request.url,
            message: error.message,
            stack: error.stack,
        };

        if (error instanceof HttpError) {
            set.status = error.statusCode;
            if (error.statusCode >= 500) {
                logger.error(logPayload, `[${error.statusCode}] ${error.message}`);
            }
            return {
                status: 'error',
                message: error.message,
                code: error.code || 'INTERNAL_SERVER_ERROR'
            };
        }

        logger.error(logPayload, `[500] Unhandled: ${error.message}`);

        set.status = 500;
        return {
            status: 'error',
            message: 'Internal Server Error',
            code: 'INTERNAL_SERVER_ERROR',
        };
    });
};
