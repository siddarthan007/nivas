/**
 * Nivas PMS API Client
 * Bun-native fetch client using server proxy
 */

// Relative path - forwarded by Bun server proxy to backend
const API_BASE_URL = '/api/v1'; // Prefix for proxy forwarding


// Token storage keys - prefixed to avoid collisions
const TOKEN_KEY = 'nivas_auth_token';
const USER_KEY = 'nivas_user_data';

/**
 * Secure token storage with XSS protection
 * Uses try-catch for SSR safety
 */
export const tokenStorage = {
    getToken(): string | null {
        if (typeof window === 'undefined') return null;
        try {
            return localStorage.getItem(TOKEN_KEY);
        } catch {
            return null;
        }
    },

    setToken(token: string): void {
        if (typeof window === 'undefined') return;
        try {
            // Basic JWT format validation (header.payload.signature)
            if (typeof token !== 'string' || token.split('.').length !== 3) {
                console.warn('[API] Invalid token format');
                return;
            }
            localStorage.setItem(TOKEN_KEY, token);
        } catch (e) {
            console.error('[API] Failed to store token:', e);
        }
    },

    removeToken(): void {
        if (typeof window === 'undefined') return;
        try {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
        } catch (e) {
            console.error('[API] Failed to remove token:', e);
        }
    },

    getUser<T>(): T | null {
        if (typeof window === 'undefined') return null;
        try {
            const data = localStorage.getItem(USER_KEY);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    },

    setUser<T>(user: T): void {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem(USER_KEY, JSON.stringify(user));
        } catch (e) {
            console.error('[API] Failed to store user:', e);
        }
    }
};

/**
 * Standardized API Response structure
 */
export interface ApiResponse<T = unknown> {
    status: 'success' | 'error';
    message?: string;
    data?: T;
    code?: string;
}

/**
 * License status information returned when license is invalid
 */
export interface LicenseErrorInfo {
    licenseStatus: 'EXPIRED' | 'PAUSED' | 'REVOKED' | 'PENDING_PAYMENT';
    message: string;
    expiresAt?: string;
    graceEndsAt?: string;
}

/**
 * Global license event listeners
 * Components can subscribe to be notified when license becomes invalid
 */
type LicenseEventHandler = (info: LicenseErrorInfo) => void;
const licenseEventHandlers = new Set<LicenseEventHandler>();

export const licenseEvents = {
    subscribe(handler: LicenseEventHandler): () => void {
        licenseEventHandlers.add(handler);
        return () => licenseEventHandlers.delete(handler);
    },
    emit(info: LicenseErrorInfo): void {
        licenseEventHandlers.forEach(handler => handler(info));
    }
};

/**
 * API Error with status code and optional error code
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

    /** Check if error is retryable (network issues, 5xx errors) */
    get isRetryable(): boolean {
        return this.status >= 500 || this.status === 0;
    }

    /** Check if auth refresh might help */
    get isAuthError(): boolean {
        return this.status === 401;
    }
}

/**
 * Request options with retry configuration
 */
interface RequestOptions extends Omit<RequestInit, 'body'> {
    body?: unknown;
    retries?: number;
    retryDelay?: number;
    skipAuth?: boolean;
}

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Core request function with authentication and error handling
 */
async function request<T>(
    endpoint: string,
    options: RequestOptions = {}
): Promise<ApiResponse<T>> {
    const {
        body,
        retries = 0,
        retryDelay = 1000,
        skipAuth = false,
        headers: customHeaders,
        ...fetchOptions
    } = options;

    // Build headers
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(customHeaders as Record<string, string> || {}),
    };

    // Add auth token if available and not skipped
    if (!skipAuth) {
        const token = tokenStorage.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }

    // Normalize endpoint (ensure leading slash)
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${API_BASE_URL}${normalizedEndpoint}`;

    let lastError: ApiError | null = null;
    let attempt = 0;

    while (attempt <= retries) {
        try {
            const response = await fetch(url, {
                ...fetchOptions,
                headers,
                body: body ? JSON.stringify(body) : undefined,
            });

            // Parse response
            let data: ApiResponse<T>;
            const contentType = response.headers.get('content-type');

            if (contentType?.includes('application/json')) {
                data = await response.json();
            } else {
                // Handle non-JSON responses
                const text = await response.text();
                data = {
                    status: response.ok ? 'success' : 'error',
                    message: text || response.statusText,
                };
            }

            // Handle HTTP errors
            if (!response.ok) {
                const error = new ApiError(
                    data.message || `Request failed with status ${response.status}`,
                    response.status,
                    data.code,
                    data.data
                );

                // Handle 401 - session expired (but not on login endpoint)
                if (response.status === 401 && !endpoint.includes('/login')) {
                    tokenStorage.removeToken();
                    if (typeof window !== 'undefined') {
                        window.location.href = '/login';
                    }
                }

                // Handle 403 with LICENSE_INVALID - emit license event
                if (response.status === 403 && data.code === 'LICENSE_INVALID') {
                    licenseEvents.emit({
                        licenseStatus: (data as any).licenseStatus ?? 'EXPIRED',
                        message: data.message || 'License is invalid',
                        expiresAt: (data as any).expiresAt,
                        graceEndsAt: (data as any).graceEndsAt,
                    });
                }

                throw error;
            }

            return data;

        } catch (e) {
            // Network errors
            if (e instanceof TypeError && e.message.includes('fetch')) {
                lastError = new ApiError('Network error. Please check your connection.', 0, 'NETWORK_ERROR');
            } else if (e instanceof ApiError) {
                lastError = e;
            } else {
                lastError = new ApiError(
                    e instanceof Error ? e.message : 'Unknown error occurred',
                    0,
                    'UNKNOWN_ERROR'
                );
            }

            // Retry if applicable
            if (lastError.isRetryable && attempt < retries) {
                attempt++;
                console.warn(`[API] Retry ${attempt}/${retries} for ${endpoint}`);
                await sleep(retryDelay * attempt); // Exponential backoff
                continue;
            }

            throw lastError;
        }
    }

    throw lastError || new ApiError('Request failed', 0);
}

/**
 * API client with typed HTTP methods
 * 
 * Usage:
 *   api.get<User>('/users/me')
 *   api.post<LoginResponse>('/iam/login', { email, password })
 *   api.patch<User>('/users/me', { name: 'New Name' })
 */
export const api = {
    /** GET request */
    get<T>(endpoint: string, options?: Omit<RequestOptions, 'body' | 'method'>): Promise<ApiResponse<T>> {
        return request<T>(endpoint, { ...options, method: 'GET' });
    },

    /** POST request with JSON body */
    post<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'body' | 'method'>): Promise<ApiResponse<T>> {
        return request<T>(endpoint, { ...options, method: 'POST', body });
    },

    /** PUT request with JSON body */
    put<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'body' | 'method'>): Promise<ApiResponse<T>> {
        return request<T>(endpoint, { ...options, method: 'PUT', body });
    },

    /** PATCH request with JSON body */
    patch<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'body' | 'method'>): Promise<ApiResponse<T>> {
        return request<T>(endpoint, { ...options, method: 'PATCH', body });
    },

    /** DELETE request */
    delete<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'body' | 'method'>): Promise<ApiResponse<T>> {
        return request<T>(endpoint, { ...options, method: 'DELETE', body });
    },

    /** Get the current API base URL (for debugging) */
    getBaseUrl(): string {
        return API_BASE_URL;
    }
};

export default api;
