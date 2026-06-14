/**
 * Nivas Shared Types
 * Re-exports backend Drizzle schema types and shared API types.
 */

// Re-export all schema types from the backend
export * from '../../../services/backend/src/db/schema';

// Shared API response types
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
    timestamp?: string;
}

export interface LicenseErrorInfo {
    licenseStatus: 'EXPIRED' | 'PAUSED' | 'REVOKED' | 'PENDING_PAYMENT';
    message: string;
    expiresAt?: string;
    graceEndsAt?: string;
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'CARD' | 'ESEWA' | 'KHALTI' | 'CONNECT_IPS' | 'FONEPAY' | 'UPI' | 'BANK_TRANSFER' | 'OTHER';
