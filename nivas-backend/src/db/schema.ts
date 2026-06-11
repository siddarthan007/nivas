import { pgTable, serial, text, boolean, timestamp, uuid, integer, pgEnum, json, date, decimal, foreignKey, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const userTypeEnum = pgEnum('user_type', [
    'SUPER_ADMIN',
    'HOTEL_STAFF',
    'GUEST'
]);

export const orderStatusEnum = pgEnum('order_status', [
    'PENDING',
    'CONFIRMED',
    'PREPARING',
    'READY',
    'SERVED',
    'CANCELLED'
]);

export const bookingStatusEnum = pgEnum('booking_status', [
    'PENDING',
    'CONFIRMED',
    'CHECKED_IN',
    'CHECKED_OUT',
    'CANCELLED'
]);

export const paymentMethodEnum = pgEnum('payment_method', [
    'CASH',
    'CARD',
    'ESEWA',
    'KHALTI',
    'CONNECT_IPS',
    'FONEPAY',
    'UPI', // legacy — retained for existing rows; not offered in the UI
    'BANK_TRANSFER',
    'OTHER'
]);

export const bookingSourceEnum = pgEnum('booking_source', [
    'WALK_IN',
    'PHONE',
    'WEBSITE',
    'OTA',
    'TRAVEL_AGENT',
    'CORPORATE'
]);

export const couponDiscountTypeEnum = pgEnum('coupon_discount_type', [
    'PERCENT',
    'FIXED'
]);

export const couponScopeEnum = pgEnum('coupon_scope', [
    'ALL',
    'ROOM',
    'FNB'
]);

export const marketingChannelEnum = pgEnum('marketing_channel', [
    'SMS',
    'EMAIL'
]);

export const cbmsStatusEnum = pgEnum('cbms_status', ['PENDING', 'SENT', 'EXISTS', 'FAILED']);

export const reviewSentimentEnum = pgEnum('review_sentiment', ['POSITIVE', 'NEUTRAL', 'NEGATIVE']);

// Guest reviews — internal (guest portal) + imported (Google/OTA). Sentiment +
// complaint tags are computed cheaply (lexicon, no LLM); replies can be AI-drafted.
export const reviews = pgTable('reviews', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    bookingId: uuid('booking_id'),
    guestName: text('guest_name'),
    rating: integer('rating'),                 // 1-5
    comment: text('comment'),
    source: text('source').default('INTERNAL'), // INTERNAL | GOOGLE | BOOKING_COM | TRIPADVISOR | OTHER
    sentiment: reviewSentimentEnum('sentiment').default('NEUTRAL'),
    sentimentScore: decimal('sentiment_score', { precision: 4, scale: 2 }),
    tags: json('tags').$type<string[]>().default([]),
    replyText: text('reply_text'),
    replyDraft: text('reply_draft'),
    repliedAt: timestamp('replied_at'),
    externalId: text('external_id'),           // dedupe imported reviews
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
    index('reviews_hotel_idx').on(table.hotelId),
    uniqueIndex('reviews_external_unique').on(table.hotelId, table.source, table.externalId),
]);

// IRD CBMS (Central Billing Monitoring System) push log — one row per invoice /
// credit note, unique on (hotel, docType, refId) so a doc is never pushed twice.
export const cbmsLogs = pgTable('cbms_logs', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    docType: text('doc_type').notNull(),   // 'BILL' | 'RETURN'
    refId: text('ref_id').notNull(),       // invoiceId | creditNoteId
    invoiceNumber: text('invoice_number'),
    status: cbmsStatusEnum('status').default('PENDING').notNull(),
    responseCode: integer('response_code'),
    attempts: integer('attempts').default(0).notNull(),
    lastError: text('last_error'),
    payload: json('payload'),
    sentAt: timestamp('sent_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
    uniqueIndex('cbms_doc_unique').on(table.hotelId, table.docType, table.refId),
    index('cbms_status_idx').on(table.status),
]);

// API keys for the public booking engine / partner integrations. The raw key
// is shown once; only a SHA-256 hash is stored.
export const apiKeys = pgTable('api_keys', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    name: text('name').notNull(),
    keyPrefix: text('key_prefix').notNull(),     // first chars, shown in UI
    keyHash: text('key_hash').notNull().unique(),
    scopes: json('scopes').$type<string[]>().default(['read']), // 'read' | 'book'
    isActive: boolean('is_active').default(true),
    lastUsedAt: timestamp('last_used_at'),
    createdById: uuid('created_by_id').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
    index('api_keys_hotel_idx').on(table.hotelId),
    index('api_keys_hash_idx').on(table.keyHash),
]);

// Catalog of extra/incidental charges (damages, EV charging, parking, laundry…)
// that staff add to a guest folio or a POS bill.
export const amenities = pgTable('amenities', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    name: text('name').notNull(),
    category: text('category').default('OTHER'), // PARKING | EV_CHARGING | DAMAGE | LAUNDRY | SPA | OTHER
    price: decimal('price', { precision: 10, scale: 2 }).notNull().default('0'),
    taxable: boolean('taxable').default(true),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
    index('amenities_hotel_idx').on(table.hotelId),
]);

export const outletTypeEnum = pgEnum('outlet_type', [
    'RESTAURANT',
    'BAR',
    'CAFE',
    'SPA',
    'LAUNDRY',
    'OTHER'
]);

export const licenseStatusEnum = pgEnum('license_status', [
    'ACTIVE',
    'PAUSED',
    'REVOKED',
    'TRIAL',
    'EXPIRED',
    'PENDING_PAYMENT'
]);

export const billingCycleEnum = pgEnum('billing_cycle', [
    'MONTHLY',
    'ANNUAL',
    '2_YEAR',
    '3_YEAR'
]);

export const hotels = pgTable('hotels', {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').unique().notNull(),

    logoUrl: text('logo_url'),
    primaryColor: text('primary_color').default('#1a365d'),
    secondaryColor: text('secondary_color').default('#2b6cb0'),

    address: text('address'),
    phone: text('phone'),
    email: text('email'),
    website: text('website'),
    latitude: text('latitude'),
    longitude: text('longitude'),

    panNumber: text('pan_number'),
    vatNumber: text('vat_number'),

    currency: text('currency').default('NPR'),
    timezone: text('timezone').default('Asia/Kathmandu'),
    dateFormat: text('date_format').default('YYYY-MM-DD'),
    fiscalYearStart: text('fiscal_year_start').default('Shrawan'), // Nepal fiscal year starts mid-July
    checkInTime: text('check_in_time').default('14:00'),
    checkOutTime: text('check_out_time').default('11:00'),

    serviceChargeRate: decimal('service_charge_rate', { precision: 5, scale: 4 }).default('0.10'),
    taxRate: decimal('tax_rate', { precision: 5, scale: 4 }).default('0.13'),

    invoicePrefix: text('invoice_prefix').default('INV'),
    invoiceFooterText: text('invoice_footer_text').default('Thank you for staying with us!'),
    invoiceTerms: text('invoice_terms'),

    maxUsers: integer('max_users').default(10),
    maxRooms: integer('max_rooms').default(50),

    isActive: boolean('is_active').default(true),
    licenseKey: text('license_key').unique(),
    licenseExpiresAt: timestamp('license_expires_at'),
    licenseStatus: licenseStatusEnum('license_status').default('TRIAL'),
    licenseGraceEndsAt: timestamp('license_grace_ends_at'),
    licensePausedAt: timestamp('license_paused_at'),

    planTier: text('plan_tier').default('STANDARD'),

    // Admin-configurable guest portal content (WiFi, welcome message, contacts, etc.)
    guestPortalConfig: json('guest_portal_config').default({}),
    // Enabled payment methods + gateway (Fonepay) config for POS/checkout.
    paymentConfig: json('payment_config').default({}),
    // Bill/receipt template options (header note, toggles, receipt footer, paper width).
    invoiceConfig: json('invoice_config').default({}),
    // Realtime push (Pusher) creds + PMS event-notification toggles.
    notificationConfig: json('notification_config').default({}),
    // IRD CBMS integration: { enabled, username, password, sellerPan?, isRealtime }.
    cbmsConfig: json('cbms_config').default({}),
    // AI engine: { enabled, apiKey (Gemini), model } — per-hotel BYO key.
    aiConfig: json('ai_config').default({}),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

export const saasPayments = pgTable('saas_payments', {
    id: uuid('id').defaultRandom().primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
    paymentMethod: paymentMethodEnum('payment_method').default('CASH'),
    reference: text('reference'), // Manual receipt / bank ref
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow()
}, (table) => [
    index('saas_payment_hotel_idx').on(table.hotelId)
]);

export const PERMISSIONS = [
    'MANAGE_USERS',
    'MANAGE_ROLES',
    'MANAGE_HOTEL_SETTINGS',
    'MANAGE_BOOKINGS',
    'MANAGE_ORDERS',
    'MANAGE_FINANCE',
    'MANAGE_INVENTORY',
    'MANAGE_MAINTENANCE',
    'VIEW_REPORTS',
    'FRONTDESK_OPERATIONS',
    'KITCHEN_OPERATIONS',
    'HOUSEKEEPING_OPERATIONS'
] as const;

export type Permission = typeof PERMISSIONS[number];

export const roles = pgTable('roles', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id),
    name: text('name').notNull(),
    level: integer('level').notNull(), // lower = higher authority (Owner=0, Manager=1...)
    permissions: json('permissions').$type<string[]>().default([]),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
}, (table) => [
    index('role_hotel_idx').on(table.hotelId),
    index('role_level_idx').on(table.level),
]);

export const backgroundJobs = pgTable('background_jobs', {
    id: uuid('id').defaultRandom().primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),

    type: text('type').notNull(),         // e.g., 'SEND_REVIEW_REQUEST'
    payload: json('payload'),             // Job arguments
    status: text('status').default('PENDING'), // PENDING, PROCESSING, COMPLETED, FAILED

    scheduledAt: timestamp('scheduled_at').defaultNow(), // When to run it
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),

    error: text('error'),
    attempts: integer('attempts').default(0)
}, (table) => [
    index('bg_job_hotel_idx').on(table.hotelId),
    index('bg_job_status_idx').on(table.status),
    index('bg_job_scheduled_idx').on(table.scheduledAt),
    index('bg_job_status_scheduled_idx').on(table.status, table.scheduledAt),
]);

export const users: any = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id),

    fullName: text('full_name').notNull(),
    email: text('email').unique().notNull(),
    phone: text('phone').unique().notNull(),

    passwordHash: text('password_hash'),
    pin: text('pin'),
    // Bumped to invalidate every existing JWT for this user (log out all devices).
    tokenVersion: integer('token_version').default(0).notNull(),

    userType: userTypeEnum('user_type').default('GUEST'),
    roleId: integer('role_id').references(() => roles.id),
    createdBy: uuid('created_by').references(() => (users as any).id),

    isActive: boolean('is_active').default(true),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
}, (table) => [
    index('user_hotel_idx').on(table.hotelId),
    index('user_email_idx').on(table.email),
    index('user_phone_idx').on(table.phone),
    index('user_role_idx').on(table.roleId),
]);

export const floors = pgTable('floors', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    number: integer('number').notNull(),
    name: text('name'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
}, (table) => [
    index('floors_hotel_id_idx').on(table.hotelId),
]);

/**
 * Room Types - Hotel-customizable room categories
 */
export const roomTypes = pgTable('room_types', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    name: text('name').notNull(),
    code: text('code').notNull(),
    description: text('description'),
    baseRate: decimal('base_rate', { precision: 10, scale: 2 }).default('0'),
    sortOrder: integer('sort_order').default(0),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
}, (table) => [
    index('room_type_hotel_idx').on(table.hotelId),
]);

export const rooms = pgTable('rooms', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    floorId: integer('floor_id').references(() => floors.id),
    floorNumber: integer('floor_number'),

    number: integer('number').notNull(),
    name: text('name'),
    type: text('type').default('STANDARD'),
    rate: decimal('rate', { precision: 10, scale: 2 }).default('0'),
    status: text('status').default('AVAILABLE'),

    currentGuestPin: text('current_guest_pin'),
    qrToken: text('qr_token').unique(),

    layoutProps: json('layout_props'),
    imageUrl: text('image_url'),

    capacity: integer('capacity').default(2),
    dndStatus: boolean('dnd_status').default(false),
    amenities: json('amenities').$type<string[]>().default([]),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
}, (table) => [
    index('room_hotel_idx').on(table.hotelId),
    index('room_floor_idx').on(table.floorId),
    index('room_number_idx').on(table.number),
    index('room_status_idx').on(table.status),
]);

export const bookings = pgTable('bookings', {
    id: uuid('id').defaultRandom().primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    roomId: integer('room_id').references(() => rooms.id).notNull(),

    guestName: text('guest_name').notNull(),
    guestPhone: text('guest_phone').notNull(),
    guestEmail: text('guest_email'),
    guestCount: integer('guest_count').default(1),

    checkIn: timestamp('check_in').notNull(),
    checkOut: timestamp('check_out').notNull(),

    status: bookingStatusEnum('status').default('PENDING'),
    totalAmount: decimal('total_amount', { precision: 10, scale: 2 }),
    advancePayment: decimal('advance_payment', { precision: 10, scale: 2 }).default('0'),
    creditBalance: decimal('credit_balance', { precision: 10, scale: 2 }).default('0'),
    isPaid: boolean('is_paid').default(false),

    source: bookingSourceEnum('source').default('WALK_IN'),

    guestId: uuid('guest_id').references(() => guests.id),
    // Shared by all rooms in a group / block booking (one logical reservation).
    groupRef: text('group_ref'),
    corporateAccountId: integer('corporate_account_id').references(() => corporateAccounts.id, { onDelete: 'set null' }),
    travelAgentId: integer('travel_agent_id').references(() => travelAgents.id, { onDelete: 'set null' }),

    createdById: uuid('created_by_id').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
}, (table) => [
    index('booking_hotel_idx').on(table.hotelId),
    index('booking_room_idx').on(table.roomId),
    index('booking_status_idx').on(table.status),
    index('booking_guest_phone_idx').on(table.guestPhone),
    index('booking_check_in_idx').on(table.checkIn),
    index('booking_check_out_idx').on(table.checkOut),
    index('booking_corporate_idx').on(table.corporateAccountId),
    index('booking_agent_idx').on(table.travelAgentId),
]);

export const orders = pgTable('orders', {
    id: uuid('id').defaultRandom().primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    roomId: integer('room_id').references(() => rooms.id),
    bookingId: uuid('booking_id').references(() => bookings.id),
    guestId: uuid('guest_id').references(() => guests.id, { onDelete: 'set null' }),
    corporateAccountId: integer('corporate_account_id').references(() => corporateAccounts.id, { onDelete: 'set null' }),
    restaurantTableId: integer('restaurant_table_id').references(() => restaurantTables.id, { onDelete: 'set null' }),
    outletId: integer('outlet_id').references(() => outlets.id, { onDelete: 'set null' }),

    orderNumber: text('order_number').unique().notNull(),
    customerName: text('customer_name'),

    status: orderStatusEnum('status').default('PENDING'),
    totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),

    subTotal: decimal('sub_total', { precision: 10, scale: 2 }),
    vatAmount: decimal('vat_amount', { precision: 10, scale: 2 }),
    serviceChargeAmount: decimal('service_charge_amount', { precision: 10, scale: 2 }),
    discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }).default('0'),
    couponId: integer('coupon_id').references(() => coupons.id),
    vatRate: decimal('vat_rate', { precision: 5, scale: 4 }),
    serviceChargeRate: decimal('service_charge_rate', { precision: 5, scale: 4 }),
    applyVat: boolean('apply_vat').default(false),
    applyServiceCharge: boolean('apply_service_charge').default(false),

    orderType: text('order_type').default('ROOM_SERVICE'),
    paymentStatus: text('payment_status').default('UNPAID'), // UNPAID | PAID | PARTIAL | ON_FOLIO

    createdById: uuid('created_by_id').references(() => users.id),
    assignedToId: uuid('assigned_to_id').references(() => users.id),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
}, (table) => [
    index('order_hotel_idx').on(table.hotelId),
    index('order_room_idx').on(table.roomId),
    index('order_status_idx').on(table.status),
    index('order_number_idx').on(table.orderNumber),
    index('order_created_by_idx').on(table.createdById),
    index('order_guest_idx').on(table.guestId),
    index('order_table_idx').on(table.restaurantTableId),
    index('order_outlet_idx').on(table.outletId),
]);

export const orderItems = pgTable('order_items', {
    id: serial('id').primaryKey(),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'cascade' }).notNull(),
    menuItemId: integer('menu_item_id').references(() => menuItems.id).notNull(),

    quantity: integer('quantity').notNull(),
    price: decimal('price', { precision: 10, scale: 2 }).notNull(),
    notes: text('notes'),

    createdAt: timestamp('created_at').defaultNow()
}, (table) => [
    index('order_items_order_id_idx').on(table.orderId),
    index('order_items_menu_item_id_idx').on(table.menuItemId),
]);

export const inventoryItems = pgTable('inventory_items', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    sku: text('sku').notNull().default(''),
    barcode: text('barcode'),
    name: text('name').notNull(),
    description: text('description'),
    category: text('category'),
    quantity: integer('quantity').default(0),
    unitCost: decimal('unit_cost', { precision: 10, scale: 2 }).default('0'),
    unit: text('unit').default('pcs'),
    lowStockThreshold: integer('low_stock_threshold').default(10),
    status: text('status').default('ACTIVE'), // ACTIVE, DISCONTINUED
    warehouseId: integer('warehouse_id').references(() => warehouses.id),
    supplierId: integer('supplier_id').references(() => vendors.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
    index('inventory_item_hotel_idx').on(table.hotelId),
    index('inventory_item_name_idx').on(table.name),
    index('inventory_item_sku_idx').on(table.sku),
    index('inventory_item_barcode_idx').on(table.barcode),
    index('inventory_item_status_idx').on(table.status),
    index('inventory_item_warehouse_idx').on(table.warehouseId),
]);

export const stockMovements = pgTable('stock_movements', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    itemId: integer('item_id').references(() => inventoryItems.id).notNull(),
    userId: uuid('user_id').references(() => users.id),

    type: text('type').notNull(), // IN, OUT, ADJUSTMENT, RETURN, PURCHASE
    quantity: integer('quantity').notNull(), // positive for IN, negative for OUT
    previousStock: integer('previous_stock').default(0),
    newStock: integer('new_stock').default(0),

    reason: text('reason'),
    reference: text('reference'), // PO number, order number, etc.
    notes: text('notes'),

    createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
    index('stock_mvmt_hotel_idx').on(table.hotelId),
    index('stock_mvmt_item_idx').on(table.itemId),
    index('stock_mvmt_type_idx').on(table.type),
    index('stock_mvmt_created_idx').on(table.createdAt),
]);

export const inventoryRequests = pgTable('inventory_requests', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    itemId: integer('item_id').references(() => inventoryItems.id).notNull(),
    requestedById: uuid('requested_by_id').references(() => users.id).notNull(),

    quantity: integer('quantity').notNull(),
    status: text('status').default('PENDING'),
    notes: text('notes'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
}, (table) => [
    index('inventory_req_hotel_idx').on(table.hotelId),
    index('inventory_req_status_idx').on(table.status),
    index('inventory_req_item_idx').on(table.itemId),
]);

export const menuItems = pgTable('menu_items', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    name: text('name').notNull(),
    description: text('description'),
    price: decimal('price', { precision: 10, scale: 2 }).notNull(),
    category: text('category'),
    categoryId: integer('category_id').references(() => menuCategories.id, { onDelete: 'set null' }),
    imageUrl: text('image_url'),
    isAvailable: boolean('is_available').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
    index('menu_item_hotel_idx').on(table.hotelId),
    index('menu_item_category_idx').on(table.category),
    index('menu_item_category_id_idx').on(table.categoryId),
]);

export const housekeepingTasks = pgTable('housekeeping_tasks', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    roomId: integer('room_id').references(() => rooms.id).notNull(),
    assignedToId: uuid('assigned_to_id').references(() => users.id),
    bookingId: uuid('booking_id').references(() => bookings.id, { onDelete: 'set null' }),

    taskType: text('task_type').default('CLEANING'),
    priority: text('priority').default('NORMAL'),
    status: text('status').default('PENDING'),
    notes: text('notes'),

    createdById: uuid('created_by_id').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    updatedAt: timestamp('updated_at').defaultNow()
}, (table) => [
    index('hk_task_hotel_idx').on(table.hotelId),
    index('hk_task_room_idx').on(table.roomId),
    index('hk_task_status_idx').on(table.status),
    index('hk_task_assigned_to_idx').on(table.assignedToId),
    index('hk_task_booking_idx').on(table.bookingId),
]);

export const payments = pgTable('payments', {
    id: uuid('id').defaultRandom().primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    bookingId: uuid('booking_id').references(() => bookings.id),
    orderId: uuid('order_id').references(() => orders.id),
    invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),

    amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
    paymentMethod: paymentMethodEnum('payment_method').notNull(),
    transactionId: text('transaction_id'),
    notes: text('notes'),

    recordedById: uuid('recorded_by_id').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow()
}, (table) => [
    index('payment_hotel_idx').on(table.hotelId),
    index('payment_booking_idx').on(table.bookingId),
    index('payment_order_idx').on(table.orderId),
    index('payment_invoice_idx').on(table.invoiceId),
]);

export const messages = pgTable('messages', {
    id: uuid('id').defaultRandom().primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),

    senderId: uuid('sender_id').references(() => users.id).notNull(),
    receiverId: uuid('receiver_id').references(() => users.id),
    roomId: integer('room_id').references(() => rooms.id),

    content: text('content').notNull(),
    messageType: text('message_type').default('TEXT'),
    isRead: boolean('is_read').default(false),

    createdAt: timestamp('created_at').defaultNow()
}, (table) => [
    index('message_hotel_idx').on(table.hotelId),
    index('message_sender_idx').on(table.senderId),
    index('message_receiver_idx').on(table.receiverId),
    index('message_room_idx').on(table.roomId),
]);

export const restaurantTables = pgTable('restaurant_tables', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    tableNumber: text('table_number').notNull(),
    capacity: integer('capacity').default(4),
    status: text('status').default('AVAILABLE'),
    location: text('location').default('MAIN_HALL'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    layoutProps: json('layout_props')
});

export const parkingSpaces = pgTable('parking_spaces', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    spaceNumber: text('space_number').notNull(),
    vehicleType: text('vehicle_type').default('CAR'),
    status: text('status').default('AVAILABLE'),
    assignedToRoomId: integer('assigned_to_room_id').references(() => rooms.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

export const auditLogs = pgTable('audit_logs', {
    id: uuid('id').defaultRandom().primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    userId: uuid('user_id').references(() => users.id),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id'),
    details: json('details'),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at').defaultNow()
}, (table) => [
    index('audit_hotel_idx').on(table.hotelId),
    index('audit_user_idx').on(table.userId),
    index('audit_entity_idx').on(table.entity),
]);


export const guestProfiles = pgTable('guest_profiles', {
    id: uuid('id').defaultRandom().primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    guestId: uuid('guest_id').references(() => guests.id, { onDelete: 'set null' }),
    fullName: text('full_name').notNull(),
    phone: text('phone').notNull(),
    email: text('email'),
    nationality: text('nationality'),
    preferences: json('preferences'),
    totalStays: integer('total_stays').default(0),
    totalSpend: decimal('total_spend', { precision: 12, scale: 2 }).default('0'),
    isVip: boolean('is_vip').default(false),
    tags: json('tags').$type<string[]>().default([]),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
}, (table) => [
    index('guest_profile_hotel_idx').on(table.hotelId),
    index('guest_profile_phone_idx').on(table.phone),
    index('guest_profile_email_idx').on(table.email),
    index('guest_profile_guest_idx').on(table.guestId),
]);

// Added facilities table
export const facilities = pgTable('facilities', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    name: text('name').notNull(),
    type: text('type').notNull(),
    location: text('location'),
    description: text('description'),
    status: text('status').default('OPEN'),
    openTime: text('open_time'),
    closeTime: text('close_time'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

export const purchaseRequests = pgTable('purchase_requests', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    itemId: integer('item_id').references(() => inventoryItems.id).notNull(),
    requesterId: uuid('requester_id').references(() => users.id).notNull(),
    quantity: integer('quantity').notNull(),
    reason: text('reason'),
    priority: text('priority').default('NORMAL'),
    status: text('status').default('PENDING'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Payments made TO a supplier/vendor (settles Accounts Payable from received POs).
export const vendorPayments = pgTable('vendor_payments', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    vendorId: integer('vendor_id').references(() => vendors.id).notNull(),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    paymentMethod: text('payment_method').default('CASH'),
    reference: text('reference'),
    notes: text('notes'),
    journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id),
    createdById: uuid('created_by_id').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => [index('vendor_payment_hotel_idx').on(table.hotelId), index('vendor_payment_vendor_idx').on(table.vendorId)]);

export const purchaseOrders = pgTable('purchase_orders', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    poNumber: text('po_number').notNull(),
    supplierName: text('supplier_name'),
    vendorId: integer('vendor_id').references(() => vendors.id),
    status: text('status').default('DRAFT'),
    totalCost: decimal('total_cost', { precision: 10, scale: 2 }).default('0'),
    notes: text('notes'),
    items: json('items'), // Added items column
    createdById: uuid('created_by_id').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
}, (table) => [
    index('po_hotel_idx').on(table.hotelId),
    index('po_number_idx').on(table.poNumber),
    index('po_status_idx').on(table.status),
    index('po_vendor_idx').on(table.vendorId),
]);

export const coupons = pgTable('coupons', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    code: text('code').notNull(),
    description: text('description'),
    discountType: couponDiscountTypeEnum('discount_type').notNull().default('PERCENT'),
    discountValue: decimal('discount_value', { precision: 10, scale: 2 }).notNull(),
    // Cap on the discount when type is PERCENT (0 = no cap).
    maxDiscount: decimal('max_discount', { precision: 10, scale: 2 }).default('0'),
    minOrderAmount: decimal('min_order_amount', { precision: 10, scale: 2 }).default('0'),
    scope: couponScopeEnum('scope').notNull().default('ALL'),
    usageLimit: integer('usage_limit').default(0), // 0 = unlimited
    usedCount: integer('used_count').default(0),
    validFrom: timestamp('valid_from'),
    validUntil: timestamp('valid_until'),
    isActive: boolean('is_active').default(true),
    createdById: uuid('created_by_id').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
    uniqueIndex('coupons_hotel_code_idx').on(table.hotelId, table.code),
    index('coupons_hotel_idx').on(table.hotelId),
]);

export const marketingTemplates = pgTable('marketing_templates', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    name: text('name').notNull(),
    channel: marketingChannelEnum('channel').notNull().default('SMS'),
    subject: text('subject'), // email only
    body: text('body').notNull(), // supports {{name}} placeholder
    createdById: uuid('created_by_id').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
    index('marketing_tpl_hotel_idx').on(table.hotelId),
]);

export const purchaseOrderItems = pgTable('purchase_order_items', {
    id: serial('id').primaryKey(),
    purchaseOrderId: integer('purchase_order_id').references(() => purchaseOrders.id, { onDelete: 'cascade' }).notNull(),
    itemId: integer('item_id').references(() => inventoryItems.id).notNull(),
    quantityOrdered: integer('quantity_ordered').notNull(),
    quantityReceived: integer('quantity_received').default(0),
    unitCost: decimal('unit_cost', { precision: 10, scale: 2 }).notNull()
});

export const shifts = pgTable('shifts', {
    id: uuid('id').defaultRandom().primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    userId: uuid('user_id').references(() => users.id).notNull(),

    startTime: timestamp('start_time').defaultNow().notNull(),
    endTime: timestamp('end_time'),

    startFloat: decimal('start_float', { precision: 10, scale: 2 }).default('0'),
    endCashCount: decimal('end_cash_count', { precision: 10, scale: 2 }),

    systemCashTotal: decimal('system_cash_total', { precision: 10, scale: 2 }),
    variance: decimal('variance', { precision: 10, scale: 2 }),

    status: text('status').default('OPEN'),
    notes: text('notes'),

    createdAt: timestamp('created_at').defaultNow()
});

export const folioCharges = pgTable('folio_charges', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    bookingId: uuid('booking_id').references(() => bookings.id).notNull(),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),

    date: date('date').notNull(),
    description: text('description').notNull(),
    amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
    type: text('type').default('ROOM_CHARGE'),

    createdAt: timestamp('created_at').defaultNow()
}, (table) => [
    index('folio_charges_hotel_id_idx').on(table.hotelId),
    index('folio_charges_booking_id_idx').on(table.bookingId),
    index('folio_charges_order_id_idx').on(table.orderId),
]);

export const nightAudits = pgTable('night_audits', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),

    auditDate: date('audit_date').notNull(),
    runAt: timestamp('run_at').defaultNow(),
    status: text('status').default('SUCCESS'),

    totalRoomRevenue: decimal('total_room_revenue', { precision: 10, scale: 2 }),
    totalFnbRevenue: decimal('total_fnb_revenue', { precision: 10, scale: 2 }),
    occupancyPercentage: decimal('occupancy_percentage', { precision: 5, scale: 2 }),

    notes: text('notes')
}, (table) => [
    index('night_audit_hotel_date_idx').on(table.hotelId, table.auditDate),
]);

export const invoices = pgTable('invoices', {
    id: uuid('id').defaultRandom().primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    bookingId: uuid('booking_id').references(() => bookings.id).notNull(),

    invoiceNumber: text('invoice_number').notNull(),
    sequenceNumber: integer('sequence_number').notNull(),
    fiscalYear: text('fiscal_year').notNull(),

    guestName: text('guest_name').notNull(),
    guestPan: text('guest_pan'),

    subTotal: decimal('sub_total', { precision: 10, scale: 2 }).notNull(),
    serviceCharge: decimal('service_charge', { precision: 10, scale: 2 }).default('0'),
    vatAmount: decimal('vat_amount', { precision: 10, scale: 2 }).default('0'),
    discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }).default('0'),
    roomRevenue: decimal('room_revenue', { precision: 10, scale: 2 }).default('0'),
    fbRevenue: decimal('fb_revenue', { precision: 10, scale: 2 }).default('0'),
    grandTotal: decimal('grand_total', { precision: 10, scale: 2 }).notNull(),

    paymentStatus: text('payment_status').default('PAID'),
    currency: text('currency').default('NPR'),

    isVoided: boolean('is_voided').default(false),
    printCount: integer('print_count').default(0),
    voidReason: text('void_reason'),
    voidedAt: timestamp('voided_at'),

    createdById: uuid('created_by_id').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow()
}, (table) => [
    index('invoice_hotel_idx').on(table.hotelId),
    index('invoice_number_idx').on(table.invoiceNumber),
    index('invoice_fiscal_year_idx').on(table.fiscalYear),
    index('invoice_booking_idx').on(table.bookingId),
]);

export const notifications = pgTable('notifications', {
    id: uuid('id').defaultRandom().primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),

    recipientId: uuid('recipient_id').references(() => users.id),
    targetRole: text('target_role'),

    type: text('type').notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),

    isRead: boolean('is_read').default(false),
    metadata: json('metadata'),

    createdAt: timestamp('created_at').defaultNow()
}, (table) => [
    index('notifications_hotel_id_idx').on(table.hotelId),
    index('notifications_recipient_id_idx').on(table.recipientId),
]);

export const creditNotes = pgTable('credit_notes', {
    id: uuid('id').defaultRandom().primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    originalInvoiceId: uuid('original_invoice_id').references(() => invoices.id).notNull(),

    creditNoteNumber: text('credit_note_number').notNull(),
    fiscalYear: text('fiscal_year').notNull(),
    sequenceNumber: integer('sequence_number').notNull(),

    reason: text('reason').notNull(),
    amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),

    createdById: uuid('created_by_id').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow()
}, (table) => [
    index('credit_notes_hotel_id_idx').on(table.hotelId),
]);

export const outlets = pgTable('outlets', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    name: text('name').notNull(),
    type: outletTypeEnum('type').default('RESTAURANT'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow()
});

export const staffAttendance = pgTable('staff_attendance', {
    id: uuid('id').defaultRandom().primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    userId: uuid('user_id').references(() => users.id).notNull(),

    clockIn: timestamp('clock_in').defaultNow().notNull(),
    clockOut: timestamp('clock_out'),

    date: date('date').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow()
}, (table) => [
    index('staff_attendance_hotel_id_idx').on(table.hotelId),
    index('staff_attendance_user_id_idx').on(table.userId),
]);

export const corporateAccounts = pgTable('corporate_accounts', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    companyName: text('company_name').notNull(),
    contactPerson: text('contact_person'),
    email: text('email'),
    phone: text('phone'),
    address: text('address'),
    panNumber: text('pan_number'),

    contractRate: decimal('contract_rate', { precision: 10, scale: 2 }),
    discountPercentage: decimal('discount_percentage', { precision: 5, scale: 2 }),
    creditLimit: decimal('credit_limit', { precision: 10, scale: 2 }),

    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow()
});

export const travelAgents = pgTable('travel_agents', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    name: text('name').notNull(),
    agencyName: text('agency_name'),
    email: text('email'),
    phone: text('phone'),

    commissionRate: decimal('commission_rate', { precision: 5, scale: 2 }).default('0.07'),

    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow()
});

/**
 * Corporate Ledger — tracks all bills assigned to corporate accounts
 */
export const corporateLedger = pgTable('corporate_ledger', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    corporateAccountId: integer('corporate_account_id').references(() => corporateAccounts.id, { onDelete: 'cascade' }).notNull(),

    entryType: text('entry_type').notNull(), // 'ROOM_BOOKING' | 'F_B_ORDER' | 'BANQUET' | 'PAYMENT' | 'ADJUSTMENT'
    referenceId: text('reference_id'), // bookingId, orderId, banquetBookingId, etc.
    referenceType: text('reference_type'), // 'booking' | 'order' | 'banquet_booking'

    description: text('description').notNull(),
    debit: decimal('debit', { precision: 12, scale: 2 }).default('0'),
    credit: decimal('credit', { precision: 12, scale: 2 }).default('0'),

    balance: decimal('balance', { precision: 12, scale: 2 }).notNull(),

    createdById: uuid('created_by_id').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow()
}, (table) => [
    index('ledger_hotel_idx').on(table.hotelId),
    index('ledger_corporate_idx').on(table.corporateAccountId),
    index('ledger_entry_type_idx').on(table.entryType),
    index('ledger_created_idx').on(table.createdAt)
]);

export const restaurantTablesRelations = relations(restaurantTables, ({ one, many }) => ({
    hotel: one(hotels, {
        fields: [restaurantTables.hotelId],
        references: [hotels.id]
    }),
    orders: many(orders),
}));



export const parkingSpacesRelations = relations(parkingSpaces, ({ one }) => ({
    hotel: one(hotels, {
        fields: [parkingSpaces.hotelId],
        references: [hotels.id]
    }),
    assignedRoom: one(rooms, {
        fields: [parkingSpaces.assignedToRoomId],
        references: [rooms.id]
    })
}));

export const rolesRelations = relations(roles, ({ many }) => ({
    users: many(users),
}));

export const hotelsRelations = relations(hotels, ({ many }) => ({
    users: many(users),
    floors: many(floors),
    rooms: many(rooms),
    bookings: many(bookings),
    orders: many(orders),
    inventoryItems: many(inventoryItems),
    menuItems: many(menuItems)
}));

export const usersRelations = relations(users, ({ one }) => ({
    hotel: one(hotels, {
        fields: [users.hotelId],
        references: [hotels.id]
    }),
    role: one(roles, {
        fields: [users.roleId],
        references: [roles.id]
    })
}));

export const roomTypesRelations = relations(roomTypes, ({ one }) => ({
    hotel: one(hotels, {
        fields: [roomTypes.hotelId],
        references: [hotels.id]
    })
}));

export const roomsRelations = relations(rooms, ({ one, many }) => ({
    hotel: one(hotels, {
        fields: [rooms.hotelId],
        references: [hotels.id]
    }),
    floor: one(floors, {
        fields: [rooms.floorId],
        references: [floors.id]
    }),
    bookings: many(bookings),
    orders: many(orders),
    housekeepingTasks: many(housekeepingTasks)
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
    room: one(rooms, {
        fields: [bookings.roomId],
        references: [rooms.id]
    }),
    guest: one(guests, { fields: [bookings.guestId], references: [guests.id] }),
    corporateAccount: one(corporateAccounts, { fields: [bookings.corporateAccountId], references: [corporateAccounts.id] }),
    travelAgent: one(travelAgents, { fields: [bookings.travelAgentId], references: [travelAgents.id] }),
    orders: many(orders),
    payment: one(payments, { fields: [bookings.id], references: [payments.bookingId] }),
    createdBy: one(users, {
        fields: [bookings.createdById],
        references: [users.id]
    }),
    payments: many(payments)
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
    hotel: one(hotels, {
        fields: [orders.hotelId],
        references: [hotels.id]
    }),
    room: one(rooms, {
        fields: [orders.roomId],
        references: [rooms.id]
    }),
    booking: one(bookings, {
        fields: [orders.bookingId],
        references: [bookings.id]
    }),
    corporateAccount: one(corporateAccounts, {
        fields: [orders.corporateAccountId],
        references: [corporateAccounts.id]
    }),
    createdBy: one(users, {
        fields: [orders.createdById],
        references: [users.id]
    }),
    assignedTo: one(users, {
        fields: [orders.assignedToId],
        references: [users.id]
    }),
    guest: one(guests, { fields: [orders.guestId], references: [guests.id] }),
    restaurantTable: one(restaurantTables, { fields: [orders.restaurantTableId], references: [restaurantTables.id] }),
    outlet: one(outlets, { fields: [orders.outletId], references: [outlets.id] }),
    items: many(orderItems),
    payments: many(payments)
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
    order: one(orders, {
        fields: [orderItems.orderId],
        references: [orders.id]
    }),
    menuItem: one(menuItems, {
        fields: [orderItems.menuItemId],
        references: [menuItems.id]
    })
}));

export const inventoryItemsRelations = relations(inventoryItems, ({ one, many }) => ({
    hotel: one(hotels, {
        fields: [inventoryItems.hotelId],
        references: [hotels.id]
    }),
    warehouse: one(warehouses, {
        fields: [inventoryItems.warehouseId],
        references: [warehouses.id]
    }),
    supplier: one(vendors, {
        fields: [inventoryItems.supplierId],
        references: [vendors.id]
    }),
    movements: many(stockMovements),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
    hotel: one(hotels, { fields: [stockMovements.hotelId], references: [hotels.id] }),
    item: one(inventoryItems, { fields: [stockMovements.itemId], references: [inventoryItems.id] }),
    user: one(users, { fields: [stockMovements.userId], references: [users.id] }),
}));

export const inventoryRequestsRelations = relations(inventoryRequests, ({ one }) => ({
    hotel: one(hotels, {
        fields: [inventoryRequests.hotelId],
        references: [hotels.id]
    }),
    item: one(inventoryItems, {
        fields: [inventoryRequests.itemId],
        references: [inventoryItems.id]
    }),
    requestedBy: one(users, {
        fields: [inventoryRequests.requestedById],
        references: [users.id]
    })
}));

export const housekeepingTasksRelations = relations(housekeepingTasks, ({ one }) => ({
    hotel: one(hotels, {
        fields: [housekeepingTasks.hotelId],
        references: [hotels.id]
    }),
    room: one(rooms, {
        fields: [housekeepingTasks.roomId],
        references: [rooms.id]
    }),
    assignedTo: one(users, {
        fields: [housekeepingTasks.assignedToId],
        references: [users.id]
    }),
    createdBy: one(users, {
        fields: [housekeepingTasks.createdById],
        references: [users.id]
    }),
    booking: one(bookings, { fields: [housekeepingTasks.bookingId], references: [bookings.id] })
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
    hotel: one(hotels, {
        fields: [payments.hotelId],
        references: [hotels.id]
    }),
    booking: one(bookings, {
        fields: [payments.bookingId],
        references: [bookings.id]
    }),
    order: one(orders, {
        fields: [payments.orderId],
        references: [orders.id]
    }),
    invoice: one(invoices, { fields: [payments.invoiceId], references: [invoices.id] }),
    recordedBy: one(users, {
        fields: [payments.recordedById],
        references: [users.id]
    })
}));

export const messagesRelations = relations(messages, ({ one }) => ({
    hotel: one(hotels, {
        fields: [messages.hotelId],
        references: [hotels.id]
    }),
    sender: one(users, {
        fields: [messages.senderId],
        references: [users.id]
    }),
    receiver: one(users, {
        fields: [messages.receiverId],
        references: [users.id]
    }),
    room: one(rooms, {
        fields: [messages.roomId],
        references: [rooms.id]
    })
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
    hotel: one(hotels, { fields: [auditLogs.hotelId], references: [hotels.id] }),
    user: one(users, { fields: [auditLogs.userId], references: [users.id] })
}));

export const guestProfilesRelations = relations(guestProfiles, ({ one }) => ({
    hotel: one(hotels, { fields: [guestProfiles.hotelId], references: [hotels.id] }),
    guest: one(guests, { fields: [guestProfiles.guestId], references: [guests.id] })
}));



export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
    hotel: one(hotels, { fields: [purchaseOrders.hotelId], references: [hotels.id] }),
    items: many(purchaseOrderItems),
    vendor: one(vendors, { fields: [purchaseOrders.vendorId], references: [vendors.id] }),
    createdBy: one(users, { fields: [purchaseOrders.createdById], references: [users.id] })
}));

export const purchaseOrderItemsRelations = relations(purchaseOrderItems, ({ one }) => ({
    po: one(purchaseOrders, { fields: [purchaseOrderItems.purchaseOrderId], references: [purchaseOrders.id] }),
    item: one(inventoryItems, { fields: [purchaseOrderItems.itemId], references: [inventoryItems.id] })
}));

export const floorsRelations = relations(floors, ({ one, many }) => ({
    hotel: one(hotels, { fields: [floors.hotelId], references: [hotels.id] }),
    rooms: many(rooms)
}));

export const shiftsRelations = relations(shifts, ({ one }) => ({
    user: one(users, {
        fields: [shifts.userId],
        references: [users.id]
    }),
    hotel: one(hotels, {
        fields: [shifts.hotelId],
        references: [hotels.id]
    })
}));

export const folioChargesRelations = relations(folioCharges, ({ one }) => ({
    booking: one(bookings, {
        fields: [folioCharges.bookingId],
        references: [bookings.id]
    }),
    order: one(orders, { fields: [folioCharges.orderId], references: [orders.id] })
}));

export const backgroundJobsRelations = relations(backgroundJobs, ({ one }) => ({
    hotel: one(hotels, { fields: [backgroundJobs.hotelId], references: [hotels.id] })
}));

export const nightAuditsRelations = relations(nightAudits, ({ one }) => ({
    hotel: one(hotels, {
        fields: [nightAudits.hotelId],
        references: [hotels.id]
    })
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
    booking: one(bookings, {
        fields: [invoices.bookingId],
        references: [bookings.id]
    }),
    hotel: one(hotels, {
        fields: [invoices.hotelId],
        references: [hotels.id]
    }),
    creditNotes: many(creditNotes),
    createdBy: one(users, {
        fields: [invoices.createdById],
        references: [users.id]
    })
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
    hotel: one(hotels, {
        fields: [notifications.hotelId],
        references: [hotels.id]
    }),
    recipient: one(users, {
        fields: [notifications.recipientId],
        references: [users.id]
    })
}));

export const creditNotesRelations = relations(creditNotes, ({ one }) => ({
    hotel: one(hotels, { fields: [creditNotes.hotelId], references: [hotels.id] }),
    originalInvoice: one(invoices, { fields: [creditNotes.originalInvoiceId], references: [invoices.id] }),
    createdBy: one(users, { fields: [creditNotes.createdById], references: [users.id] })
}));

export const outletsRelations = relations(outlets, ({ one }) => ({
    hotel: one(hotels, { fields: [outlets.hotelId], references: [hotels.id] })
}));

export const corporateAccountsRelations = relations(corporateAccounts, ({ one, many }) => ({
    hotel: one(hotels, { fields: [corporateAccounts.hotelId], references: [hotels.id] }),
    bookings: many(bookings),
    ledgerEntries: many(corporateLedger)
}));

export const corporateLedgerRelations = relations(corporateLedger, ({ one }) => ({
    hotel: one(hotels, { fields: [corporateLedger.hotelId], references: [hotels.id] }),
    corporateAccount: one(corporateAccounts, { fields: [corporateLedger.corporateAccountId], references: [corporateAccounts.id] }),
    createdBy: one(users, { fields: [corporateLedger.createdById], references: [users.id] })
}));

export const travelAgentsRelations = relations(travelAgents, ({ one, many }) => ({
    hotel: one(hotels, { fields: [travelAgents.hotelId], references: [hotels.id] }),
    bookings: many(bookings)
}));

export const kotPrinters = pgTable('kot_printers', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    outletId: integer('outlet_id').references(() => outlets.id),

    name: text('name').notNull(),
    printerType: text('printer_type').default('THERMAL'), // 'THERMAL' | 'DOT_MATRIX' | 'NETWORK'
    ipAddress: text('ip_address'),
    port: integer('port').default(9100),

    categories: json('categories').$type<string[]>(),
    station: text('station'),

    isDefault: boolean('is_default').default(false),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow()
});

export const upsellRules = pgTable('upsell_rules', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),

    name: text('name').notNull(),
    triggerType: text('trigger_type').notNull(),

    fromRoomType: text('from_room_type'),
    toRoomType: text('to_room_type'),
    upgradePrice: decimal('upgrade_price', { precision: 10, scale: 2 }),
    upgradePercentage: decimal('upgrade_percentage', { precision: 5, scale: 2 }),

    serviceType: text('service_type'),
    servicePrice: decimal('service_price', { precision: 10, scale: 2 }),

    displayMessage: text('display_message'),
    priority: integer('priority').default(0),

    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow()
});

export const banquets = pgTable('banquets', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),

    name: text('name').notNull(),
    capacity: integer('capacity').notNull(),
    area: text('area'),

    amenities: json('amenities').$type<string[]>(),

    baseRateHalf: decimal('base_rate_half', { precision: 10, scale: 2 }),
    baseRateFull: decimal('base_rate_full', { precision: 10, scale: 2 }),

    imageUrls: json('image_urls').$type<string[]>(),

    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow()
});

export const banquetBookings = pgTable('banquet_bookings', {
    id: uuid('id').defaultRandom().primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    banquetId: integer('banquet_id').references(() => banquets.id).notNull(),
    guestId: uuid('guest_id').references(() => guests.id, { onDelete: 'set null' }),
    corporateAccountId: integer('corporate_account_id').references(() => corporateAccounts.id, { onDelete: 'set null' }),
    invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),

    eventName: text('event_name').notNull(),
    eventType: text('event_type'),

    organizerName: text('organizer_name').notNull(),
    organizerPhone: text('organizer_phone').notNull(),
    organizerEmail: text('organizer_email'),

    eventDate: date('event_date').notNull(),
    endDate: date('end_date'),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),

    expectedGuests: integer('expected_guests').notNull(),
    setupType: text('setup_type'),

    cateringRequired: boolean('catering_required').default(false),
    cateringPackage: text('catering_package'),
    cateringPax: integer('catering_pax'),

    decorationRequired: boolean('decoration_required').default(false),
    decorationNotes: text('decoration_notes'),

    avEquipment: json('av_equipment').$type<string[]>(),
    specialRequirements: text('special_requirements'),

    totalAmount: decimal('total_amount', { precision: 10, scale: 2 }),
    advanceAmount: decimal('advance_amount', { precision: 10, scale: 2 }),

    status: text('status').default('PENDING'),

    createdById: uuid('created_by_id').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

export const kotPrintersRelations = relations(kotPrinters, ({ one }) => ({
    hotel: one(hotels, { fields: [kotPrinters.hotelId], references: [hotels.id] }),
    outlet: one(outlets, { fields: [kotPrinters.outletId], references: [outlets.id] })
}));

export const upsellRulesRelations = relations(upsellRules, ({ one }) => ({
    hotel: one(hotels, { fields: [upsellRules.hotelId], references: [hotels.id] })
}));

export const banquetsRelations = relations(banquets, ({ one, many }) => ({
    hotel: one(hotels, { fields: [banquets.hotelId], references: [hotels.id] }),
    bookings: many(banquetBookings)
}));

export const banquetBookingsRelations = relations(banquetBookings, ({ one }) => ({
    hotel: one(hotels, { fields: [banquetBookings.hotelId], references: [hotels.id] }),
    banquet: one(banquets, { fields: [banquetBookings.banquetId], references: [banquets.id] }),
    guest: one(guests, { fields: [banquetBookings.guestId], references: [guests.id] }),
    corporateAccount: one(corporateAccounts, { fields: [banquetBookings.corporateAccountId], references: [corporateAccounts.id] }),
    invoice: one(invoices, { fields: [banquetBookings.invoiceId], references: [invoices.id] }),
    createdBy: one(users, { fields: [banquetBookings.createdById], references: [users.id] })
}));

// ============================================
// SAAS & TENANT FEATURE MODULES
// ============================================

/**
 * Tenant Feature Toggles - Per-hotel feature opt-in
 */
export const tenantFeatures = pgTable('tenant_features', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull().unique(),

    // Notification Channels
    enableSmsNotifications: boolean('enable_sms_notifications').default(false),
    enableWhatsappNotifications: boolean('enable_whatsapp_notifications').default(false),
    enableEmailNotifications: boolean('enable_email_notifications').default(true),

    // Module Standalone Flags
    enableHotel: boolean('enable_hotel').default(true),
    enableFoodAndBeverage: boolean('enable_food_and_beverage').default(true),

    // Advanced Features
    enableBanquets: boolean('enable_banquets').default(false),
    enablePosIntegration: boolean('enable_pos_integration').default(false),
    enableInventory: boolean('enable_inventory').default(true),
    enableHousekeeping: boolean('enable_housekeeping').default(true),
    enableGuestPortal: boolean('enable_guest_portal').default(false),
    // Fonepay (Nepal QR gateway) — optional, plan-gated.
    enableFonepay: boolean('enable_fonepay').default(false),
    // IRD CBMS real-time billing sync — plan-gated (only specific plans/hotels).
    enableCbms: boolean('enable_cbms').default(false),
    // AI features (NL analytics, concierge) — plan-gated.
    enableAi: boolean('enable_ai').default(false),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

/**
 * Notification Settings - Per-hotel notification config
 */
export const notificationSettings = pgTable('notification_settings', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull().unique(),

    // Email Settings (SMTP)
    smtpHost: text('smtp_host'),
    smtpPort: integer('smtp_port').default(587),
    smtpUser: text('smtp_user'),
    smtpPassword: text('smtp_password'),
    smtpFromEmail: text('smtp_from_email'),
    smtpFromName: text('smtp_from_name'),

    // SMS Settings (Sparrow SMS / Aakash SMS)
    smsProvider: text('sms_provider'), // 'SPARROW' | 'AAKASH' | 'TWILIO'
    smsApiKey: text('sms_api_key'),
    smsApiSecret: text('sms_api_secret'),
    smsSenderId: text('sms_sender_id'),

    // WhatsApp Settings (Meta Business API / Twilio)
    whatsappProvider: text('whatsapp_provider'), // 'META' | 'TWILIO' | 'WATI'
    whatsappApiKey: text('whatsapp_api_key'),
    whatsappPhoneNumberId: text('whatsapp_phone_number_id'),
    whatsappBusinessId: text('whatsapp_business_id'),

    // Notification Templates
    bookingConfirmationTemplate: text('booking_confirmation_template'),
    checkInReminderTemplate: text('check_in_reminder_template'),
    paymentReceiptTemplate: text('payment_receipt_template'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

/**
 * Platform-wide SMS / Email gateway — the SHARED provider credentials used by
 * every tenant (managed by the SaaS operator in super-admin). A hotel's own
 * notificationSettings, if set, override these per-field. Singleton (id = 1).
 */
export const platformSettings = pgTable('platform_settings', {
    id: integer('id').primaryKey().default(1),
    smtpHost: text('smtp_host'),
    smtpPort: integer('smtp_port').default(587),
    smtpUser: text('smtp_user'),
    smtpPassword: text('smtp_password'),
    smtpFromEmail: text('smtp_from_email'),
    smtpFromName: text('smtp_from_name'),
    smsProvider: text('sms_provider'),
    smsApiKey: text('sms_api_key'),
    smsApiSecret: text('sms_api_secret'),
    smsSenderId: text('sms_sender_id'),
    // DB backup schedule: { autoEnabled, frequency: 'DAILY'|'WEEKLY', lastRunAt }.
    backupConfig: json('backup_config').default({}),
    // Support contacts shown to hotels: { email, phone, whatsapp, hours }.
    supportConfig: json('support_config').default({}),
    updatedAt: timestamp('updated_at').defaultNow(),
});


// Relations for new tables
export const tenantFeaturesRelations = relations(tenantFeatures, ({ one }) => ({
    hotel: one(hotels, { fields: [tenantFeatures.hotelId], references: [hotels.id] })
}));

export const notificationSettingsRelations = relations(notificationSettings, ({ one }) => ({
    hotel: one(hotels, { fields: [notificationSettings.hotelId], references: [hotels.id] })
}));

// ============================================
// MENU CATEGORIES
// ============================================

export const menuCategories = pgTable('menu_categories', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    name: text('name').notNull(),
    description: text('description'),
    sortOrder: integer('sort_order').default(0),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
}, (table) => [
    index('menu_cat_hotel_idx').on(table.hotelId),
]);

export const menuCategoriesRelations = relations(menuCategories, ({ one }) => ({
    hotel: one(hotels, { fields: [menuCategories.hotelId], references: [hotels.id] })
}));

export const menuItemsRelations = relations(menuItems, ({ one }) => ({
    hotel: one(hotels, { fields: [menuItems.hotelId], references: [hotels.id] }),
    menuCategory: one(menuCategories, { fields: [menuItems.categoryId], references: [menuCategories.id] }),
}));

// ============================================
// GUEST MANAGEMENT
// ============================================

export const customerTypeEnum = pgEnum('customer_type', ['HOTEL_GUEST', 'RESTAURANT_CUSTOMER', 'BOTH']);

export const guests = pgTable('guests', {
    id: uuid('id').defaultRandom().primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),

    // Core identity
    firstName: text('first_name').default(''),
    lastName: text('last_name').default(''),
    fullName: text('full_name').notNull(),
    uniqueId: text('unique_id').default(''),

    // Contact
    phone: text('phone'),
    email: text('email'),

    // Personal details
    fatherName: text('father_name'),
    dob: date('dob'),
    occupation: text('occupation'),
    nationality: text('nationality'),

    // Location
    address: text('address'),
    city: text('city'),
    country: text('country'),

    // Identity docs
    idType: text('id_type'),
    idNumber: text('id_number'),
    panNumber: text('pan_number'),
    vatNumber: text('vat_number'),

    // Financial
    openingDueAmount: decimal('opening_due_amount', { precision: 10, scale: 2 }).default('0'),

    // Media
    photoUrl: text('photo_url'),
    signatureUrl: text('signature_url'),

    // Classification
    customerType: customerTypeEnum('customer_type').default('HOTEL_GUEST'),

    notes: text('notes'),

    isVip: boolean('is_vip').default(false),
    isBanned: boolean('is_banned').default(false),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
}, (table) => [
    index('guest_hotel_idx').on(table.hotelId),
    index('guest_phone_idx').on(table.phone),
    index('guest_name_idx').on(table.fullName),
    index('guest_unique_id_idx').on(table.uniqueId),
    index('guest_customer_type_idx').on(table.customerType),
]);

export const guestsRelations = relations(guests, ({ one, many }) => ({
    hotel: one(hotels, { fields: [guests.hotelId], references: [hotels.id] }),
    bookings: many(bookings),
    orders: many(orders),
}));

// ============================================
// SAAS SUBSCRIPTION & LICENSE MANAGEMENT
// ============================================

/**
 * Subscription Packages - Define available SaaS plans
 */
export const subscriptionPackages = pgTable('subscription_packages', {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    code: text('code').unique().notNull(),
    description: text('description'),

    monthlyPrice: decimal('monthly_price', { precision: 10, scale: 2 }).notNull(),
    annualPrice: decimal('annual_price', { precision: 10, scale: 2 }),

    maxRooms: integer('max_rooms'),
    maxUsers: integer('max_users'),

    features: json('features').$type<string[]>().default([]),
    modules: json('modules').$type<string[]>().default([]),
    allowedRoles: json('allowed_roles').$type<string[]>().default([]),

    trialDays: integer('trial_days').default(14),
    isActive: boolean('is_active').default(true),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

/**
 * Subscriptions - Track hotel subscriptions
 */
export const subscriptions = pgTable('subscriptions', {
    id: uuid('id').defaultRandom().primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    packageId: integer('package_id').references(() => subscriptionPackages.id).notNull(),

    status: licenseStatusEnum('status').default('TRIAL'),
    billingCycle: billingCycleEnum('billing_cycle').default('MONTHLY'),

    startDate: timestamp('start_date').defaultNow().notNull(),
    currentPeriodStart: timestamp('current_period_start'),
    currentPeriodEnd: timestamp('current_period_end'),

    trialEndsAt: timestamp('trial_ends_at'),

    cancelledAt: timestamp('cancelled_at'),
    cancellationReason: text('cancellation_reason'),

    pausedAt: timestamp('paused_at'),
    pauseReason: text('pause_reason'),

    revokedAt: timestamp('revoked_at'),
    revocationReason: text('revocation_reason'),
    revokedById: uuid('revoked_by_id').references(() => users.id),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

/**
 * Subscription Payments - Track SaaS payments
 */
export const subscriptionPayments = pgTable('subscription_payments', {
    id: uuid('id').defaultRandom().primaryKey(),
    subscriptionId: uuid('subscription_id').references(() => subscriptions.id).notNull(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),

    amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
    currency: text('currency').default('NPR'),

    paymentMethod: text('payment_method'),
    transactionId: text('transaction_id'),

    invoiceNumber: text('invoice_number'),

    periodStart: timestamp('period_start'),
    periodEnd: timestamp('period_end'),

    status: text('status').default('PENDING'),

    notes: text('notes'),
    recordedById: uuid('recorded_by_id').references(() => users.id),

    createdAt: timestamp('created_at').defaultNow()
});

// Subscription Relations
export const subscriptionPackagesRelations = relations(subscriptionPackages, ({ many }) => ({
    subscriptions: many(subscriptions)
}));

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
    hotel: one(hotels, { fields: [subscriptions.hotelId], references: [hotels.id] }),
    package: one(subscriptionPackages, { fields: [subscriptions.packageId], references: [subscriptionPackages.id] }),
    revokedBy: one(users, { fields: [subscriptions.revokedById], references: [users.id] }),
    payments: many(subscriptionPayments)
}));

export const subscriptionPaymentsRelations = relations(subscriptionPayments, ({ one }) => ({
    subscription: one(subscriptions, { fields: [subscriptionPayments.subscriptionId], references: [subscriptions.id] }),
    hotel: one(hotels, { fields: [subscriptionPayments.hotelId], references: [hotels.id] }),
    recordedBy: one(users, { fields: [subscriptionPayments.recordedById], references: [users.id] })
}));

export const staffAttendanceRelations = relations(staffAttendance, ({ one }) => ({
    user: one(users, { fields: [staffAttendance.userId], references: [users.id] }),
    hotel: one(hotels, { fields: [staffAttendance.hotelId], references: [hotels.id] })
}));

// ============================================
// GENERAL LEDGER (GL) & ACCOUNTING
// ============================================

export const accountTypeEnum = pgEnum('account_type', [
    'ASSET',
    'LIABILITY',
    'EQUITY',
    'REVENUE',
    'EXPENSE'
]);

export const accounts = pgTable('accounts', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    
    code: text('code').notNull(),
    name: text('name').notNull(),
    type: accountTypeEnum('type').notNull(),
    
    parentId: integer('parent_id'), // self-referencing for hierarchical CoA
    isControlAccount: boolean('is_control_account').default(false),
    
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
}, (table) => [
    index('account_hotel_idx').on(table.hotelId),
    index('account_code_idx').on(table.code),
]);

export const journalEntries = pgTable('journal_entries', {
    id: uuid('id').defaultRandom().primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    
    date: date('date').notNull(),
    description: text('description').notNull(),
    reference: text('reference'), // e.g. Invoice ID or PO number
    
    createdById: uuid('created_by_id').references(() => users.id),
    status: text('status').default('POSTED'), // DRAFT, POSTED, REVERSED
    reversedById: uuid('reversed_by_id').references(() => users.id),
    
    createdAt: timestamp('created_at').defaultNow()
}, (table) => [
    index('je_hotel_idx').on(table.hotelId),
    index('je_date_idx').on(table.date),
]);

export const journalLines = pgTable('journal_lines', {
    id: uuid('id').defaultRandom().primaryKey(),
    journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id, { onDelete: 'cascade' }).notNull(),
    accountId: integer('account_id').references(() => accounts.id).notNull(),
    
    debit: decimal('debit', { precision: 14, scale: 2 }).default('0').notNull(),
    credit: decimal('credit', { precision: 14, scale: 2 }).default('0').notNull(),
    
    description: text('description')
}, (table) => [
    index('jl_je_idx').on(table.journalEntryId),
    index('jl_account_idx').on(table.accountId),
]);

export const accountsRelations = relations(accounts, ({ one, many }) => ({
    hotel: one(hotels, { fields: [accounts.hotelId], references: [hotels.id] }),
    lines: many(journalLines),
}));

export const journalEntriesRelations = relations(journalEntries, ({ one, many }) => ({
    hotel: one(hotels, { fields: [journalEntries.hotelId], references: [hotels.id] }),
    createdBy: one(users, { fields: [journalEntries.createdById], references: [users.id] }),
    reversedBy: one(users, { fields: [journalEntries.reversedById], references: [users.id] }),
    lines: many(journalLines),
}));

export const journalLinesRelations = relations(journalLines, ({ one }) => ({
    journalEntry: one(journalEntries, { fields: [journalLines.journalEntryId], references: [journalEntries.id] }),
    account: one(accounts, { fields: [journalLines.accountId], references: [accounts.id] }),
}));

export const taxRates = pgTable('tax_rates', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    
    name: text('name').notNull(),
    rate: decimal('rate', { precision: 5, scale: 4 }).notNull(), // e.g. 0.13 for 13%
    isDefault: boolean('is_default').default(false),
    
    accountId: integer('account_id').references(() => accounts.id), // GL account to post tax to
    
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow()
});

// ============================================
// PROCUREMENT & WAREHOUSE
// ============================================

export const warehouses = pgTable('warehouses', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    name: text('name').notNull(),
    location: text('location'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow()
});

export const vendors = pgTable('vendors', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    name: text('name').notNull(),
    contactPerson: text('contact_person'),
    email: text('email'),
    phone: text('phone'),
    address: text('address'),
    taxNumber: text('tax_number'), // PAN/VAT
    payablesAccountId: integer('payables_account_id').references(() => accounts.id), // GL linkage
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow()
});

// extending existing purchase orders concept
export const goodsReceiptNotes = pgTable('goods_receipt_notes', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    purchaseOrderId: integer('purchase_order_id').references(() => purchaseOrders.id),
    vendorId: integer('vendor_id').references(() => vendors.id).notNull(),
    warehouseId: integer('warehouse_id').references(() => warehouses.id).notNull(),
    
    grnNumber: text('grn_number').notNull(),
    referenceInvoice: text('reference_invoice'),
    
    totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
    taxAmount: decimal('tax_amount', { precision: 12, scale: 2 }).default('0'),
    grandTotal: decimal('grand_total', { precision: 12, scale: 2 }).notNull(),
    
    journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id), // Link to auto-posted GL
    
    receivedById: uuid('received_by_id').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow()
});

export const grnLines = pgTable('grn_lines', {
    id: serial('id').primaryKey(),
    grnId: integer('grn_id').references(() => goodsReceiptNotes.id).notNull(),
    itemId: integer('item_id').references(() => inventoryItems.id).notNull(),
    
    quantityReceived: integer('quantity_received').notNull(),
    unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
    lineTotal: decimal('line_total', { precision: 10, scale: 2 }).notNull()
});

// ============================================
// MAINTENANCE & ASSETS
// ============================================

export const assets = pgTable('assets', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    
    name: text('name').notNull(),
    category: text('category'), // HVAC, Plumbing, Furniture, IT
    roomId: integer('room_id').references(() => rooms.id),
    
    purchaseDate: date('purchase_date'),
    purchaseCost: decimal('purchase_cost', { precision: 10, scale: 2 }),
    
    status: text('status').default('ACTIVE'), // ACTIVE, MAINTENANCE, RETIRED
    
    createdAt: timestamp('created_at').defaultNow()
});

export const maintenanceTickets = pgTable('maintenance_tickets', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    
    roomId: integer('room_id').references(() => rooms.id),
    assetId: integer('asset_id').references(() => assets.id),
    
    title: text('title').notNull(),
    description: text('description'),
    priority: text('priority').default('MEDIUM'), // LOW, MEDIUM, HIGH, CRITICAL
    status: text('status').default('OPEN'), // OPEN, IN_PROGRESS, RESOLVED, CLOSED
    
    blocksBooking: boolean('blocks_booking').default(false), // if true, puts room out_of_order
    
    reportedById: uuid('reported_by_id').references(() => users.id),
    assignedToId: uuid('assigned_to_id').references(() => users.id),
    
    createdAt: timestamp('created_at').defaultNow(),
    resolvedAt: timestamp('resolved_at')
});

// ============================================
// HR & PAYROLL
// ============================================

export const payrollSummaries = pgTable('payroll_summaries', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    
    baseSalary: decimal('base_salary', { precision: 10, scale: 2 }).notNull(),
    overtimePay: decimal('overtime_pay', { precision: 10, scale: 2 }).default('0'),
    deductions: decimal('deductions', { precision: 10, scale: 2 }).default('0'),
    netPay: decimal('net_pay', { precision: 10, scale: 2 }).notNull(),
    
    status: text('status').default('DRAFT'), // DRAFT, APPROVED, PAID
    journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id), // Link to auto-posted GL
    
    createdAt: timestamp('created_at').defaultNow()
});

// ============================================
// SYSTEM RELIABILITY (Outbox & Sync)
// ============================================

export const outboxEvents = pgTable('outbox_events', {
    id: uuid('id').defaultRandom().primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id), // null for global events
    
    aggregateType: text('aggregate_type').notNull(),
    aggregateId: text('aggregate_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: json('payload').notNull(),
    
    status: text('status').default('PENDING'), // PENDING, DELIVERED, FAILED
    errorMsg: text('error_msg'),
    attempts: integer('attempts').default(0),
    
    createdAt: timestamp('created_at').defaultNow(),
    deliveredAt: timestamp('delivered_at')
}, (table) => [
    index('outbox_status_idx').on(table.status),
    index('outbox_hotel_idx').on(table.hotelId),
]);

export const idempotencyKeys = pgTable('idempotency_keys', {
    key: text('key').primaryKey(),
    userId: uuid('user_id'),
    path: text('path').notNull(),
    method: text('method').notNull(),
    
    responseStatus: integer('response_status'),
    responseBody: json('response_body'),
    
    createdAt: timestamp('created_at').defaultNow()
});

export const syncCheckpoints = pgTable('sync_checkpoints', {
    id: serial('id').primaryKey(),
    hotelId: integer('hotel_id').references(() => hotels.id).notNull(),
    deviceId: text('device_id').notNull(),
    
    lastSyncTimestamp: timestamp('last_sync_timestamp').notNull(),
    clientVersion: text('client_version'),
    
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
}, (table) => [
    index('sync_hotel_device_idx').on(table.hotelId, table.deviceId)
]);
