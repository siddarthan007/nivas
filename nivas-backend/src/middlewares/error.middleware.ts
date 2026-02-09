import { HttpError, ValidationError, BusinessLogicError, UnauthorizedError, ForbiddenError, NotFoundError } from '../utils/errors';

export const errorMiddleware = (app: any) => {
    return app.onError(({ error, set, request }: any) => {
        // Detailed logging for ALL errors in production/dev
        // console.error(`[Error] ${request.method} ${request.url}:`, error);

        // Log to file for debugging
        try {
            const fs = require('fs');
            const logMessage = `[${new Date().toISOString()}] ${request.method} ${request.url}: ${error.message}\n${error.stack}\n\n`;
            fs.appendFileSync('error.log', logMessage);
        } catch (e) {
            console.error('Failed to write to error log', e);
        }

        if (error instanceof HttpError) {
            set.status = error.statusCode;
            return {
                status: 'error',
                message: error.message,
                code: error.code || 'INTERNAL_SERVER_ERROR'
            };
        }

        if (error instanceof ValidationError) {
            set.status = 400;
            return {
                status: 'error',
                message: error.message,
                code: 'VALIDATION_ERROR'
            };
        }

        if (error instanceof BusinessLogicError) {
            set.status = 400;
            return {
                status: 'error',
                message: error.message,
                code: 'BUSINESS_LOGIC_ERROR'
            };
        }

        if (error instanceof UnauthorizedError) {
            set.status = 401;
            return {
                status: 'error',
                message: error.message,
                code: 'UNAUTHORIZED'
            };
        }

        if (error instanceof ForbiddenError) {
            set.status = 403;
            return {
                status: 'error',
                message: error.message,
                code: 'FORBIDDEN'
            };
        }

        if (error instanceof NotFoundError) {
            set.status = 404;
            return {
                status: 'error',
                message: error.message,
                code: 'NOT_FOUND'
            };
        }

        // Default to 500
        set.status = 500;
        return {
            status: 'error',
            message: 'Internal Server Error',
            code: 'INTERNAL_SERVER_ERROR',
            // Only expose stack in dev if needed, or never for security
            // stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        };
    });
};
