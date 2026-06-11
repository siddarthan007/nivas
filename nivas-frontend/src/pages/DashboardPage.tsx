
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useHotelPlan } from '@/lib/hooks/useHotelPlan';
import { useRouter } from '@/lib/router';
import { useAnalytics, useSaaSAnalytics } from '@/lib/hooks/useAnalytics';
import { api } from '@/lib/api';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
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
    IndianRupee,
    Percent,
    Wallet,
    ShoppingCart,
    PieChart,
    QrCode,
    ChefHat,
    Users,
    Clock,
    Banknote,
} from 'lucide-react';
import type { DashboardStats, SaaSOverview } from '@/lib/types/api.types';
import ClockWidget from '@/components/widgets/ClockWidget';
import QuickNotesWidget from '@/components/widgets/QuickNotesWidget';
import QuoteWidget from '@/components/widgets/QuoteWidget';

import OnboardingChecklist from "@/components/features/dashboard/OnboardingChecklist";
import ForecastWidget from "@/components/features/dashboard/ForecastWidget";
const colorMap: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
    blue: { bg: 'var(--notion-blue-bg)', text: 'var(--notion-blue)', border: 'rgba(59,130,246,0.3)', gradient: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(37,99,235,0.05) 100%)' },
    green: { bg: 'var(--notion-green-bg)', text: 'var(--notion-green)', border: 'rgba(34,197,94,0.3)', gradient: 'linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(22,163,74,0.05) 100%)' },
    orange: { bg: 'var(--notion-yellow-bg)', text: 'var(--notion-orange)', border: 'rgba(249,115,22,0.3)', gradient: 'linear-gradient(135deg, rgba(249,115,22,0.12) 0%, rgba(234,88,12,0.05) 100%)' },
    red: { bg: 'var(--notion-red-bg)', text: 'var(--notion-red)', border: 'rgba(239,68,68,0.3)', gradient: 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(220,38,38,0.05) 100%)' },
    purple: { bg: 'rgba(154, 109, 215, 0.15)', text: '#8b5cf6', border: 'rgba(139,92,246,0.3)', gradient: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(124,58,237,0.05) 100%)' },
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

// Widget ID → plan module id (null = core / always allowed)
const WIDGET_MODULE_MAP: Record<string, string | null> = {
    orders: 'orders',
    housekeeping: 'housekeeping',
    inventory: 'inventory',
    menuItems: 'menu',
    employees: 'staff',
    reports: 'reports',
    qrOrders: 'orders',
    finance: 'finance',
    events: 'events',
    kitchen: 'kitchen',
    purchase: 'inventory',
    bestHour: 'orders',
    totalOrders: 'orders',
    profit: 'finance',
};

// Quick-action href → plan module id
const ACTION_MODULE_MAP: Record<string, string> = {
    '/hotel/pos': 'orders',
    '/hotel/finance': 'finance',
    '/hotel/reports': 'reports',
    '/hotel/housekeeping': 'housekeeping',
    '/hotel/inventory': 'inventory',
    '/hotel/menu': 'menu',
    '/hotel/kitchen': 'kitchen',
    '/hotel/operations/tables': 'table-plan',
    '/hotel/operations/floor-plan': 'floor-plan',
    '/hotel/messages': 'messages',
    '/hotel/procurement': 'inventory',
};

function getActionModule(href: string): string | null {
    for (const [prefix, mod] of Object.entries(ACTION_MODULE_MAP)) {
        if (href.startsWith(prefix)) return mod;
    }
    return null;
}

const SUPER_ADMIN_WIDGETS: WidgetConfig[] = [
    {
        id: 'hotels',
        title: 'Hotels Managed',
        icon: Building2,
        color: 'blue',
        getValue: (_, saas) => saas?.totalTenants ?? '--',
        href: '/admin/tenants'
    },
    {
        id: 'active',
        title: 'Active Licenses',
        icon: CircleDollarSign,
        color: 'green',
        getValue: (_, saas) => saas?.activeTenants ?? '--',
        href: '/admin/licenses'
    },
    {
        id: 'revenue',
        title: 'Monthly Revenue',
        icon: TrendingUp,
        color: 'orange',
        getValue: (_, saas) => saas?.monthlyRevenue ? `NPR ${saas.monthlyRevenue.toLocaleString()}` : '--',
        href: '/admin/analytics'
    },
    {
        id: 'expiring',
        title: 'Expiring Soon',
        icon: AlertCircle,
        color: 'red',
        getValue: (_, saas) => saas?.expiringLicenses ?? '--',
        href: '/admin/licenses'
    },
];

const HOTEL_WIDGETS: Record<string, WidgetConfig[]> = {
    OWNER: [
        {
            id: 'revenue',
            title: "Today's Total Sales",
            icon: IndianRupee,
            color: 'green',
            getValue: (stats) => stats?.todayRevenue != null ? `NPR ${stats.todayRevenue.toLocaleString()}` : '--',
        },
        {
            id: 'unpaid',
            title: "Today's Unpaid Amount",
            icon: Wallet,
            color: 'red',
            getValue: (stats) => stats?.todayUnpaid != null ? `NPR ${stats.todayUnpaid.toLocaleString()}` : '--',
        },
        {
            id: 'discount',
            title: "Today's Total Discount",
            icon: Percent,
            color: 'blue',
            getValue: (stats) => stats?.todayDiscount != null ? `NPR ${stats.todayDiscount.toLocaleString()}` : '--',
        },
        {
            id: 'totalDue',
            title: 'Total Due Till Today',
            icon: AlertCircle,
            color: 'orange',
            getValue: (stats) => stats?.totalDue != null ? `NPR ${stats.totalDue.toLocaleString()}` : '--',
        },
        {
            id: 'purchase',
            title: 'Total Purchase Today',
            icon: ShoppingCart,
            color: 'purple',
            getValue: (stats) => stats?.totalPurchase != null ? `NPR ${stats.totalPurchase.toLocaleString()}` : '--',
        },
        {
            id: 'profit',
            title: "Today's P/L Summary",
            icon: PieChart,
            color: 'green',
            getValue: (stats) => stats?.todayProfit != null ? `NPR ${stats.todayProfit.toLocaleString()}` : '--',
        },
        {
            id: 'totalOrders',
            title: 'Total Orders',
            icon: UtensilsCrossed,
            color: 'orange',
            getValue: (stats) => stats?.totalOrders ?? '--',
        },
        {
            id: 'qrOrders',
            title: 'QR Orders',
            icon: QrCode,
            color: 'green',
            getValue: (stats) => stats?.qrOrders ?? '--',
        },
        {
            id: 'menuItems',
            title: 'Total Menu Items',
            icon: ChefHat,
            color: 'purple',
            getValue: (stats) => stats?.totalMenuItems ?? '--',
        },
        {
            id: 'employees',
            title: 'Total Employee',
            icon: Users,
            color: 'blue',
            getValue: (stats) => stats?.totalEmployees ?? '--',
        },
        {
            id: 'bestHour',
            title: 'Best Hour (Last 30 Days)',
            icon: Clock,
            color: 'orange',
            getValue: (stats) => stats?.bestHour ?? '--',
        },
        {
            id: 'advance',
            title: 'Total Advance Payments',
            icon: Banknote,
            color: 'purple',
            getValue: (stats) => stats?.totalAdvancePayments != null ? `NPR ${stats.totalAdvancePayments.toLocaleString()}` : '--',
        },
    ],
    MANAGER: [
        {
            id: 'occupied',
            title: 'Rooms Occupied',
            icon: Bed,
            color: 'blue',
            getValue: (stats) => stats ? `${stats.roomsOccupied}/${stats.roomsTotal}` : '--',
            href: '/hotel/rooms'
        },
        {
            id: 'orders',
            title: 'Pending Orders',
            icon: UtensilsCrossed,
            color: 'orange',
            getValue: (stats) => stats?.pendingOrders ?? '--',
            href: '/hotel/orders'
        },
        {
            id: 'housekeeping',
            title: 'Pending Tasks',
            icon: Sparkles,
            color: 'purple',
            getValue: (stats) => stats?.pendingHousekeeping ?? '--',
            href: '/hotel/housekeeping'
        },
        {
            id: 'arrivals',
            title: "Today's Arrivals",
            icon: CalendarCheck,
            color: 'green',
            getValue: (stats) => stats?.todayArrivals ?? '--',
            href: '/hotel/bookings'
        },
    ],
    FRONT_DESK: [
        {
            id: 'vacant',
            title: 'Available Rooms',
            icon: Bed,
            color: 'green',
            getValue: (stats) => stats?.roomsVacant ?? '--',
            href: '/hotel/rooms'
        },
        {
            id: 'checkins',
            title: 'Pending Check-ins',
            icon: CalendarCheck,
            color: 'blue',
            getValue: (stats) => stats?.todayArrivals ?? '--',
            href: '/hotel/bookings'
        },
        {
            id: 'departures',
            title: "Today's Departures",
            icon: CalendarCheck,
            color: 'orange',
            getValue: (stats) => stats?.todayDepartures ?? '--',
            href: '/hotel/bookings'
        },
        {
            id: 'dirty',
            title: 'Rooms to Clean',
            icon: Sparkles,
            color: 'purple',
            getValue: (stats) => stats?.roomsDirty ?? '--',
            href: '/hotel/housekeeping'
        },
    ],
    WAITER: [
        {
            id: 'active-orders',
            title: 'Active Orders',
            icon: UtensilsCrossed,
            color: 'orange',
            getValue: (stats) => stats?.pendingOrders ?? '--',
            href: '/hotel/orders'
        },
        {
            id: 'tables',
            title: 'Tables Overview',
            icon: SquareStack,
            color: 'blue',
            getValue: (stats) => stats ? `${stats.roomsOccupied || 0} occupied` : '--',
            href: '/hotel/operations/tables'
        },
        {
            id: 'menu',
            title: 'Menu Items',
            icon: BookOpen,
            color: 'green',
            getValue: () => 'View',
            href: '/hotel/menu'
        },
    ],
    HOUSEKEEPING_SUPERVISOR: [
        {
            id: 'dirty',
            title: 'Rooms to Clean',
            icon: Sparkles,
            color: 'purple',
            getValue: (stats) => stats?.roomsDirty ?? '--',
            href: '/hotel/housekeeping'
        },
        {
            id: 'tasks',
            title: 'Pending Tasks',
            icon: ClipboardList,
            color: 'blue',
            getValue: (stats) => stats?.pendingHousekeeping ?? '--',
            href: '/hotel/housekeeping'
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
            href: '/hotel/housekeeping'
        },
    ],
    KITCHEN_MANAGER: [
        {
            id: 'pending',
            title: 'Pending Orders',
            icon: UtensilsCrossed,
            color: 'orange',
            getValue: (stats) => stats?.pendingOrders ?? '--',
            href: '/hotel/kitchen'
        },
        {
            id: 'menu',
            title: 'Menu Items',
            icon: BookOpen,
            color: 'blue',
            getValue: () => 'Manage',
            href: '/hotel/menu'
        },
        {
            id: 'inventory',
            title: 'Low Stock Items',
            icon: Package,
            color: 'red',
            getValue: (stats) => stats?.lowStockItems ?? '--',
            href: '/hotel/inventory'
        },
    ],
    ACCOUNTANT: [
        {
            id: 'revenue',
            title: "Today's Revenue",
            icon: TrendingUp,
            color: 'green',
            getValue: (stats) => stats?.todayRevenue != null ? `Rs.${stats.todayRevenue.toLocaleString()}` : '--',
            href: '/hotel/finance'
        },
        {
            id: 'invoices',
            title: 'Pending Invoices',
            icon: FileText,
            color: 'blue',
            getValue: (stats) => stats?.pendingOrders ?? '--',
            href: '/hotel/finance'
        },
        {
            id: 'reports',
            title: 'Reports',
            icon: FileText,
            color: 'orange',
            getValue: () => 'View',
            href: '/hotel/reports'
        },
        {
            id: 'procurement',
            title: 'Procurement',
            icon: Package,
            color: 'purple',
            getValue: () => 'Manage',
            href: '/hotel/procurement'
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
            href: '/hotel/orders'
        },
    ],
};

const SUPER_ADMIN_QUICK_ACTIONS: QuickAction[] = [
    { label: 'Manage Tenants', icon: Building2, href: '/admin/tenants', color: 'blue' },
    { label: 'Licenses', icon: CircleDollarSign, href: '/admin/licenses', color: 'green' },
    { label: 'Analytics', icon: TrendingUp, href: '/admin/analytics', color: 'orange' },
    { label: 'Plans', icon: CreditCard, href: '/admin/plans', color: 'purple' },
    { label: 'Audit Logs', icon: FileText, href: '/admin/audit', color: 'red' },
    { label: 'Settings', icon: Wrench, href: '/admin/settings', color: 'blue' },
];

const ROLE_QUICK_ACTIONS: Record<string, QuickAction[]> = {
    OWNER: [
        { label: 'New Booking', icon: Plus, href: '/hotel/bookings', color: 'blue' },
        { label: 'POS', icon: ShoppingCart, href: '/hotel/pos', color: 'green' },
        { label: 'Finance', icon: CreditCard, href: '/hotel/finance', color: 'orange' },
        { label: 'Reports', icon: FileText, href: '/hotel/reports', color: 'purple' },
    ],
    MANAGER: [
        { label: 'New Booking', icon: Plus, href: '/hotel/bookings', color: 'blue' },
        { label: 'POS', icon: ShoppingCart, href: '/hotel/pos', color: 'green' },
        { label: 'Housekeeping', icon: Sparkles, href: '/hotel/housekeeping', color: 'purple' },
        { label: 'Inventory', icon: Package, href: '/hotel/inventory', color: 'orange' },
    ],
    FRONT_DESK: [
        { label: 'New Booking', icon: Plus, href: '/hotel/bookings', color: 'blue' },
        { label: 'POS', icon: ShoppingCart, href: '/hotel/pos', color: 'green' },
        { label: 'Floor Plan', icon: Bed, href: '/hotel/operations/floor-plan', color: 'orange' },
        { label: 'Messages', icon: ClipboardList, href: '/hotel/messages', color: 'purple' },
    ],
    WAITER: [
        { label: 'POS', icon: ShoppingCart, href: '/hotel/pos', color: 'blue' },
        { label: 'Table Plan', icon: SquareStack, href: '/hotel/operations/tables', color: 'green' },
        { label: 'Kitchen Display', icon: UtensilsCrossed, href: '/hotel/kitchen', color: 'orange' },
        { label: 'Menu', icon: BookOpen, href: '/hotel/menu', color: 'purple' },
    ],
    HOUSEKEEPING_SUPERVISOR: [
        { label: 'View Tasks', icon: ClipboardList, href: '/hotel/housekeeping', color: 'blue' },
        { label: 'Room Status', icon: Bed, href: '/hotel/rooms', color: 'green' },
        { label: 'Request Supplies', icon: Package, href: '/hotel/inventory', color: 'orange' },
        { label: 'Messages', icon: ClipboardList, href: '/hotel/messages', color: 'purple' },
    ],
    KITCHEN_MANAGER: [
        { label: 'Kitchen Display', icon: UtensilsCrossed, href: '/hotel/kitchen', color: 'blue' },
        { label: 'Manage Menu', icon: BookOpen, href: '/hotel/menu', color: 'green' },
        { label: 'Inventory', icon: Package, href: '/hotel/inventory', color: 'orange' },
        { label: 'Orders', icon: ClipboardList, href: '/hotel/orders', color: 'purple' },
    ],
    ACCOUNTANT: [
        { label: 'Finance', icon: CreditCard, href: '/hotel/finance', color: 'blue' },
        { label: 'Reports', icon: FileText, href: '/hotel/reports', color: 'green' },
        { label: 'Procurement', icon: Package, href: '/hotel/procurement', color: 'orange' },
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
                background: colors.gradient,
                borderRadius: 'var(--radius-lg)',
                border: `1px solid ${colors.border}`,
                padding: 'var(--space-5)',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-3)',
                transition: 'transform 150ms ease, box-shadow 150ms ease',
                cursor: widget.href ? 'pointer' : 'default',
                position: 'relative',
                overflow: 'hidden',
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', zIndex: 1 }}>
                <div style={{
                    fontSize: '22px',
                    fontWeight: '700',
                    color: 'var(--notion-text)',
                    lineHeight: 1.2,
                }}>
                    {value}
                </div>
                <div style={{
                    fontSize: '12px',
                    fontWeight: '500',
                    color: 'var(--notion-text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                }}>
                    {widget.title}
                </div>
            </div>
            <div style={{
                width: '44px',
                height: '44px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: colors.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                opacity: 0.9,
            }}>
                <Icon size={22} style={{ color: colors.text }} />
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

interface RevenueTrendPoint { date: string; amount: number }
interface RevenueAnalyticsLite {
    totalRevenue: number;
    roomRevenue: number;
    fbRevenue: number;
    otherRevenue: number;
    trend: RevenueTrendPoint[];
    fbTrend?: { date: string; amount: number; orders?: number }[];
    comparison?: { current: number; previous: number; change: number };
}

const REVENUE_SOURCES = [
    { key: 'total', label: 'Total' },
    { key: 'rooms', label: 'Rooms' },
    { key: 'fnb', label: 'F&B' },
] as const;
type RevenueSource = typeof REVENUE_SOURCES[number]['key'];

const PERIODS = [
    { days: 7, label: '7D' },
    { days: 30, label: '30D' },
    { days: 90, label: '90D' },
];

const fmtNpr = (n: number) =>
    `NPR ${Math.round(n).toLocaleString()}`;

/**
 * Hotel sales trend: daily revenue area chart with period toggle and a
 * room / F&B / growth summary. Self-contained fetch so it degrades gracefully
 * (hidden) for roles without analytics access.
 */
function SalesTrendCard() {
    const [days, setDays] = useState(30);
    const [source, setSource] = useState<RevenueSource>('total');
    const [data, setData] = useState<RevenueAnalyticsLite | null>(null);
    const [loading, setLoading] = useState(true);
    const [denied, setDenied] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        api.get<RevenueAnalyticsLite>(`/analytics/revenue?days=${days}`)
            .then(res => { if (!cancelled && res.data) setData(res.data); })
            .catch(() => { if (!cancelled) setDenied(true); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [days]);

    // Hide entirely if the role can't read financials.
    if (denied) return null;

    // F&B daily amounts keyed by date; rooms ≈ total − F&B (other lumped in).
    const fbByDate = new Map((data?.fbTrend || []).map(p => [p.date, p.amount]));
    const trend = (data?.trend || []).map(p => {
        const fb = fbByDate.get(p.date) || 0;
        const amount = source === 'fnb' ? fb : source === 'rooms' ? Math.max(0, p.amount - fb) : p.amount;
        return {
            date: p.date,
            label: new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            amount,
        };
    });
    const change = data?.comparison?.change ?? 0;
    const changePositive = change >= 0;

    return (
        <div style={{ marginTop: 'var(--space-8)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--notion-text)' }}>Sales Trend</h2>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Revenue source filter */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                        {REVENUE_SOURCES.map(s => (
                            <button
                                key={s.key}
                                onClick={() => setSource(s.key)}
                                style={{
                                    padding: '4px 12px', fontSize: '12px', fontWeight: source === s.key ? 600 : 400,
                                    color: source === s.key ? 'var(--notion-blue)' : 'var(--notion-text-secondary)',
                                    background: source === s.key ? 'var(--notion-blue-bg)' : 'var(--notion-bg-secondary)',
                                    border: `1px solid ${source === s.key ? 'var(--notion-blue)' : 'var(--notion-border)'}`,
                                    borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                }}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                    {PERIODS.map(p => (
                        <button
                            key={p.days}
                            onClick={() => setDays(p.days)}
                            style={{
                                padding: '4px 12px', fontSize: '12px', fontWeight: days === p.days ? 600 : 400,
                                color: days === p.days ? 'var(--notion-blue)' : 'var(--notion-text-secondary)',
                                background: days === p.days ? 'var(--notion-blue-bg)' : 'var(--notion-bg-secondary)',
                                border: `1px solid ${days === p.days ? 'var(--notion-blue)' : 'var(--notion-border)'}`,
                                borderRadius: 'var(--radius-md)', cursor: 'pointer',
                            }}
                        >
                            {p.label}
                        </button>
                    ))}
                    </div>
                </div>
            </div>

            <div style={{ background: 'var(--notion-bg-secondary)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
                {/* Summary row */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-6)', marginBottom: 'var(--space-4)' }}>
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total ({days}d)</div>
                        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--notion-text)' }}>{fmtNpr(data?.totalRevenue || 0)}</div>
                        {data?.comparison && (
                            <div style={{ fontSize: '12px', fontWeight: 600, color: changePositive ? 'var(--notion-green)' : 'var(--notion-red)' }}>
                                {changePositive ? '▲' : '▼'} {Math.abs(change).toFixed(1)}% vs prev
                            </div>
                        )}
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rooms</div>
                        <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--notion-blue)' }}>{fmtNpr(data?.roomRevenue || 0)}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>F&amp;B</div>
                        <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--notion-orange)' }}>{fmtNpr(data?.fbRevenue || 0)}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Other</div>
                        <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--notion-text-secondary)' }}>{fmtNpr(data?.otherRevenue || 0)}</div>
                    </div>
                </div>

                {/* Chart */}
                <div style={{ height: '260px' }}>
                    {loading ? (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--notion-text-muted)', fontSize: '13px' }}>Loading sales…</div>
                    ) : trend.length === 0 ? (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--notion-text-muted)', fontSize: '13px' }}>No sales in this period</div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--notion-blue)" stopOpacity={0.35} />
                                        <stop offset="95%" stopColor="var(--notion-blue)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--notion-border)" vertical={false} />
                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--notion-text-secondary)' }} tickLine={false} axisLine={{ stroke: 'var(--notion-border)' }} minTickGap={24} />
                                <YAxis tick={{ fontSize: 11, fill: 'var(--notion-text-secondary)' }} tickLine={false} axisLine={false} width={64} tickFormatter={(v: any) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                                <Tooltip
                                    formatter={(v: any) => [fmtNpr(v), 'Revenue']}
                                    contentStyle={{ background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: '8px', fontSize: '12px' }}
                                />
                                <Area type="monotone" dataKey="amount" stroke="var(--notion-blue)" strokeWidth={2} fill="url(#salesFill)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
        </div>
    );
}

interface SalesInsightsData {
    weeklyByWeekday: { weekday: string; amount: number }[];
    bestHours: { hour: number; label: string; amount: number; orders: number }[];
    visitors: { date: string; count: number }[];
    todaysBirthdays: { id: string; fullName: string; phone?: string; isVip: boolean }[];
}

const chartTooltipStyle = { background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: '8px', fontSize: '12px' } as const;

function InsightCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div style={{ background: 'var(--notion-bg-secondary)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--notion-text)', marginBottom: 'var(--space-4)' }}>{title}</h3>
            {children}
        </div>
    );
}

/**
 * Operational insights mirroring the reference dashboard: sales by weekday,
 * busiest hours, daily visitors (arrivals), and today's guest birthdays.
 */
function SalesInsights() {
    const [data, setData] = useState<SalesInsightsData | null>(null);
    const [denied, setDenied] = useState(false);

    useEffect(() => {
        let cancelled = false;
        api.get<SalesInsightsData>('/analytics/sales-insights')
            .then(res => { if (!cancelled && res.data) setData(res.data); })
            .catch(() => { if (!cancelled) setDenied(true); });
        return () => { cancelled = true; };
    }, []);

    if (denied || !data) return null;

    const activeHours = data.bestHours.filter(h => h.orders > 0);
    const visitors = data.visitors.map(v => ({
        ...v,
        label: new Date(v.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }));

    return (
        <div style={{ marginTop: 'var(--space-8)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--notion-text)', marginBottom: 'var(--space-4)' }}>Insights</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
                <InsightCard title="Sales by Weekday (last 8 weeks)">
                    <div style={{ height: '220px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.weeklyByWeekday} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--notion-border)" vertical={false} />
                                <XAxis dataKey="weekday" tick={{ fontSize: 11, fill: 'var(--notion-text-secondary)' }} tickLine={false} axisLine={{ stroke: 'var(--notion-border)' }} />
                                <YAxis tick={{ fontSize: 11, fill: 'var(--notion-text-secondary)' }} tickLine={false} axisLine={false} width={52} tickFormatter={(v: any) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                                <Tooltip formatter={(v: any) => [fmtNpr(v), 'Sales']} contentStyle={chartTooltipStyle} cursor={{ fill: 'var(--notion-bg-tertiary)' }} />
                                <Bar dataKey="amount" fill="var(--notion-purple)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </InsightCard>

                <InsightCard title="Busiest Hours (last 30 days)">
                    {activeHours.length === 0 ? (
                        <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--notion-text-muted)', fontSize: '13px' }}>No orders yet</div>
                    ) : (
                        <div style={{ height: '220px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={activeHours} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--notion-border)" vertical={false} />
                                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--notion-text-secondary)' }} tickLine={false} axisLine={{ stroke: 'var(--notion-border)' }} minTickGap={4} />
                                    <YAxis tick={{ fontSize: 11, fill: 'var(--notion-text-secondary)' }} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
                                    <Tooltip formatter={(v: any, _n: any, p: any) => [`${v} orders · ${fmtNpr(p?.payload?.amount || 0)}`, p?.payload?.label]} contentStyle={chartTooltipStyle} cursor={{ fill: 'var(--notion-bg-tertiary)' }} />
                                    <Bar dataKey="orders" fill="var(--notion-orange)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </InsightCard>

                <InsightCard title="Visitors / Arrivals (30 days)">
                    {visitors.length === 0 ? (
                        <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--notion-text-muted)', fontSize: '13px' }}>No arrivals</div>
                    ) : (
                        <div style={{ height: '220px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={visitors} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--notion-border)" vertical={false} />
                                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--notion-text-secondary)' }} tickLine={false} axisLine={{ stroke: 'var(--notion-border)' }} minTickGap={24} />
                                    <YAxis tick={{ fontSize: 11, fill: 'var(--notion-text-secondary)' }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                                    <Tooltip formatter={(v: any) => [`${v} guests`, 'Arrivals']} contentStyle={chartTooltipStyle} />
                                    <Line type="monotone" dataKey="count" stroke="var(--notion-green)" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </InsightCard>

                <InsightCard title={`Today's Birthdays${data.todaysBirthdays.length ? ` (${data.todaysBirthdays.length})` : ''}`}>
                    {data.todaysBirthdays.length === 0 ? (
                        <div style={{ height: '220px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--notion-text-muted)', fontSize: '13px', gap: '8px' }}>
                            <span style={{ fontSize: '28px' }}>🎂</span>
                            No guest birthdays today
                        </div>
                    ) : (
                        <div style={{ height: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {data.todaysBirthdays.map(g => (
                                <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'var(--notion-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)' }}>
                                    <span style={{ fontSize: '18px' }}>🎂</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--notion-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {g.fullName}
                                            {g.isVip && <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--notion-yellow)', background: 'var(--notion-yellow-bg)', padding: '1px 6px', borderRadius: '4px' }}>VIP</span>}
                                        </div>
                                        {g.phone && <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>{g.phone}</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </InsightCard>
            </div>
        </div>
    );
}

const LICENSE_STATUS_COLOR: Record<string, string> = {
    ACTIVE: 'var(--notion-green)',
    TRIAL: 'var(--notion-blue)',
    PENDING_PAYMENT: 'var(--notion-orange)',
    PAUSED: 'var(--notion-yellow)',
    EXPIRED: 'var(--notion-red)',
    REVOKED: 'var(--notion-red)',
};
const ATTENTION_STATUSES = new Set(['EXPIRED', 'REVOKED', 'PAUSED', 'PENDING_PAYMENT']);

function daysUntil(dateStr?: string | null): number | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return Math.ceil((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

/**
 * SaaS overview panels for super admins: license-status breakdown and an
 * actionable "needs attention" list (expired / paused / expiring within 7 days)
 * so operators can see at a glance which tenants need action.
 */
function SaaSAdminPanels({ tenants }: { tenants: any[] }) {
    const router = useRouter();
    if (!tenants || tenants.length === 0) return null;

    const statusCounts: Record<string, number> = {};
    for (const t of tenants) {
        const s = (t.licenseStatus || 'TRIAL') as string;
        statusCounts[s] = (statusCounts[s] || 0) + 1;
    }

    const needsAttention = tenants
        .map(t => ({ t, days: daysUntil(t.licenseExpiresAt) }))
        .filter(({ t, days }) =>
            ATTENTION_STATUSES.has(t.licenseStatus) || (days !== null && days <= 7)
        )
        .sort((a, b) => (a.days ?? -9999) - (b.days ?? -9999))
        .slice(0, 8);

    return (
        <div style={{ marginTop: 'var(--space-8)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
            {/* License status breakdown */}
            <div style={{ background: 'var(--notion-bg-secondary)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--notion-text)', marginBottom: 'var(--space-4)' }}>License Status</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).map(([status, cnt]) => {
                        const color = LICENSE_STATUS_COLOR[status] || 'var(--notion-text-secondary)';
                        const pct = Math.round((cnt / tenants.length) * 100);
                        return (
                            <div key={status}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                                    <span style={{ color: 'var(--notion-text)', fontWeight: 500 }}>{status.replace('_', ' ')}</span>
                                    <span style={{ color: 'var(--notion-text-secondary)' }}>{cnt} ({pct}%)</span>
                                </div>
                                <div style={{ height: '6px', background: 'var(--notion-bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ width: `${pct}%`, height: '100%', background: color }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Needs attention */}
            <div style={{ background: 'var(--notion-bg-secondary)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--notion-text)' }}>Needs Attention{needsAttention.length ? ` (${needsAttention.length})` : ''}</h3>
                    <button onClick={() => router.push('/admin/tenants')} style={{ fontSize: '12px', color: 'var(--notion-blue)', background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
                </div>
                {needsAttention.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--notion-text-muted)', fontSize: '13px' }}>All tenants healthy ✓</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {needsAttention.map(({ t, days }) => {
                            const color = LICENSE_STATUS_COLOR[t.licenseStatus] || 'var(--notion-text-secondary)';
                            const note = ATTENTION_STATUSES.has(t.licenseStatus)
                                ? (t.licenseStatus as string).replace('_', ' ')
                                : days !== null && days < 0 ? `expired ${-days}d ago`
                                : days === 0 ? 'expires today'
                                : `expires in ${days}d`;
                            return (
                                <div
                                    key={t.id}
                                    onClick={() => router.push('/admin/tenants')}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '8px 10px', background: 'var(--notion-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)', cursor: 'pointer' }}
                                >
                                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--notion-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name || `Hotel #${t.id}`}</span>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color, background: 'var(--notion-bg-tertiary)', padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>{note}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function DashboardPage() {
    const { user } = useAuth();
    const { isUserType, can } = usePermissions();
    const { hasModule } = useHotelPlan();
    const { dashboardStats, isLoading, fetchDashboard } = useAnalytics();
    const { overview: saasStats, payments: saasPayments, tenants: saasTenants } = useSaaSAnalytics();

    const roleKey = useMemo(() => {
        if (!user) return 'DEFAULT';
        return user.role?.name?.toUpperCase().replace(/\s+/g, '_') || 'DEFAULT';
    }, [user]);

    const widgets = useMemo((): WidgetConfig[] => {
        if (!user) return [];
        if (isUserType('SUPER_ADMIN')) return SUPER_ADMIN_WIDGETS;
        const base = isUserType('HOTEL_STAFF')
            ? (HOTEL_WIDGETS[roleKey] ?? HOTEL_WIDGETS.DEFAULT ?? [])
            : (HOTEL_WIDGETS.DEFAULT ?? []);
        // Filter out widgets for modules not included in the subscription plan
        return base.filter(w => {
            const mod = WIDGET_MODULE_MAP[w.id];
            if (mod === undefined) return true; // core widgets (not in map) always show
            return mod === null || hasModule(mod);
        });
    }, [user, isUserType, roleKey, hasModule]);

    const quickActions = useMemo((): QuickAction[] => {
        if (!user) return [];
        if (isUserType('SUPER_ADMIN')) return SUPER_ADMIN_QUICK_ACTIONS;
        const base = ROLE_QUICK_ACTIONS[roleKey] ?? [];
        // Filter out actions for modules not included in the subscription plan
        return base.filter(a => {
            const mod = getActionModule(a.href);
            return mod === null || hasModule(mod);
        });
    }, [user, isUserType, roleKey, hasModule]);

    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    }, []);

    const roleDisplayName = useMemo(() => {
        if (!user) return '';
        if (isUserType('SUPER_ADMIN')) return 'Super Admin';
        return user.role?.name || user.userType || '';
    }, [user, isUserType]);

    return (
        <DashboardLayout>
            <div style={{ padding: 'var(--space-6) var(--space-8)' }}>
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

                    {/* Clock Widget — directly below the greeting */}
                    <div style={{ marginBottom: 'var(--space-6)' }}>
                        <ClockWidget />
                    </div>

                    {/* Hotel-only widgets (below the clock). Hidden for super-admin
                        — they need a hotelId and would 400 on the SaaS dashboard. */}
                    {!isUserType('SUPER_ADMIN') && user?.hotelId && (
                        <>
                            {can('system:manage_settings') && <OnboardingChecklist />}
                            {can('analytics:view_operations') && <ForecastWidget />}
                        </>
                    )}

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

                    {/* SaaS overview panels (super admin) */}
                    {isUserType('SUPER_ADMIN') && <SaaSAdminPanels tenants={saasTenants} />}

                    {/* Sales Trend + Insights (hotel users) */}
                    {!isUserType('SUPER_ADMIN') && <SalesTrendCard />}
                    {!isUserType('SUPER_ADMIN') && <SalesInsights />}

                    {/* Recent Payments (Super Admin only) */}
                    {isUserType('SUPER_ADMIN') && saasPayments.length > 0 && (
                        <div style={{ marginTop: 'var(--space-8)' }}>
                            <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--notion-text)', marginBottom: 'var(--space-4)' }}>
                                Recent Payments
                            </h2>
                            <div style={{ backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                            <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--notion-text-secondary)', fontWeight: '500' }}>Date</th>
                                            <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--notion-text-secondary)', fontWeight: '500' }}>Tenant</th>
                                            <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--notion-text-secondary)', fontWeight: '500' }}>Method</th>
                                            <th style={{ textAlign: 'right', padding: '10px 14px', color: 'var(--notion-text-secondary)', fontWeight: '500' }}>Amount</th>
                                            <th style={{ textAlign: 'center', padding: '10px 14px', color: 'var(--notion-text-secondary)', fontWeight: '500' }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {saasPayments.slice(0, 6).map(p => (
                                            <tr key={p.id} style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                                <td style={{ padding: '10px 14px', color: 'var(--notion-text)' }}>{new Date(p.createdAt).toLocaleDateString()}</td>
                                                <td style={{ padding: '10px 14px', color: 'var(--notion-text)' }}>{p.hotelName}</td>
                                                <td style={{ padding: '10px 14px', color: 'var(--notion-text)' }}>{p.paymentMethod}</td>
                                                <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--notion-text)', fontWeight: '600' }}>NPR {Number(p.amount || 0).toLocaleString()}</td>
                                                <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                                    <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: 'var(--radius-full)', backgroundColor: p.status === 'COMPLETED' ? 'var(--notion-green-bg)' : p.status === 'PENDING' ? 'var(--notion-yellow-bg)' : 'var(--notion-red-bg)', color: p.status === 'COMPLETED' ? 'var(--notion-green)' : p.status === 'PENDING' ? 'var(--notion-orange)' : 'var(--notion-red)', fontWeight: 600 }}>
                                                        {p.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
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
