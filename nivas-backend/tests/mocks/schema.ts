
const createTable = (tableName: string) => {
    return new Proxy({ name: tableName }, {
        get(target: any, prop: string) {
            if (prop === 'name') return target.name;
            // Return a column identifier
            return { table: target.name, name: prop };
        }
    });
};

export const mockedSchema = {
    // Core
    users: createTable("users"),
    roles: createTable("roles"),
    hotels: createTable("hotels"),
    floors: createTable("floors"),
    rooms: createTable("rooms"),

    // Operations
    bookings: createTable("bookings"),
    orders: createTable("orders"),
    orderItems: createTable("order_items"),
    payments: createTable("payments"),
    invoices: createTable("invoices"),
    creditNotes: createTable("credit_notes"),
    folioCharges: createTable("folio_charges"),
    nightAudits: createTable("night_audits"),

    // Inventory & F&B
    inventoryItems: createTable("inventory_items"),
    inventoryRequests: createTable("inventory_requests"),
    menuItems: createTable("menu_items"),
    purchaseOrders: createTable("purchase_orders"),
    purchaseOrderItems: createTable("purchase_order_items"),
    outlets: createTable("outlets"),
    restaurantTables: createTable("restaurant_tables"),
    kotPrinters: createTable("kot_printers"),

    // Services
    housekeepingTasks: createTable("housekeeping_tasks"),
    messages: createTable("messages"),
    notifications: createTable("notifications"),
    auditLogs: createTable("audit_logs"),
    guestProfiles: createTable("guest_profiles"),
    shifts: createTable("shifts"),
    staffAttendance: createTable("staff_attendance"),
    parkingSpaces: createTable("parking_spaces"),
    backgroundJobs: createTable("background_jobs"),

    // Business & Rules
    pricingRules: createTable("pricing_rules"),
    discountRules: createTable("discount_rules"),
    upsellRules: createTable("upsell_rules"),
    losDiscounts: createTable("los_discounts"),
    revenueRules: createTable("revenue_rules"),
    corporateAccounts: createTable("corporate_accounts"),
    travelAgents: createTable("travel_agents"),

    // Events
    banquets: createTable("banquets"),
    banquetBookings: createTable("banquet_bookings"),

    // SaaS & Tenants
    tenantFeatures: createTable("tenant_features"),
    notificationSettings: createTable("notification_settings"),
    exchangeRates: createTable("exchange_rates"),

    // Channel Manager
    channelManagerSettings: createTable("channel_manager_settings"),
    channelRateMappings: createTable("channel_rate_mappings"),
    channelSyncLogs: createTable("channel_sync_logs"),

    // Subscriptions
    subscriptionPackages: createTable("subscription_packages"),
    subscriptions: createTable("subscriptions"),
    subscriptionPayments: createTable("subscription_payments")
};

