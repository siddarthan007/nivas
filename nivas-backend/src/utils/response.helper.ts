import { HttpError } from './errors';

export interface ApiResponse<T = unknown> {
    status: 'success' | 'error';
    message?: string;
    data?: T;
    meta?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    code?: string;
    timestamp: string;
}

export const createResponse = <T>(
    data: T,
    message: string = 'Success',
    meta?: ApiResponse['meta']
): ApiResponse<T> => {
    return {
        status: 'success',
        message,
        data: JSON.parse(JSON.stringify(data, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        )),
        meta,
        timestamp: new Date().toISOString()
    };
};

export const createErrorResponse = (
    message: string,
    code: string = 'INTERNAL_SERVER_ERROR'
): ApiResponse => {
    return {
        status: 'error',
        message,
        code,
        timestamp: new Date().toISOString()
    };
};

export const getPaginationResult = <T>(
    data: T[],
    total: number,
    page: number,
    limit: number
) => {
    return {
        data,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};
