/**
 * Shared error classes
 */

export class ApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly code?: string,
        public readonly data?: unknown
    ) {
        super(message);
        this.name = 'ApiError';
    }

    get isRetryable(): boolean {
        return this.status >= 500 || this.status === 0;
    }

    get isAuthError(): boolean {
        return this.status === 401;
    }
}

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

export class NotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NotFoundError';
    }
}

export class BusinessLogicError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BusinessLogicError';
    }
}
