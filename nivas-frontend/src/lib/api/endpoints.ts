/**
 * Nivas PMS API Endpoints
 * Centralized endpoint definitions for all backend routes
 */

// Base prefix for all API routes
const API_PREFIX = '/api/v1';

/**
 * API Endpoints organized by module
 */
export const ENDPOINTS = {
    // ========================================================================
    // Authentication & Profile
    // ========================================================================
    AUTH: {
        LOGIN: `${API_PREFIX}/iam/login`,
        VERIFY_OTP: `${API_PREFIX}/iam/verify-otp`,
        PROFILE: `${API_PREFIX}/iam/profile`,
        CHANGE_PASSWORD: `${API_PREFIX}/iam/change-password`,
        LOGOUT: `${API_PREFIX}/iam/logout`,
    },

    // ========================================================================
    // Users & IAM
    // ========================================================================
    USERS: {
        LIST: `${API_PREFIX}/users`,
        CREATE: `${API_PREFIX}/users`,
        GET: (id: string) => `${API_PREFIX}/users/${id}`,
        UPDATE: (id: string) => `${API_PREFIX}/users/${id}`,
        DELETE: (id: string) => `${API_PREFIX}/users/${id}`,
        RESET_PASSWORD: (id: string) => `${API_PREFIX}/users/${id}/reset-password`,
    },

    ROLES: {
        LIST: `${API_PREFIX}/roles`,
        CREATE: `${API_PREFIX}/roles`,
        GET: (id: number) => `${API_PREFIX}/roles/${id}`,
        UPDATE: (id: number) => `${API_PREFIX}/roles/${id}`,
        DELETE: (id: number) => `${API_PREFIX}/roles/${id}`,
    },

    // ========================================================================
    // Rooms
    // ========================================================================
    ROOMS: {
        LIST: `${API_PREFIX}/rooms`,
        CREATE: `${API_PREFIX}/rooms`,
        BULK_CREATE: `${API_PREFIX}/rooms/bulk`,
        GET: (id: number) => `${API_PREFIX}/rooms/${id}`,
        UPDATE: (id: number) => `${API_PREFIX}/rooms/${id}`,
        DELETE: (id: number) => `${API_PREFIX}/rooms/${id}`,
    },

    // ========================================================================
    // Bookings
    // ========================================================================
    BOOKINGS: {
        LIST: `${API_PREFIX}/bookings`,
        CREATE: `${API_PREFIX}/bookings`,
        GET: (id: string) => `${API_PREFIX}/bookings/${id}`,
        UPDATE: (id: string) => `${API_PREFIX}/bookings/${id}`,
        CANCEL: (id: string) => `${API_PREFIX}/bookings/${id}/cancel`,
        EXTEND: (id: string) => `${API_PREFIX}/bookings/${id}/extend`,
        CHANGE_ROOM: (id: string) => `${API_PREFIX}/bookings/${id}/change-room`,
        CHECK_IN: (id: string) => `${API_PREFIX}/bookings/${id}/check-in`,
        CHECK_OUT: (id: string) => `${API_PREFIX}/bookings/${id}/check-out`,
    },

    // ========================================================================
    // Orders
    // ========================================================================
    ORDERS: {
        LIST: `${API_PREFIX}/orders`,
        CREATE: `${API_PREFIX}/orders`,
        GET: (id: string) => `${API_PREFIX}/orders/${id}`,
        UPDATE: (id: string) => `${API_PREFIX}/orders/${id}`,
        CANCEL: (id: string) => `${API_PREFIX}/orders/${id}/cancel`,
        UPDATE_STATUS: (id: string) => `${API_PREFIX}/orders/${id}/status`,
    },

    // ========================================================================
    // Menu
    // ========================================================================
    MENU: {
        LIST: `${API_PREFIX}/menu`,
        CREATE: `${API_PREFIX}/menu`,
        GET: (id: number) => `${API_PREFIX}/menu/${id}`,
        UPDATE: (id: number) => `${API_PREFIX}/menu/${id}`,
        DELETE: (id: number) => `${API_PREFIX}/menu/${id}`,
    },

    // ========================================================================
    // Housekeeping
    // ========================================================================
    HOUSEKEEPING: {
        LIST: `${API_PREFIX}/housekeeping`,
        CREATE: `${API_PREFIX}/housekeeping`,
        UPDATE: (id: number) => `${API_PREFIX}/housekeeping/${id}`,
        DELETE: (id: number) => `${API_PREFIX}/housekeeping/${id}`,
        UPDATE_STATUS: (id: number) => `${API_PREFIX}/housekeeping/${id}/status`,
        START: (id: number) => `${API_PREFIX}/housekeeping/${id}/start`,
    },

    // ========================================================================
    // Inventory
    // ========================================================================
    INVENTORY: {
        LIST: `${API_PREFIX}/inventory`,
        CREATE: `${API_PREFIX}/inventory`,
        GET: (id: number) => `${API_PREFIX}/inventory/${id}`,
        UPDATE: (id: number) => `${API_PREFIX}/inventory/${id}`,
        DELETE: (id: number) => `${API_PREFIX}/inventory/${id}`,
        ADJUST_STOCK: (id: number) => `${API_PREFIX}/inventory/${id}/adjust`,
        LOW_STOCK: `${API_PREFIX}/inventory/low-stock`,
    },

    // ========================================================================
    // Analytics
    // ========================================================================
    ANALYTICS: {
        DASHBOARD: `${API_PREFIX}/analytics/dashboard`,
        REVENUE: `${API_PREFIX}/analytics/revenue`,
        OCCUPANCY: `${API_PREFIX}/analytics/occupancy`,
        STAFF_PERFORMANCE: `${API_PREFIX}/analytics/staff-performance`,
        METRICS: `${API_PREFIX}/analytics/metrics`,
        OVERVIEW: `${API_PREFIX}/analytics/overview`, // Super Admin only
    },

    // ========================================================================
    // Reports
    // ========================================================================
    REPORTS: {
        DSR: `${API_PREFIX}/reports/dsr`, // Daily Sales Report
        OCCUPANCY: `${API_PREFIX}/reports/occupancy`,
        REVENUE: `${API_PREFIX}/reports/revenue`,
        HOUSEKEEPING: `${API_PREFIX}/reports/housekeeping`,
        EXPORT: `${API_PREFIX}/reports/export`,
    },

    // ========================================================================
    // Super Admin
    // ========================================================================
    SUPER_ADMIN: {
        TENANTS: {
            LIST: `${API_PREFIX}/saas-admin/tenants`,
            CREATE: `${API_PREFIX}/super-admin/onboard`,
            GET: (id: number) => `${API_PREFIX}/saas-admin/tenants/${id}`,
            UPDATE: (id: number) => `${API_PREFIX}/saas-admin/tenants/${id}`,
            DELETE: (id: number) => `${API_PREFIX}/saas-admin/tenants/${id}`,
        },
        LICENSES: {
            // Derived from tenants for now
            LIST: `${API_PREFIX}/saas-admin/tenants`,
            CREATE: `${API_PREFIX}/super-admin/onboard`, // Proxy
            GET: (id: number) => `${API_PREFIX}/super-admin/licenses/${id}`,
            UPDATE: (id: number) => `${API_PREFIX}/super-admin/licenses/${id}`,
        },
        ANALYTICS: `${API_PREFIX}/analytics/overview`,
    },

    // ========================================================================
    // Settings
    // ========================================================================
    SETTINGS: {
        HOTEL: `${API_PREFIX}/settings/hotel`,
        OUTLETS: `${API_PREFIX}/settings/outlets`,
        OUTLET: (id: number) => `${API_PREFIX}/settings/outlets/${id}`,
        TAX: `${API_PREFIX}/settings/tax`,
    },

    // ========================================================================
    // Finance
    // ========================================================================
    FINANCE: {
        PAYMENTS: `${API_PREFIX}/finance/payments`,
        PAYMENT: (id: string) => `${API_PREFIX}/finance/payments/${id}`,
        VOID_PAYMENT: (id: string) => `${API_PREFIX}/finance/payments/${id}/void`,
        FOLIO_CHARGES: `${API_PREFIX}/billing/folio-charges`,
        FOLIO_CHARGE: (id: number) => `${API_PREFIX}/billing/folio-charges/${id}`,
        BOOKING_FOLIO: (bookingId: string) => `${API_PREFIX}/billing/bookings/${bookingId}/folio`,
    },

    // ========================================================================
    // Procurement
    // ========================================================================
    PROCUREMENT: {
        LIST: `${API_PREFIX}/procurement/purchase-orders`,
        CREATE: `${API_PREFIX}/procurement/purchase-orders`,
        GET: (id: number) => `${API_PREFIX}/procurement/purchase-orders/${id}`,
        UPDATE: (id: number) => `${API_PREFIX}/procurement/purchase-orders/${id}`,
        DELETE: (id: number) => `${API_PREFIX}/procurement/purchase-orders/${id}`,
        APPROVE: (id: number) => `${API_PREFIX}/procurement/purchase-orders/${id}/approve`,
        REJECT: (id: number) => `${API_PREFIX}/procurement/purchase-orders/${id}/reject`,
        RECEIVE: (id: number) => `${API_PREFIX}/procurement/purchase-orders/${id}/receive`,
    },

    // ========================================================================
    // Corporate
    // ========================================================================
    CORPORATE: {
        COMPANIES: `${API_PREFIX}/crm/companies`,
        COMPANY: (id: number) => `${API_PREFIX}/crm/companies/${id}`,
        AGENTS: `${API_PREFIX}/crm/agents`,
        AGENT: (id: number) => `${API_PREFIX}/crm/agents/${id}`,
    },

    // ========================================================================
    // Banquets / Events
    // ========================================================================
    BANQUETS: {
        VENUES: `${API_PREFIX}/banquets/venues`,
        VENUE: (id: number) => `${API_PREFIX}/banquets/venues/${id}`,
        BOOKINGS: `${API_PREFIX}/banquets/bookings`,
        BOOKING: (id: string) => `${API_PREFIX}/banquets/bookings/${id}`,
        BOOKING_STATUS: (id: string) => `${API_PREFIX}/banquets/bookings/${id}/status`,
    },

    // ========================================================================
    // CRM / Guests
    // ========================================================================
    GUESTS: {
        LIST: `${API_PREFIX}/guests`,
        CREATE: `${API_PREFIX}/guests`,
        GET: (id: string) => `${API_PREFIX}/guests/${id}`,
        UPDATE: (id: string) => `${API_PREFIX}/guests/${id}`,
        HISTORY: (id: string) => `${API_PREFIX}/guests/${id}/history`,
    },

    // ========================================================================
    // Messages
    // ========================================================================
    MESSAGES: {
        SEND: `${API_PREFIX}/messages`,
        INBOX: `${API_PREFIX}/messages/inbox`,
        CONVERSATIONS: `${API_PREFIX}/messages/conversations`,
        READ: (id: string) => `${API_PREFIX}/messages/${id}/read`,
        DELETE: (id: string) => `${API_PREFIX}/messages/${id}`,
    },

    // ========================================================================
    // Operations
    // ========================================================================
    OPERATIONS: {
        FLOORS: `${API_PREFIX}/ops/floors`,
        FLOOR: (id: number) => `${API_PREFIX}/ops/floors/${id}`,
        FACILITIES: `${API_PREFIX}/operations/facilities`,
        FACILITY: (id: number) => `${API_PREFIX}/operations/facilities/${id}`,
        PARKING: `${API_PREFIX}/operations/facilities/parking`,
        PARKING_SPOT: (id: number) => `${API_PREFIX}/operations/facilities/parking/${id}`,
    },

    // ========================================================================
    // Night Audit
    // ========================================================================
    NIGHT_AUDIT: {
        TRIGGER: `${API_PREFIX}/night-audit/trigger`,
        HISTORY: `${API_PREFIX}/night-audit/history`,
        STATUS: `${API_PREFIX}/night-audit/status`,
    },
    // ========================================================================
    // HR & Payroll
    // ========================================================================
    HR: {
        PAYROLL_LIST: `${API_PREFIX}/hr/payroll`,
        PAYROLL_CREATE: `${API_PREFIX}/hr/payroll`,
        PAYROLL_PAY: (id: number) => `${API_PREFIX}/hr/payroll/${id}/pay`,
    },
} as const;

export default ENDPOINTS;
