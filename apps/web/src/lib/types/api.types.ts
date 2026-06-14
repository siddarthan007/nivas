/**
 * Nivas PMS API Types
 * TypeScript interfaces matching backend response shapes
 *
 * NOTE: ApiResponse is defined in @/lib/api.ts (single source of truth).
 * Import it from there: `import { ApiResponse } from '@/lib/api'`
 */

// ============================================================================
// Common Types
// ============================================================================

export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

// ============================================================================
// User & Auth Types
// ============================================================================

export type UserType = 'SUPER_ADMIN' | 'HOTEL_STAFF' | 'GUEST';

export interface MobileDevice {
    platform: string;
    deviceId: string | null;
    createdAt: string;
}

export interface User {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    hotelId: number | null;
    userType: UserType;
    isActive: boolean;
    hasMobileApp?: boolean;
    mobileDevices?: MobileDevice[];
    role?: Role;
    createdAt: string;
    updatedAt: string;
}

export interface Role {
    id: number;
    name: string;
    description?: string;
    level: number; // lower = higher authority (Owner=0, Manager=1...)
    permissions: string[];
    hotelId: number;
    isSystem: boolean;
}

export interface CreateRolePayload {
    name: string;
    description?: string;
    level?: number;
    permissions: string[];
}

export interface LoginResponse {
    token: string;
    user: {
        id: string;
        name: string;
        role?: string;
    };
}

export interface Login2FAResponse {
    require2FA: true;
    userId: string;
}

// ============================================================================
// Room Types
// ============================================================================

export type RoomStatus = 'AVAILABLE' | 'OCCUPIED' | 'CLEANING' | 'MAINTENANCE' | 'OUT_OF_ORDER';
export type RoomType = string;

export interface Room {
    id: number;
    hotelId: number;
    number: number;
    name?: string;
    type: RoomType;
    rate: number;
    status: RoomStatus;
    floorId?: number;
    floorNumber?: number;
    capacity?: number;
    imageUrl?: string;
    amenities?: string[];
    notes?: string;
    layoutProps?: any; // JSON layout properties
    currentBooking?: {
        id: string;
        guestName: string;
        checkIn: string;
        checkOut: string;
    } | null;
    createdAt: string;
    updatedAt: string;
}

export interface CreateRoomPayload {
    number: number;
    name?: string;
    type: RoomType;
    rate: number;
    floorId?: number;
    floorNumber?: number;
    capacity?: number;
    imageUrl?: string;
}

export interface UpdateRoomPayload {
    number?: number;
    name?: string;
    type?: RoomType;
    rate?: number;
    imageUrl?: string;
    status?: RoomStatus;
    floorId?: number;
    floorNumber?: number;
    capacity?: number;
}

// ============================================================================
// Booking Types
// ============================================================================

export type BookingStatus = 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';
export type BookingSource = 'WALK_IN' | 'PHONE' | 'WEBSITE' | 'OTA' | 'TRAVEL_AGENT' | 'CORPORATE';

export interface Booking {
    id: string;
    hotelId: number;
    roomId: number;
    room?: Room;
    guestName: string;
    guestPhone: string;
    guestEmail?: string;
    guestId?: string;
    guestCount: number;
    checkIn: string;
    checkOut: string;
    status: BookingStatus;
    source: BookingSource;
    totalAmount: number;
    advancePayment?: number;
    balanceAmount?: number;
    creditBalance?: number;
    isPaid?: boolean;
    notes?: string;
    guestPin?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateBookingPayload {
    roomId: number;
    guestId?: string;
    guestName: string;
    guestPhone: string;
    guestEmail?: string;
    guestCount: number;
    checkIn: string;
    checkOut: string;
    totalAmount: number;
    advancePayment?: number;
    source?: BookingSource;
    firstName?: string;
    lastName?: string;
    uniqueId?: string;
    fatherName?: string;
    dob?: string;
    occupation?: string;
    address?: string;
    city?: string;
    country?: string;
    notes?: string;
    nationality?: string;
    idNumber?: string;
    idType?: string;
    panNumber?: string;
    vatNumber?: string;
    corporateAccountId?: number;
    travelAgentId?: number;
}

// ============================================================================
// Order Types
// ============================================================================

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
export type OrderType = 'ROOM_SERVICE' | 'DINE_IN' | 'TAKEAWAY';

export interface OrderItem {
    id: number;
    menuItemId: number;
    menuItem?: MenuItem;
    quantity: number;
    price: number;
    notes?: string;
}

export interface Order {
    id: string;
    hotelId: number;
    orderNumber: string;
    roomId?: number;
    room?: Room;
    bookingId?: string;
    restaurantTableId?: number;
    customerName?: string;
    orderType: OrderType;
    status: OrderStatus;
    paymentStatus?: 'UNPAID' | 'PAID' | 'PARTIAL' | 'ON_FOLIO';
    items: OrderItem[];
    totalAmount: number;
    subTotal?: number;
    vatAmount?: number;
    serviceChargeAmount?: number;
    vatRate?: number;
    serviceChargeRate?: number;
    applyVat?: boolean;
    applyServiceCharge?: boolean;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateOrderPayload {
    roomId?: number;
    bookingId?: string;
    customerName?: string;
    restaurantTableId?: number;
    guestId?: string;
    outletId?: number;
    orderType: OrderType;
    addToGuestBill?: boolean;
    applyVat?: boolean;
    applyServiceCharge?: boolean;
    paymentMethod?: string;
    cashTendered?: number;
    items: {
        menuItemId: number;
        quantity: number;
        price: number;
        notes?: string;
    }[];
}

// ============================================================================
// Menu Types
// ============================================================================

export interface MenuItem {
    id: number;
    hotelId: number;
    name: string;
    description?: string;
    category: string;
    price: number;
    isAvailable: boolean;
    imageUrl?: string;
    createdAt: string;
}

export interface CreateMenuItemPayload {
    name: string;
    description?: string;
    category: string;
    price: number;
    isAvailable?: boolean;
    imageUrl?: string;
}

// ============================================================================
// Housekeeping Types
// ============================================================================

export type HousekeepingStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'DONE';
export type HousekeepingPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type HousekeepingTaskType = 'CHECKOUT_CLEAN' | 'STAYOVER_CLEAN' | 'DEEP_CLEAN' | 'MAINTENANCE' | 'INSPECTION';

export interface HousekeepingTask {
    id: number;
    hotelId: number;
    roomId: number;
    room?: Room;
    assignedToId?: string;
    assignedTo?: User;
    taskType: HousekeepingTaskType;
    priority: HousekeepingPriority;
    status: HousekeepingStatus;
    notes?: string;
    startedAt?: string;
    completedAt?: string;
    createdAt: string;
}

export interface CreateHousekeepingPayload {
    roomId: number;
    bookingId?: string;
    assignedToId?: string;
    taskType: HousekeepingTaskType;
    priority: HousekeepingPriority;
    notes?: string;
}

// ============================================================================
// Inventory Types
// ============================================================================

export type ItemCategory = 'FOOD' | 'BEVERAGE' | 'HOUSEKEEPING' | 'STATIONERY' | 'MAINTENANCE';

export interface InventoryItem {
    id: number;
    hotelId: number;
    sku: string;
    barcode?: string;
    name: string;
    description?: string;
    category: ItemCategory;
    unit: string;
    quantity: number;
    currentStock: number;
    minStock: number;
    reorderLevel: number;
    unitCost: number;
    costPrice: number;
    lowStockThreshold: number;
    status: 'ACTIVE' | 'DISCONTINUED';
    supplier?: string;
    warehouseId?: number;
    warehouse?: { id: number; name: string };
    supplierId?: number;
    supplierObj?: { id: number; name: string };
    createdAt: string;
    updatedAt: string;
}

export interface CreateInventoryPayload {
    sku?: string;
    barcode?: string;
    name: string;
    description?: string;
    category: ItemCategory;
    unit: string;
    currentStock?: number;
    quantity?: number;
    minStock?: number;
    reorderLevel?: number;
    lowStockThreshold?: number;
    unitCost?: number;
    costPrice?: number;
    status?: 'ACTIVE' | 'DISCONTINUED';
    supplier?: string;
    warehouseId?: number;
    supplierId?: number;
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface DashboardStats {
    roomsTotal: number;
    roomsOccupied: number;
    roomsVacant: number;
    roomsDirty: number;
    roomsClean?: number;
    roomsMaintenance?: number;
    todayArrivals: number;
    todayDepartures: number;
    pendingOrders: number;
    pendingHousekeeping: number;
    todayRevenue: number;
    occupancyRate: number;
    lowStockItems?: number;
    // Nepali PMS metrics
    todayUnpaid?: number;
    todayDiscount?: number;
    totalDue?: number;
    totalPurchase?: number;
    todayProfit?: number;
    totalOrders?: number;
    qrOrders?: number;
    totalMenuItems?: number;
    totalEmployees?: number;
    bestHour?: string;
    totalAdvancePayments?: number;
}

export interface RevenueAnalytics {
    totalRevenue: number;
    roomRevenue: number;
    fbRevenue: number;
    otherRevenue: number;
    trend: { date: string; amount: number }[];
    fbTrend?: { date: string; amount: number; orders: number }[];
    comparison: {
        current: number;
        previous: number;
        change: number;
    };
}

export interface OccupancyAnalytics {
    averageOccupancy: number;
    trend: { date: string; occupancy: number }[];
    byRoomType: { type: RoomType; occupancy: number }[];
}

export interface KeyMetrics {
    adr: number; // Average Daily Rate
    revpar: number; // Revenue Per Available Room
    occupancyRate: number;
    averageLos: number; // Average Length of Stay
}

// ============================================================================
// Super Admin Types
// ============================================================================

export interface Tenant {
    id: number;
    name: string;
    email: string;
    phone: string;
    address?: string;
    logoUrl?: string;
    roomCount: number;
    userLimit: number;
    isActive: boolean;
    license?: License;
    createdAt: string;
}

export interface License {
    id: number;
    hotelId: number;
    plan: 'STANDARD' | 'PRO' | 'ENTERPRISE';
    startDate: string;
    endDate: string;
    maxUsers: number;
    maxRooms: number;
    features: string[];
    isActive: boolean;
}

export interface SaaSOverview {
    totalTenants: number;
    activeTenants: number;
    totalRevenue: number;
    monthlyRevenue: number;
    expiringLicenses: number;
    revenueHistory?: { month: string; amount: number }[];
    tenantGrowth?: { month: string; count: number }[];
}

export interface SaaSPayment {
    id: string;
    hotelId: number;
    hotelName?: string;
    amount: string;
    currency: string;
    status: string;
    paymentMethod?: string;
    transactionId?: string;
    invoiceNumber?: string;
    periodStart?: string;
    periodEnd?: string;
    notes?: string;
    createdAt: string;
}

// ============================================================================
// IAM Types
// ============================================================================

export interface CreateUserPayload {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    roleId: number;
}

export interface UpdateUserPayload {
    fullName?: string;
    email?: string;
    phone?: string;
    roleId?: number;
    isActive?: boolean;
}

// ============================================================================
// Settings Types
// ============================================================================

export interface TenantSettings {
    id: number;
    hotelId: number;
    branding: {
        logoUrl?: string;
        primaryColor?: string;
        secondaryColor?: string;
    };
    contact: {
        address?: string;
        phone?: string;
        email?: string;
        website?: string;
    };
    tax: {
        panNumber?: string;
        vatNumber?: string;
        serviceChargeRate?: number;
        taxRate?: number;
    };
    invoice: {
        prefix?: string;
        footerText?: string;
        terms?: string;
    };
    regional: {
        currency?: string;
        timezone?: string;
        dateFormat?: string;
        fiscalYearStart?: string;
    };
}

export interface UpdateBrandingPayload {
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
}

export interface UpdateContactPayload {
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
}

export interface UpdateTaxPayload {
    panNumber?: string;
    vatNumber?: string;
    serviceChargeRate?: number;
    taxRate?: number;
}

export interface UpdateInvoicePayload {
    prefix?: string;
    footerText?: string;
    terms?: string;
}

export interface UpdateRegionalPayload {
    currency?: string;
    timezone?: string;
    dateFormat?: string;
    fiscalYearStart?: string;
}

// ============================================================================
// HR / Payroll Types
// ============================================================================
export interface PayrollSummary {
    id: number;
    employeeId: string;
    employeeName: string;
    periodStart: string;
    periodEnd: string;
    baseSalary: number;
    deductions: number;
    bonuses: number;
    netPay: number;
    status: 'DRAFT' | 'APPROVED' | 'PAID' | 'PENDING';
    paymentDate?: string;
}

export interface GeneratePayrollPayload {
    employeeId: string;
    periodStart: string;
    periodEnd: string;
    baseSalary: number;
    deductions?: number;
    bonuses?: number;
}

// ============================================================================
// Maintenance Types
// ============================================================================
export interface Asset {
    id: number;
    hotelId: number;
    name: string;
    category: string;
    serialNumber?: string;
    location?: string;
    purchaseDate?: string;
    purchasePrice?: string;
    status: string;
}

export interface CreateAssetPayload {
    name: string;
    category: string;
    serialNumber?: string;
    location?: string;
    purchaseDate?: string;
    purchasePrice?: string;
    status?: string;
}

export interface MaintenanceTicket {
    id: number;
    hotelId: number;
    title: string;
    description: string;
    priority: string;
    status: string;
    roomId?: number;
    assetId?: number;
    assignedTo?: string;
    blockRoom: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CreateTicketPayload {
    title: string;
    description: string;
    priority?: string;
    roomId?: number;
    assetId?: number;
    assignedTo?: string;
    blockRoom?: boolean;
}
