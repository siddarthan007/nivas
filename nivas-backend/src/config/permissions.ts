export const PERMISSIONS = {
    SYSTEM: {
        MANAGE_TENANTS: 'system:manage_tenants',
        VIEW_SAAS_ANALYTICS: 'system:view_analytics',
        MANAGE_SETTINGS: 'system:manage_settings',
    },

    SAAS_ADMIN: {
        MANAGE_LICENSES: 'saas:manage_licenses',
        MANAGE_SUBSCRIPTIONS: 'saas:manage_subscriptions',
        MANAGE_PACKAGES: 'saas:manage_packages',
        VIEW_PAYMENTS: 'saas:view_payments',
        RECORD_PAYMENTS: 'saas:record_payments',
    },

    USERS: {
        CREATE: 'users:create',
        READ: 'users:read',
        UPDATE: 'users:update',
        DELETE: 'users:delete',
        MANAGE_ROLES: 'users:manage_roles',
    },

    ROLES: {
        CREATE: 'roles:create',
        READ: 'roles:read',
        UPDATE: 'roles:update',
        DELETE: 'roles:delete',
    },

    ROOMS: {
        CREATE: 'rooms:create',
        READ: 'rooms:read',
        UPDATE: 'rooms:update',
        DELETE: 'rooms:delete',
        VIEW_STATUS: 'rooms:view_status',
        MANAGE_CLEANING: 'rooms:manage_cleaning',
        MANAGE_LAYOUT: 'rooms:manage_layout',
    },

    GUESTS: {
        CHECK_IN: 'guests:check_in',
        CHECK_OUT: 'guests:check_out',
        VIEW_DETAILS: 'guests:view_details',
        MANAGE_PROFILES: 'guests:manage_profiles',
    },

    ORDERS: {
        CREATE: 'orders:create',
        READ: 'orders:read',
        UPDATE_STATUS: 'orders:update_status',
        CANCEL: 'orders:cancel',
    },

    INVENTORY: {
        READ: 'inventory:read',
        UPDATE: 'inventory:update',
        REQUEST_STOCK: 'inventory:request_stock',
        MANAGE_PROCUREMENT: 'inventory:manage_procurement',
    },

    FINANCE: {
        VIEW_RECORDS: 'finance:view_records',
        RECORD_PAYMENT: 'finance:record_payment',
        GENERATE_INVOICE: 'finance:generate_invoice',
        VIEW_INVOICES: 'finance:view_invoices',

        VOID_INVOICE: 'finance:void_invoice',
        CREATE_CREDIT_NOTE: 'finance:create_credit_note',
    },

    COMMUNICATIONS: {
        SEND_MESSAGE: 'communications:send_message',
        READ_MESSAGES: 'communications:read_messages',
        BROADCAST: 'communications:broadcast',
    },

    ANALYTICS: {
        VIEW_FINANCIALS: 'analytics:view_financials',
        VIEW_OPERATIONS: 'analytics:view_operations',
        VIEW_STAFF_PERFORMANCE: 'analytics:view_staff_performance',
    },

    RESTAURANT: {
        MANAGE_TABLES: 'restaurant:manage_tables',
        VIEW_TABLES: 'restaurant:view_tables'
    },

    PARKING: {
        MANAGE: 'parking:manage',
        VIEW: 'parking:view'
    },

    SHIFTS: {
        START: 'shifts:start',
        END: 'shifts:end',
        VIEW: 'shifts:view',
        VIEW_ALL: 'shifts:view_all'
    },

    OPERATIONS: {
        RUN_NIGHT_AUDIT: 'operations:run_night_audit',
        VIEW_AUDIT_LOGS: 'operations:view_audit_logs',
        SETUP_FACILITIES: 'operations:setup_facilities'
    },

    HOUSEKEEPING: {
        VIEW: 'housekeeping:view',
        CREATE: 'housekeeping:create',
        UPDATE: 'housekeeping:update',
        ASSIGN: 'housekeeping:assign',
        VIEW_TASKS: 'housekeeping:view_tasks',
        UPDATE_STATUS: 'housekeeping:update_status',
    },

    MENU: {
        VIEW: 'menu:view',
        CREATE: 'menu:create',
        UPDATE: 'menu:update',
        DELETE: 'menu:delete',
    },

    STORAGE: {
        UPLOAD: 'storage:upload',
    },

    NOTIFICATIONS: {
        VIEW: 'notifications:view',
        MARK_READ: 'notifications:mark_read',
    },

    // SETTINGS merged below

    CRM: {
        VIEW_GUESTS: 'crm:view_guests',
        MANAGE_GUESTS: 'crm:manage_guests',
    },

    // Restored BOOKINGS
    BOOKINGS: {
        CREATE: 'bookings:create',
        READ: 'bookings:read',
        UPDATE: 'bookings:update',
        DELETE: 'bookings:delete',
    },


    BANQUETS: {
        VIEW: 'banquets:view',
        CREATE: 'banquets:create',
        UPDATE: 'banquets:update',
        DELETE: 'banquets:delete',
    },

    REPORTS: {
        VIEW_SALES: 'reports:view_sales',
        VIEW_PURCHASE: 'reports:view_purchase',
        EXPORT_ANNEX5: 'reports:export_annex5',
        VIEW_TAX_REPORTS: 'reports:view_tax_reports'
    },

    AUDIT_LOGS: {
        VIEW: 'audit_logs:view',
        EXPORT: 'audit_logs:export'
    },

    SETTINGS: {
        MANAGE_OUTLETS: 'settings:manage_outlets',
        MANAGE_GENERAL: 'settings:manage_general',
        MANAGE_BILLING: 'settings:manage_billing'
    }
} as const;

export const SYSTEM_ROLES = {
    SUPER_ADMIN: 'Super Admin',
    OWNER: 'Owner',
    MANAGER: 'Manager',
    FRONT_DESK: 'Front Desk',
    HOUSEKEEPING_SUPERVISOR: 'Housekeeping Supervisor',
    KITCHEN_MANAGER: 'Kitchen Manager',
    ACCOUNTANT: 'Accountant',
    WAITER: 'Waiter',
} as const;

type PermissionKeys = keyof typeof PERMISSIONS;
type SubKeys<K extends PermissionKeys> = keyof typeof PERMISSIONS[K];
export type PermissionType = typeof PERMISSIONS[PermissionKeys][SubKeys<PermissionKeys>];