/**
 * Nivas PMS API Endpoints
 * Centralized endpoint definitions for all backend routes
 * Note: The API client in api.ts already adds the /api/v1 prefix
 */

/**
 * API Endpoints organized by module
 */
export const ENDPOINTS = {
    // ========================================================================
    // Authentication & Profile
    // ========================================================================
    AUTH: {
        LOGIN: '/iam/login',
        VERIFY_OTP: '/iam/verify-otp',
        PROFILE: '/iam/profile',
        CHANGE_PASSWORD: '/iam/change-password',
        LOGOUT: '/iam/logout',
    },

    // ========================================================================
    // Users & IAM
    // ========================================================================
    USERS: {
        LIST: '/users',
        CREATE: '/users',
        GET: (id: string) => `/users/${id}`,
        UPDATE: (id: string) => `/users/${id}`,
        DELETE: (id: string) => `/users/${id}`,
        RESET_PASSWORD: (id: string) => `/users/${id}/reset-password`,
    },

    ROLES: {
        LIST: '/roles',
        CREATE: '/roles',
        GET: (id: number) => `/roles/${id}`,
        UPDATE: (id: number) => `/roles/${id}`,
        DELETE: (id: number) => `/roles/${id}`,
    },

    // ========================================================================
    // Rooms
    // ========================================================================
    ROOMS: {
        LIST: '/rooms',
        CREATE: '/rooms',
        BULK_CREATE: '/rooms/bulk',
        GET: (id: number) => `/rooms/${id}`,
        UPDATE: (id: number) => `/rooms/${id}`,
        DELETE: (id: number) => `/rooms/${id}`,
    },

    // ========================================================================
    // Bookings
    // ========================================================================
    BOOKINGS: {
        LIST: '/bookings',
        CREATE: '/bookings',
        GET: (id: string) => `/bookings/${id}`,
        UPDATE: (id: string) => `/bookings/${id}`,
        CANCEL: (id: string) => `/bookings/${id}/cancel`,
        EXTEND: (id: string) => `/bookings/${id}/extend`,
        CHANGE_ROOM: (id: string) => `/bookings/${id}/change-room`,
        CHECK_IN: (id: string) => `/bookings/${id}/check-in`,
        CHECK_OUT: (id: string) => `/bookings/${id}/check-out`,
    },

    // ========================================================================
    // Orders
    // ========================================================================
    ORDERS: {
        LIST: '/orders',
        CREATE: '/orders',
        GET: (id: string) => `/orders/${id}`,
        UPDATE: (id: string) => `/orders/${id}`,
        CANCEL: (id: string) => `/orders/${id}/cancel`,
        UPDATE_STATUS: (id: string) => `/orders/${id}/status`,
    },

    // ========================================================================
    // Menu
    // ========================================================================
    MENU: {
        LIST: '/menu',
        CREATE: '/menu',
        GET: (id: number) => `/menu/${id}`,
        UPDATE: (id: number) => `/menu/${id}`,
        DELETE: (id: number) => `/menu/${id}`,
    },

    // ========================================================================
    // Housekeeping
    // ========================================================================
    HOUSEKEEPING: {
        LIST: '/housekeeping',
        CREATE: '/housekeeping',
        UPDATE: (id: number) => `/housekeeping/${id}`,
        DELETE: (id: number) => `/housekeeping/${id}`,
        UPDATE_STATUS: (id: number) => `/housekeeping/${id}/status`,
        START: (id: number) => `/housekeeping/${id}/start`,
    },

    // ========================================================================
    // Inventory
    // ========================================================================
    INVENTORY: {
        LIST: '/inventory',
        CREATE: '/inventory',
        GET: (id: number) => `/inventory/${id}`,
        UPDATE: (id: number) => `/inventory/${id}`,
        DELETE: (id: number) => `/inventory/${id}`,
        ADJUST_STOCK: (id: number) => `/inventory/${id}/adjust`,
        LOW_STOCK: '/inventory/low-stock',
    },

    // ========================================================================
    // Analytics
    // ========================================================================
    ANALYTICS: {
        DASHBOARD: '/analytics/dashboard',
        REVENUE: '/analytics/revenue',
        OCCUPANCY: '/analytics/occupancy',
        STAFF_PERFORMANCE: '/analytics/staff-performance',
        METRICS: '/analytics/metrics',
        OVERVIEW: '/analytics/overview', // Super Admin only
    },

    // ========================================================================
    // Reports
    // ========================================================================
    REPORTS: {
        DSR: '/reports/dsr', // Daily Sales Report
        OCCUPANCY: '/reports/occupancy',
        REVENUE: '/reports/revenue',
        HOUSEKEEPING: '/reports/housekeeping',
        EXPORT: '/reports/export',
    },

    // ========================================================================
    // Super Admin
    // ========================================================================
    SUPER_ADMIN: {
        TENANTS: {
            LIST: '/saas-admin/tenants',
            CREATE: '/super-admin/onboard',
            GET: (id: number) => `/saas-admin/tenants/${id}`,
            UPDATE: (id: number) => `/saas-admin/tenants/${id}`,
            DELETE: (id: number) => `/saas-admin/tenants/${id}`,
        },
        LICENSES: {
            // Derived from tenants for now
            LIST: '/saas-admin/tenants',
            CREATE: '/super-admin/onboard', // Proxy
            GET: (id: number) => `/super-admin/licenses/${id}`,
            UPDATE: (id: number) => `/super-admin/licenses/${id}`,
        },
        ANALYTICS: '/analytics/overview',
    },

    // ========================================================================
    // Settings
    // ========================================================================
    SETTINGS: {
        HOTEL: '/settings/hotel',
        OUTLETS: '/settings/outlets',
        OUTLET: (id: number) => `/settings/outlets/${id}`,
        TAX: '/settings/tax',
    },

    // ========================================================================
    // Finance
    // ========================================================================
    FINANCE: {
        PAYMENTS: '/finance/payments',
        PAYMENT: (id: string) => `/finance/payments/${id}`,
        VOID_PAYMENT: (id: string) => `/finance/payments/${id}/void`,
        FOLIO_CHARGES: '/billing/folio-charges',
        FOLIO_CHARGE: (id: number) => `/billing/folio-charges/${id}`,
        BOOKING_FOLIO: (bookingId: string) => `/billing/bookings/${bookingId}/folio`,
    },

    // ========================================================================
    // Procurement
    // ========================================================================
    PROCUREMENT: {
        LIST: '/procurement/purchase-orders',
        CREATE: '/procurement/purchase-orders',
        GET: (id: number) => `/procurement/purchase-orders/${id}`,
        UPDATE: (id: number) => `/procurement/purchase-orders/${id}`,
        DELETE: (id: number) => `/procurement/purchase-orders/${id}`,
        APPROVE: (id: number) => `/procurement/purchase-orders/${id}/approve`,
        REJECT: (id: number) => `/procurement/purchase-orders/${id}/reject`,
        RECEIVE: (id: number) => `/procurement/purchase-orders/${id}/receive`,
    },

    // ========================================================================
    // Corporate
    // ========================================================================
    CORPORATE: {
        COMPANIES: '/crm/companies',
        COMPANY: (id: number) => `/crm/companies/${id}`,
        AGENTS: '/crm/agents',
        AGENT: (id: number) => `/crm/agents/${id}`,
    },

    // ========================================================================
    // Banquets / Events
    // ========================================================================
    BANQUETS: {
        VENUES: '/banquets/venues',
        VENUE: (id: number) => `/banquets/venues/${id}`,
        BOOKINGS: '/banquets/bookings',
        BOOKING: (id: string) => `/banquets/bookings/${id}`,
        BOOKING_STATUS: (id: string) => `/banquets/bookings/${id}/status`,
    },

    // ========================================================================
    // CRM / Guests
    // ========================================================================
    GUESTS: {
        LIST: '/guests',
        CREATE: '/guests',
        GET: (id: string) => `/guests/${id}`,
        UPDATE: (id: string) => `/guests/${id}`,
        HISTORY: (id: string) => `/guests/${id}/history`,
    },

    // ========================================================================
    // Messages
    // ========================================================================
    MESSAGES: {
        SEND: '/messages',
        INBOX: '/messages/inbox',
        CONVERSATIONS: '/messages/conversations',
        READ: (id: string) => `/messages/${id}/read`,
        DELETE: (id: string) => `/messages/${id}`,
    },

    // ========================================================================
    // Operations
    // ========================================================================
    OPERATIONS: {
        FLOORS: '/ops/floors',
        FLOOR: (id: number) => `/ops/floors/${id}`,
        FACILITIES: '/operations/facilities',
        FACILITY: (id: number) => `/operations/facilities/${id}`,
        PARKING: '/operations/facilities/parking',
        PARKING_ASSIGNABLE: '/operations/facilities/parking/assignable-bookings',
        PARKING_SPOT: (id: number) => `/operations/facilities/parking/${id}`,
    },

    // ========================================================================
    // Night Audit
    // ========================================================================
    NIGHT_AUDIT: {
        TRIGGER: '/night-audit/trigger',
        HISTORY: '/night-audit/history',
        STATUS: '/night-audit/status',
    },
    // ========================================================================
    // HR & Payroll
    // ========================================================================
    HR: {
        PAYROLL_LIST: '/hr/payroll',
        PAYROLL_CREATE: '/hr/payroll',
        PAYROLL_PAY: (id: number) => `/hr/payroll/${id}/pay`,
    },
} as const;

export default ENDPOINTS;
