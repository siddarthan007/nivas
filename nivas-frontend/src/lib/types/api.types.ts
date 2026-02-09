/**
 * Nivas PMS API Types
 * TypeScript interfaces matching backend response shapes
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

export interface ApiResponse<T = unknown> {
    status: 'success' | 'error';
    message?: string;
    data?: T;
    meta?: PaginationMeta;
    code?: string;
}

// ============================================================================
// User & Auth Types
// ============================================================================

export type UserType = 'SUPER_ADMIN' | 'HOTEL_STAFF' | 'GUEST';

export interface User {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    hotelId: number | null;
    userType: UserType;
    isActive: boolean;
    role?: Role;
    createdAt: string;
    updatedAt: string;
}

export interface Role {
    id: number;
    name: string;
    description?: string;
    permissions: string[];
    hotelId: number;
    isSystem: boolean;
}

export interface CreateRolePayload {
    name: string;
    description?: string;
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

// ============================================================================
// Room Types
// ============================================================================

export type RoomStatus = 'AVAILABLE' | 'VACANT' | 'OCCUPIED' | 'DIRTY' | 'MAINTENANCE' | 'OUT_OF_ORDER';
export type RoomType = string;

export interface Room {
    id: number;
    hotelId: number;
    number: number;
    name?: string;
    type: RoomType;
    rate: number;
    status: RoomStatus;
    floor?: number;
    capacity?: number;
    amenities?: string[];
    notes?: string;
    layoutProps?: any; // JSON layout properties
    createdAt: string;
    updatedAt: string;
}

export interface CreateRoomPayload {
    number: number;
    name?: string;
    type: RoomType;
    rate: number;
    floor?: number;
    capacity?: number;
}

export interface UpdateRoomPayload {
    number?: number;
    name?: string;
    type?: RoomType;
    rate?: number;
    status?: RoomStatus;
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
    guestCount: number;
    checkIn: string;
    checkOut: string;
    status: BookingStatus;
    source: BookingSource;
    totalAmount: number;
    advancePayment?: number;
    balanceAmount?: number;
    notes?: string;
    guestPin?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateBookingPayload {
    roomId: number;
    guestName: string;
    guestPhone: string;
    guestEmail?: string;
    guestCount: number;
    checkIn: string;
    checkOut: string;
    totalAmount: number;
    advancePayment?: number;
    source?: BookingSource;
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
    customerName?: string;
    orderType: OrderType;
    status: OrderStatus;
    items: OrderItem[];
    subtotal: number;
    tax: number;
    total: number;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateOrderPayload {
    roomId?: number;
    customerName?: string;
    orderType: OrderType;
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
    preparationTime?: number;
    createdAt: string;
}

export interface CreateMenuItemPayload {
    name: string;
    description?: string;
    category: string;
    price: number;
    isAvailable?: boolean;
    preparationTime?: number;
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
    name: string;
    category: ItemCategory;
    unit: string;
    currentStock: number;
    minStock: number;
    reorderLevel: number;
    costPrice: number;
    supplier?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateInventoryPayload {
    name: string;
    category: ItemCategory;
    unit: string;
    currentStock: number;
    minStock: number;
    reorderLevel: number;
    costPrice: number;
    supplier?: string;
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
}

export interface RevenueAnalytics {
    totalRevenue: number;
    roomRevenue: number;
    fbRevenue: number;
    otherRevenue: number;
    trend: { date: string; amount: number }[];
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
