
'use client';

import { useMemo } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useRouter } from '@/lib/router';
import { useAnalytics, useSaaSAnalytics } from '@/lib/hooks/useAnalytics';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
    Building2,
    TrendingUp,
    Bed,
    UtensilsCrossed,
    Sparkles,
    CircleDollarSign,
    CalendarCheck,
    AlertCircle,
    ClipboardList,
    RefreshCw,
    Plus,
    ArrowRight,
    FileText,
    Package,
    CreditCard,
    SquareStack,
    BookOpen,
    CheckCircle2,
    Wrench,
} from 'lucide-react';
import type { DashboardStats, SaaSOverview } from '@/lib/types/api.types';
import ClockWidget from '@/components/widgets/ClockWidget';
import QuickNotesWidget from '@/components/widgets/QuickNotesWidget';
import QuoteWidget from '@/components/widgets/QuoteWidget';

const colorMap: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'var(--notion-blue-bg)', text: 'var(--notion-blue)' },
    green: { bg: 'var(--notion-green-bg)', text: 'var(--notion-green)' },
    orange: { bg: 'var(--notion-yellow-bg)', text: 'var(--notion-orange)' },
    red: { bg: 'var(--notion-red-bg)', text: 'var(--notion-red)' },
    purple: { bg: 'rgba(154, 109, 215, 0.2)', text: 'var(--notion-purple)' },
};

interface WidgetConfig {
    id: string;
    title: string;
    icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
    color: string;
    getValue: (stats: DashboardStats | null, saas: SaaSOverview | null) => string | number;
    href?: string;
}

interface QuickAction {
    label: string;
    icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
    href: string;
    color: string;
}

const SUPER_ADMIN_WIDGETS: WidgetConfig[] = [
    {
        id: 'hotels',
        title: 'Hotels Managed',
        icon: Building2,
        color: 'blue',
        getValue: (_, saas) => saas?.totalTenants ?? '--',
        href: '/dashboard/tenants'
    },
    {
        id: 'active',
        title: 'Active Licenses',
        icon: CircleDollarSign,
        color: 'green',
        getValue: (_, saas) => saas?.activeTenants ?? '--',
        href: '/dashboard/licenses'
    },
    {
        id: 'revenue',
        title: 'Monthly Revenue',
        icon: TrendingUp,
        color: 'orange',
        getValue: (_, saas) => saas?.monthlyRevenue ? `Rs.${saas.monthlyRevenue.toLocaleString()}` : '--',
        href: '/dashboard/analytics'
    },
    {
        id: 'expiring',
        title: 'Expiring Soon',
        icon: AlertCircle,
        color: 'red',
        getValue: (_, saas) => saas?.expiringLicenses ?? '--',
        href: '/dashboard/licenses'
    },
];

const HOTEL_WIDGETS: Record<string, WidgetConfig[]> = {
    OWNER: [
        {
            id: 'revenue',
            title: "Today's Revenue",
            icon: TrendingUp,
            color: 'green',
            getValue: (stats) => stats?.todayRevenue != null ? `Rs.${stats.todayRevenue.toLocaleString()}` : '--',
        },
        {
            id: 'occupancy',
            title: 'Occupancy Rate',
            icon: Bed,
            color: 'blue',
            getValue: (stats) => stats?.occupancyRate != null ? `${Math.round(stats.occupancyRate)}%` : '--',
            href: '/dashboard/rooms'
        },
        {
            id: 'arrivals',
            title: "Today's Arrivals",
            icon: CalendarCheck,
            color: 'orange',
            getValue: (stats) => stats?.todayArrivals ?? '--',
            href: '/dashboard/bookings'
        },
        {
            id: 'departures',
            title: "Today's Departures",
            icon: CalendarCheck,
            color: 'purple',
            getValue: (stats) => stats?.todayDepartures ?? '--',
            href: '/dashboard/bookings'
        },
    ],
    MANAGER: [
        {
            id: 'occupied',
            title: 'Rooms Occupied',
            icon: Bed,
            color: 'blue',
            getValue: (stats) => stats ? `${stats.roomsOccupied}/${stats.roomsTotal}` : '--',
            href: '/dashboard/rooms'
        },
        {
            id: 'orders',
            title: 'Pending Orders',
            icon: UtensilsCrossed,
            color: 'orange',
            getValue: (stats) => stats?.pendingOrders ?? '--',
            href: '/dashboard/orders'
        },
        {
            id: 'housekeeping',
            title: 'Pending Tasks',
            icon: Sparkles,
            color: 'purple',
            getValue: (stats) => stats?.pendingHousekeeping ?? '--',
            href: '/dashboard/housekeeping'
        },
        {
            id: 'arrivals',
            title: "Today's Arrivals",
            icon: CalendarCheck,
            color: 'green',
            getValue: (stats) => stats?.todayArrivals ?? '--',
            href: '/dashboard/bookings'
        },
    ],
    FRONT_DESK: [
        {
            id: 'vacant',
            title: 'Available Rooms',
            icon: Bed,
            color: 'green',
            getValue: (stats) => stats?.roomsVacant ?? '--',
            href: '/dashboard/rooms'
        },
        {
            id: 'checkins',
            title: 'Pending Check-ins',
            icon: CalendarCheck,
            color: 'blue',
            getValue: (stats) => stats?.todayArrivals ?? '--',
            href: '/dashboard/bookings'
        },
        {
            id: 'departures',
            title: "Today's Departures",
            icon: CalendarCheck,
            color: 'orange',
            getValue: (stats) => stats?.todayDepartures ?? '--',
            href: '/dashboard/bookings'
        },
        {
            id: 'dirty',
            title: 'Rooms to Clean',
            icon: Sparkles,
            color: 'purple',
            getValue: (stats) => stats?.roomsDirty ?? '--',
            href: '/dashboard/housekeeping'
        },
    ],
    WAITER: [
        {
            id: 'active-orders',
            title: 'Active Orders',
            icon: UtensilsCrossed,
            color: 'orange',
            getValue: (stats) => stats?.pendingOrders ?? '--',
            href: '/dashboard/orders'
        },
        {
            id: 'tables',
            title: 'Tables Overview',
            icon: SquareStack,
            color: 'blue',
            getValue: (stats) => stats ? `${stats.roomsOccupied || 0} occupied` : '--',
            href: '/dashboard/operations/tables'
        },
        {
            id: 'menu',
            title: 'Menu Items',
            icon: BookOpen,
            color: 'green',
            getValue: () => 'View',
            href: '/dashboard/menu'
        },
    ],
    HOUSEKEEPING_SUPERVISOR: [
        {
            id: 'dirty',
            title: 'Rooms to Clean',
            icon: Sparkles,
            color: 'purple',
            getValue: (stats) => stats?.roomsDirty ?? '--',
            href: '/dashboard/housekeeping'
        },
        {
            id: 'tasks',
            title: 'Pending Tasks',
            icon: ClipboardList,
            color: 'blue',
            getValue: (stats) => stats?.pendingHousekeeping ?? '--',
            href: '/dashboard/housekeeping'
        },
        {
            id: 'completed',
            title: 'Completed Today',
            icon: CheckCircle2,
            color: 'green',
            getValue: (stats) => stats?.roomsClean ?? '--',
        },
        {
            id: 'maintenance',
            title: 'Maintenance',
            icon: Wrench,
            color: 'red',
            getValue: (stats) => stats?.roomsMaintenance ?? '--',
            href: '/dashboard/housekeeping'
        },
    ],
    KITCHEN_MANAGER: [
        {
            id: 'pending',
            title: 'Pending Orders',
            icon: UtensilsCrossed,
            color: 'orange',
            getValue: (stats) => stats?.pendingOrders ?? '--',
            href: '/dashboard/kitchen'
        },
        {
            id: 'menu',
            title: 'Menu Items',
            icon: BookOpen,
            color: 'blue',
            getValue: () => 'Manage',
            href: '/dashboard/menu'
        },
        {
            id: 'inventory',
            title: 'Low Stock Items',
            icon: Package,
            color: 'red',
            getValue: (stats) => stats?.lowStockItems ?? '--',
            href: '/dashboard/inventory'
        },
    ],
    ACCOUNTANT: [
        {
            id: 'revenue',
            title: "Today's Revenue",
            icon: TrendingUp,
            color: 'green',
            getValue: (stats) => stats?.todayRevenue != null ? `Rs.${stats.todayRevenue.toLocaleString()}` : '--',
            href: '/dashboard/finance'
        },
        {
            id: 'invoices',
            title: 'Pending Invoices',
            icon: FileText,
            color: 'blue',
            getValue: (stats) => stats?.pendingOrders ?? '--',
            href: '/dashboard/finance'
        },
        {
            id: 'reports',
            title: 'Reports',
            icon: FileText,
            color: 'orange',
            getValue: () => 'View',
            href: '/dashboard/reports'
        },
        {
            id: 'procurement',
            title: 'Procurement',
            icon: Package,
            color: 'purple',
            getValue: () => 'Manage',
            href: '/dashboard/procurement'
        },
    ],
    DEFAULT: [
        {
            id: 'tasks',
            title: 'My Tasks',
            icon: ClipboardList,
            color: 'blue',
            getValue: (stats) => stats?.pendingHousekeeping ?? 0,
        },
        {
            id: 'orders',
            title: 'Active Orders',
            icon: UtensilsCrossed,
            color: 'orange',
            getValue: (stats) => stats?.pendingOrders ?? 0,
            href: '/dashboard/orders'
        },
    ],
};

const ROLE_QUICK_ACTIONS: Record<string, QuickAction[]> = {
    OWNER: [
        { label: 'New Booking', icon: Plus, href: '/dashboard/bookings', color: 'blue' },
        { label: 'View Rooms', icon: Bed, href: '/dashboard/rooms', color: 'green' },
        { label: 'Finance', icon: CreditCard, href: '/dashboard/finance', color: 'orange' },
        { label: 'Reports', icon: FileText, href: '/dashboard/reports', color: 'purple' },
    ],
    MANAGER: [
        { label: 'New Booking', icon: Plus, href: '/dashboard/bookings', color: 'blue' },
        { label: 'Staff', icon: ClipboardList, href: '/dashboard/staff', color: 'green' },
        { label: 'Housekeeping', icon: Sparkles, href: '/dashboard/housekeeping', color: 'purple' },
        { label: 'Inventory', icon: Package, href: '/dashboard/inventory', color: 'orange' },
    ],
    FRONT_DESK: [
        { label: 'New Booking', icon: Plus, href: '/dashboard/bookings', color: 'blue' },
        { label: 'Floor Plan', icon: Bed, href: '/dashboard/operations/floor-plan', color: 'green' },
        { label: 'New Order', icon: UtensilsCrossed, href: '/dashboard/orders', color: 'orange' },
        { label: 'Messages', icon: ClipboardList, href: '/dashboard/messages', color: 'purple' },
    ],
    WAITER: [
        { label: 'New Order', icon: Plus, href: '/dashboard/orders', color: 'blue' },
        { label: 'Table Plan', icon: SquareStack, href: '/dashboard/operations/tables', color: 'green' },
        { label: 'Kitchen Display', icon: UtensilsCrossed, href: '/dashboard/kitchen', color: 'orange' },
        { label: 'Menu', icon: BookOpen, href: '/dashboard/menu', color: 'purple' },
    ],
    HOUSEKEEPING_SUPERVISOR: [
        { label: 'View Tasks', icon: ClipboardList, href: '/dashboard/housekeeping', color: 'blue' },
        { label: 'Room Status', icon: Bed, href: '/dashboard/rooms', color: 'green' },
        { label: 'Request Supplies', icon: Package, href: '/dashboard/inventory', color: 'orange' },
        { label: 'Messages', icon: ClipboardList, href: '/dashboard/messages', color: 'purple' },
    ],
    KITCHEN_MANAGER: [
        { label: 'Kitchen Display', icon: UtensilsCrossed, href: '/dashboard/kitchen', color: 'blue' },
        { label: 'Manage Menu', icon: BookOpen, href: '/dashboard/menu', color: 'green' },
        { label: 'Inventory', icon: Package, href: '/dashboard/inventory', color: 'orange' },
        { label: 'Orders', icon: ClipboardList, href: '/dashboard/orders', color: 'purple' },
    ],
    ACCOUNTANT: [
        { label: 'Finance', icon: CreditCard, href: '/dashboard/finance', color: 'blue' },
        { label: 'Reports', icon: FileText, href: '/dashboard/reports', color: 'green' },
        { label: 'Procurement', icon: Package, href: '/dashboard/procurement', color: 'orange' },
        { label: 'Revenue', icon: TrendingUp, href: '/dashboard/revenue', color: 'purple' },
    ],
};

function WidgetSkeleton() {
    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--notion-border)',
            padding: 'var(--space-5)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
        }}>
            <div style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--notion-bg-tertiary)',
                animation: 'pulse 1.5s ease-in-out infinite'
            }} />
            <div>
                <div style={{
                    width: '60px',
                    height: '24px',
                    backgroundColor: 'var(--notion-bg-tertiary)',
                    borderRadius: '4px',
                    marginBottom: 'var(--space-2)',
                    animation: 'pulse 1.5s ease-in-out infinite'
                }} />
                <div style={{
                    width: '100px',
                    height: '14px',
                    backgroundColor: 'var(--notion-bg-tertiary)',
                    borderRadius: '4px',
                    animation: 'pulse 1.5s ease-in-out infinite'
                }} />
            </div>
        </div>
    );
}

interface DashboardWidgetProps {
    widget: WidgetConfig;
    stats: DashboardStats | null;
    saasStats: SaaSOverview | null;
}

function DashboardWidget({ widget, stats, saasStats }: DashboardWidgetProps) {
    const Icon = widget.icon;
    const colors = colorMap[widget.color] ?? colorMap['blue']!;
    const value = widget.getValue(stats, saasStats);
    const router = useRouter();

    const handleClick = () => {
        if (widget.href) {
            router.push(widget.href);
        }
    };

    return (
        <div
            style={{
                backgroundColor: 'var(--notion-bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--notion-border)',
                padding: 'var(--space-5)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
                transition: 'transform 150ms ease, box-shadow 150ms ease',
                cursor: widget.href ? 'pointer' : 'default',
            }}
            onClick={handleClick}
            onMouseEnter={e => {
                if (widget.href) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }
            }}
            onMouseLeave={e => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
            }}
        >
            <div style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: colors.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <Icon size={20} style={{ color: colors.text }} />
            </div>
            <div>
                <div style={{
                    fontSize: '24px',
                    fontWeight: '600',
                    color: 'var(--notion-text)',
                    marginBottom: 'var(--space-1)'
                }}>
                    {value}
                </div>
                <div style={{
                    fontSize: '13px',
                    color: 'var(--notion-text-secondary)'
                }}>
                    {widget.title}
                </div>
            </div>
        </div>
    );
}

function QuickActionButton({ action }: { action: QuickAction }) {
    const Icon = action.icon;
    const colors = colorMap[action.color] ?? colorMap['blue']!;
    const router = useRouter();

    return (
        <button
            onClick={() => { router.push(action.href); }}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                backgroundColor: 'var(--notion-bg-secondary)',
                border: '1px solid var(--notion-border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                transition: 'all 150ms ease',
                width: '100%',
                textAlign: 'left',
            }}
            onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'var(--notion-bg-tertiary)';
                e.currentTarget.style.borderColor = colors.text;
            }}
            onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'var(--notion-bg-secondary)';
                e.currentTarget.style.borderColor = 'var(--notion-border)';
            }}
        >
            <div style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: colors.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
            }}>
                <Icon size={16} style={{ color: colors.text }} />
            </div>
            <span style={{
                fontSize: '13px',
                fontWeight: '500',
                color: 'var(--notion-text)',
                flex: 1,
            }}>
                {action.label}
            </span>
            <ArrowRight size={14} style={{ color: 'var(--notion-text-secondary)' }} />
        </button>
    );
}

export default function DashboardPage() {
    const { user } = useAuth();
    const { isUserType } = usePermissions();
    const { dashboardStats, isLoading, fetchDashboard } = useAnalytics();
    const { overview: saasStats } = useSaaSAnalytics();

    const roleKey = useMemo(() => {
        if (!user) return 'DEFAULT';
        return user.role?.toUpperCase().replace(/\s+/g, '_') || 'DEFAULT';
    }, [user]);

    const widgets = useMemo((): WidgetConfig[] => {
        if (!user) return [];
        if (isUserType('SUPER_ADMIN')) return SUPER_ADMIN_WIDGETS;
        if (isUserType('HOTEL_STAFF')) {
            return HOTEL_WIDGETS[roleKey] ?? HOTEL_WIDGETS.DEFAULT ?? [];
        }
        return HOTEL_WIDGETS.DEFAULT ?? [];
    }, [user, isUserType, roleKey]);

    const quickActions = useMemo((): QuickAction[] => {
        if (!user || isUserType('SUPER_ADMIN')) return [];
        return ROLE_QUICK_ACTIONS[roleKey] ?? [];
    }, [user, isUserType, roleKey]);

    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    }, []);

    const roleDisplayName = useMemo(() => {
        if (!user) return '';
        if (isUserType('SUPER_ADMIN')) return 'Super Admin';
        return user.role || user.userType || '';
    }, [user, isUserType]);

    return (
        <DashboardLayout>
            <div style={{ padding: 'var(--space-6) var(--space-8)', maxWidth: '1200px', margin: '0 auto' }}>
                    {/* Header */}
                    <div style={{
                        marginBottom: 'var(--space-8)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start'
                    }}>
                        <div>
                            <h1 style={{
                                fontSize: '28px',
                                fontWeight: '600',
                                color: 'var(--notion-text)',
                                marginBottom: 'var(--space-2)'
                            }}>
                                {greeting}, {user?.name?.split(' ')[0] || 'User'}
                            </h1>
                            <p style={{
                                fontSize: '14px',
                                color: 'var(--notion-text-secondary)'
                            }}>
                                Here's what's happening {isUserType('SUPER_ADMIN') ? 'across your hotels' : 'at your property'} today.
                            </p>
                        </div>

                        <button
                            onClick={() => fetchDashboard()}
                            disabled={isLoading}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-2)',
                                padding: '8px 12px',
                                backgroundColor: 'var(--notion-bg-secondary)',
                                border: '1px solid var(--notion-border)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--notion-text-secondary)',
                                fontSize: '13px',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                transition: 'all 150ms ease',
                            }}
                        >
                            <RefreshCw
                                size={14}
                                style={{
                                    animation: isLoading ? 'spin 1s linear infinite' : 'none'
                                }}
                            />
                            Refresh
                        </button>
                    </div>

                    {/* Clock Widget */}
                    <div style={{ marginBottom: 'var(--space-6)' }}>
                        <ClockWidget />
                    </div>

                    {/* Stat Widgets */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                        gap: 'var(--space-4)'
                    }}>
                        {isLoading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <WidgetSkeleton key={i} />
                            ))
                        ) : (
                            widgets.map(widget => (
                                <DashboardWidget
                                    key={widget.id}
                                    widget={widget}
                                    stats={dashboardStats}
                                    saasStats={saasStats}
                                />
                            ))
                        )}
                    </div>

                    {/* Quick Actions (role-specific) */}
                    {quickActions.length > 0 && (
                        <div style={{ marginTop: 'var(--space-8)' }}>
                            <h2 style={{
                                fontSize: '16px',
                                fontWeight: '600',
                                color: 'var(--notion-text)',
                                marginBottom: 'var(--space-4)',
                            }}>
                                Quick Actions
                            </h2>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                gap: 'var(--space-3)',
                            }}>
                                {quickActions.map(action => (
                                    <QuickActionButton key={action.label} action={action} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Bottom widgets */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                        gap: 'var(--space-6)',
                        marginTop: 'var(--space-6)'
                    }}>
                        <div style={{ height: '100%' }}>
                            <QuoteWidget />
                        </div>
                        <div style={{ height: '100%' }}>
                            <QuickNotesWidget />
                        </div>
                    </div>

                    {/* Role Badge */}
                    <div style={{
                        marginTop: 'var(--space-8)',
                        padding: 'var(--space-4)',
                        backgroundColor: 'var(--notion-bg-secondary)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--notion-border)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)'
                    }}>
                        <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--notion-green)'
                        }} />
                        <span style={{
                            fontSize: '13px',
                            color: 'var(--notion-text-secondary)'
                        }}>
                            Logged in as <strong style={{ color: 'var(--notion-text)' }}>{roleDisplayName}</strong>
                        </span>
                    </div>
            </div>
        </DashboardLayout>
    );
}
