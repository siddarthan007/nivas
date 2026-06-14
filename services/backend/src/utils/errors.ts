/**
 * Standardized HTTP Error Classes
 * Provides consistent error handling across all controllers
 */

export class HttpError extends Error {
    public statusCode: number;
    public code?: string;

    constructor(message: string, statusCode: number = 400, code?: string) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.name = 'HttpError';
    }
}

export class NotFoundError extends HttpError {
    constructor(resource: string) {
        super(`${resource} not found`, 404, 'NOT_FOUND');
    }
}

export class UnauthorizedError extends HttpError {
    constructor(message = 'Unauthorized') {
        super(message, 401, 'UNAUTHORIZED');
    }
}

export class ForbiddenError extends HttpError {
    constructor(message = 'Access denied') {
        super(message, 403, 'FORBIDDEN');
    }
}

export class ValidationError extends HttpError {
    constructor(message: string) {
        super(message, 400, 'VALIDATION_ERROR');
    }
}

export class ConflictError extends HttpError {
    constructor(message: string) {
        super(message, 409, 'CONFLICT');
    }
}

export class ServiceUnavailableError extends HttpError {
    constructor(service: string) {
        super(`${service} is currently unavailable`, 503, 'SERVICE_UNAVAILABLE');
    }
}

export class RateLimitError extends HttpError {
    constructor(message = 'Too many requests') {
        super(message, 429, 'RATE_LIMIT_EXCEEDED');
    }
}

export class BusinessLogicError extends HttpError {
    constructor(message: string) {
        super(message, 422, 'BUSINESS_LOGIC_ERROR');
    }
}

export class ExternalServiceError extends HttpError {
    public service: string;
    public originalError?: unknown;

    constructor(service: string, message: string, originalError?: unknown) {
        super(`${service}: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR');
        this.service = service;
        this.originalError = originalError;
    }
}

/**
 * Assert helpers for common patterns
 */
export function assertFound<T>(value: T | null | undefined, resource: string): asserts value is T {
    if (!value) {
        throw new NotFoundError(resource);
    }
}

export function assertAuthorized(condition: boolean, message = 'Unauthorized'): void {
    if (!condition) {
        throw new UnauthorizedError(message);
    }
}

export function assertValid(condition: boolean, message: string): void {
    if (!condition) {
        throw new ValidationError(message);
    }
}

export function assertBusinessRule(condition: boolean, message: string): void {
    if (!condition) {
        throw new BusinessLogicError(message);
    }
}

/**
 * Wrap external service calls with error handling
 */
export async function withServiceError<T>(
    service: string,
    operation: () => Promise<T>
): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new ExternalServiceError(service, 'Operation failed', error);
    }
}
